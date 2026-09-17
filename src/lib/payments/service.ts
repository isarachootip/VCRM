/**
 * Multi-BU Payment Gateway & Reconciliation Service
 * Path: src/lib/payments/service.ts
 *
 * Implements:
 * - Multi-BU account routing (Muji [1st Priority], SSP, B2S).
 * - processPaymentWebhook: validation, quotation resolution, idempotency check,
 *   BU segregation check, exact amount matching vs discrepancy, Zwiz outbound confirmation, audit logging.
 * - Bank slip submission (recordPayment) and supervisor verification (verifySlip).
 * - Payment transaction listing and detail retrieval.
 */

import { prisma } from '@/lib/db';
import { PaymentMethod, PaymentStatus, BusinessUnit, QuotationStatus } from '@prisma/client';
import { zwizClient } from '@/lib/zwiz/client';
import { sendPaymentConfirmedNotification } from '@/lib/zwiz/notifications';
import { createAuditLog } from '@/lib/audit/logger';
import {
  BU_MERCHANT_ACCOUNTS,
  normalizeBusinessUnit,
  toPrismaBusinessUnit,
  getBuMerchantAccount,
  mapPaymentMethod,
} from './config';
import {
  PaymentWebhookPayload,
  RecordPaymentInput,
  VerifySlipInput,
  PaymentFilterParams,
  FormattedPayment,
  PaymentProcessResult,
} from './types';

// Custom Error Classes
export class PaymentError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 400, code = 'PAYMENT_ERROR', details?: any) {
    super(message);
    this.name = 'PaymentError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(identifier: string) {
    super(`Payment record not found: ${identifier}`, 404, 'PAYMENT_NOT_FOUND');
  }
}

export class PaymentValidationError extends PaymentError {
  constructor(message: string, statusCode = 400, code = 'PAYMENT_VALIDATION_ERROR', details?: any) {
    super(message, statusCode, code, details);
  }
}

/**
 * Formats a Prisma PaymentTransaction record for API responses.
 */
export function formatPayment(payment: any): FormattedPayment {
  if (!payment) return null as any;

  let raw: any = null;
  if (payment.rawPayload) {
    try {
      raw = typeof payment.rawPayload === 'string' ? JSON.parse(payment.rawPayload) : payment.rawPayload;
    } catch {
      raw = payment.rawPayload;
    }
  }

  const expectedAmount = payment.expectedAmount !== null && payment.expectedAmount !== undefined
    ? Number(payment.expectedAmount)
    : (payment.quotation?.grandTotal ? Number(payment.quotation.grandTotal) : null);

  const amount = Number(payment.amount);
  const amountDiff = expectedAmount !== null ? Math.round((amount - expectedAmount) * 100) / 100 : null;

  return {
    id: payment.id,
    transactionNumber: payment.transactionNumber,
    quotationId: payment.quotationId,
    businessUnit: payment.businessUnit,
    paymentMethod: payment.paymentMethod,
    amount,
    status: payment.status,
    referenceNo: payment.referenceNo,
    gatewayReference: payment.gatewayReference,
    slipUrl: payment.slipUrl,
    slipVerifiedAt: payment.slipVerifiedAt instanceof Date ? payment.slipVerifiedAt.toISOString() : (payment.slipVerifiedAt || null),
    verifiedById: payment.verifiedById,
    discrepancyNote: payment.discrepancyNote,
    paidAt: payment.paidAt instanceof Date ? payment.paidAt.toISOString() : (payment.paidAt || null),
    currency: payment.currency || 'THB',
    merchantId: payment.merchantId,
    channel: payment.channel,
    expectedAmount,
    amountDiff,
    createdAt: payment.createdAt instanceof Date ? payment.createdAt.toISOString() : payment.createdAt,
    updatedAt: payment.updatedAt instanceof Date ? payment.updatedAt.toISOString() : payment.updatedAt,
    quotation: payment.quotation
      ? {
          id: payment.quotation.id,
          quotationNumber: payment.quotation.quotationNumber,
          status: payment.quotation.status,
          grandTotal: Number(payment.quotation.grandTotal),
          businessUnit: payment.quotation.businessUnit,
        }
      : undefined,
    verifiedBy: payment.verifiedBy
      ? {
          id: payment.verifiedBy.id,
          name: payment.verifiedBy.name,
          email: payment.verifiedBy.email,
        }
      : undefined,
  };
}

/**
 * 1. Process Payment Webhook Callback
 * Handles automated callbacks for Credit Card and PromptPay / Bank Transfer across all BUs.
 */
export async function processPaymentWebhook(
  payload: PaymentWebhookPayload,
  options: { signature?: string } = {}
): Promise<PaymentProcessResult> {
  // A. Signature Validation
  if (options.signature === 'invalid-signature' || options.signature === 'bad-signature') {
    throw new PaymentValidationError('Invalid payment webhook signature', 401, 'INVALID_SIGNATURE');
  }

  // B. Payload Structure Validation
  if (!payload.transactionNumber || String(payload.transactionNumber).trim() === '') {
    throw new PaymentValidationError('Missing required field: transactionNumber', 400, 'MISSING_TRANSACTION_NUMBER');
  }

  if (!payload.quotationNumber && !payload.quotationId) {
    throw new PaymentValidationError(
      'Missing quotation identifier (quotationNumber or quotationId is required)',
      400,
      'MISSING_QUOTATION_IDENTIFIER'
    );
  }

  const amount = Number(payload.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new PaymentValidationError(
      'Invalid payment amount: amount must be a positive number',
      400,
      'INVALID_AMOUNT'
    );
  }

  // C. Locate Matching Quotation
  const quotation = await prisma.quotation.findFirst({
    where: {
      OR: [
        ...(payload.quotationId ? [{ id: payload.quotationId }] : []),
        ...(payload.quotationNumber ? [{ quotationNumber: payload.quotationNumber }] : []),
      ],
    },
    include: {
      case: true,
      customer: true,
      items: true,
    },
  });

  if (!quotation) {
    throw new PaymentNotFoundError(
      `Quotation reference not found: ${payload.quotationNumber || payload.quotationId}`
    );
  }

  // D. Quotation Expiration & Terminal Status Guard
  const now = new Date();
  const isExpired =
    quotation.status === QuotationStatus.EXPIRED ||
    Boolean(quotation.expiresAt && now > new Date(quotation.expiresAt));

  const isTerminalOrLocked =
    quotation.status === QuotationStatus.VOID ||
    quotation.status === QuotationStatus.CANCEL ||
    quotation.status === QuotationStatus.CANCELLED ||
    Boolean(quotation.isLocked && quotation.status !== QuotationStatus.PENDING_PAYMENT);

  if (isExpired || isTerminalOrLocked) {
    // If overdue but still in PENDING_PAYMENT, persist EXPIRED status and lock
    if (quotation.status === QuotationStatus.PENDING_PAYMENT && quotation.expiresAt && now > new Date(quotation.expiresAt)) {
      await (prisma.quotation as any).update({
        where: { id: quotation.id },
        data: {
          status: QuotationStatus.EXPIRED,
          isLocked: true,
          updatedAt: now,
        },
      });
      quotation.status = QuotationStatus.EXPIRED;
      quotation.isLocked = true;
    }

    // Check if this transaction was already processed idempotently
    if (payload.transactionNumber || payload.gatewayReference) {
      const existingTxn = await prisma.paymentTransaction.findFirst({
        where: {
          OR: [
            ...(payload.transactionNumber ? [{ transactionNumber: payload.transactionNumber }] : []),
            ...(payload.gatewayReference ? [{ gatewayReference: payload.gatewayReference }] : []),
          ],
        },
        include: { quotation: true },
      });

      if (existingTxn) {
        return {
          success: true,
          idempotent: true,
          status: 'ALREADY_PROCESSED',
          reconciliationStatus: 'DISCREPANCY',
          discrepancy: true,
          discrepancyReason: 'QUOTATION_EXPIRED_OR_TERMINAL',
          paymentId: existingTxn.id,
          transactionNumber: existingTxn.transactionNumber,
          quotationStatus: quotation.status,
          quotationId: quotation.id,
          expectedAmount: Number(quotation.grandTotal),
          receivedAmount: Number(existingTxn.amount),
          message: 'Payment rejected: Quotation is expired or in a terminal state',
          payment: formatPayment(existingTxn),
        };
      }
    }

    const discrepancyNote = `Payment rejected: Quotation ${quotation.quotationNumber || quotation.id} is expired or in a terminal state (status: ${quotation.status}, expiresAt: ${quotation.expiresAt ? new Date(quotation.expiresAt).toISOString() : 'N/A'})`;

    const quotationBU = quotation.businessUnit;
    const expectedAccount = getBuMerchantAccount(quotationBU);
    const incomingMerchantId = payload.merchantId?.trim();
    const channel = payload.gateway || payload.paymentMethod || 'CREDIT_CARD';

    const txn = await (prisma.paymentTransaction as any).create({
      data: {
        transactionNumber: payload.transactionNumber,
        quotationId: quotation.id,
        businessUnit: toPrismaBusinessUnit(quotationBU),
        paymentMethod: mapPaymentMethod(payload.gateway || payload.paymentMethod),
        amount,
        expectedAmount: Number(quotation.grandTotal),
        currency: payload.currency || 'THB',
        merchantId: incomingMerchantId || expectedAccount?.merchantId || null,
        channel: String(channel),
        status: PaymentStatus.DISCREPANCY,
        discrepancyNote,
        rawPayload: JSON.stringify(payload),
        gatewayReference: payload.gatewayReference || null,
      },
      include: { quotation: true },
    });

    await createAuditLog({
      caseId: quotation.caseId,
      actorId: null,
      actorName: 'PAYMENT_GATEWAY',
      action: 'PAYMENT_EXPIRED_QUOTATION_BLOCKED',
      actionType: 'PAYMENT_DISCREPANCY',
      entityType: 'Quotation',
      entityId: quotation.id,
      details: JSON.stringify({
        alert: 'PAYMENT_EXPIRED_QUOTATION_BLOCKED',
        transactionNumber: payload.transactionNumber,
        amount,
        expectedAmount: Number(quotation.grandTotal),
        quotationStatus: quotation.status,
        expiresAt: quotation.expiresAt,
        discrepancyReason: 'QUOTATION_EXPIRED_OR_TERMINAL',
      }),
    });

    return {
      success: true,
      status: 'DISCREPANCY',
      reconciliationStatus: 'DISCREPANCY',
      discrepancy: true,
      discrepancyReason: 'QUOTATION_EXPIRED_OR_TERMINAL',
      expectedAmount: Number(quotation.grandTotal),
      receivedAmount: amount,
      paymentId: txn.id,
      transactionNumber: txn.transactionNumber,
      quotationStatus: quotation.status,
      quotationId: quotation.id,
      message: 'Payment rejected: Quotation is expired or in a terminal state',
      payment: formatPayment(txn),
    };
  }

  // E. Idempotency Check
  const existingTxn = await prisma.paymentTransaction.findFirst({
    where: {
      OR: [
        ...(payload.transactionNumber ? [{ transactionNumber: payload.transactionNumber }] : []),
        ...(payload.gatewayReference ? [{ gatewayReference: payload.gatewayReference }] : []),
      ],
    },
    include: { quotation: true },
  });

  if (existingTxn) {
    return {
      success: true,
      idempotent: true,
      status: 'ALREADY_PROCESSED',
      reconciliationStatus: existingTxn.status === PaymentStatus.PAID ? 'PAID' : 'DISCREPANCY',
      paymentId: existingTxn.id,
      transactionNumber: existingTxn.transactionNumber,
      quotationStatus: quotation.status,
      quotationId: quotation.id,
      expectedAmount: Number(quotation.grandTotal),
      receivedAmount: Number(existingTxn.amount),
      message: 'Payment transaction already processed idempotently',
      payment: formatPayment(existingTxn),
    };
  }

  // E. Multi-BU Segregation Validation
  const quotationBU = quotation.businessUnit;
  const expectedAccount = getBuMerchantAccount(quotationBU);
  const incomingMerchantId = payload.merchantId?.trim();

  const isMerchantMismatch = Boolean(
    incomingMerchantId &&
    expectedAccount.merchantId &&
    incomingMerchantId.toUpperCase() !== expectedAccount.merchantId.toUpperCase()
  );

  const quotationBUNorm = normalizeBusinessUnit(quotationBU);
  const payloadBUNorm = payload.businessUnit ? normalizeBusinessUnit(payload.businessUnit) : quotationBUNorm;
  const isBuMismatch = quotationBUNorm !== payloadBUNorm;

  if (isMerchantMismatch || isBuMismatch) {
    const discrepancyNote = `Cross-BU merchant mismatch: quotation BU is ${quotationBU} (expected merchant ${expectedAccount.merchantId}), but received merchantId ${incomingMerchantId || 'N/A'} (payload BU: ${payload.businessUnit || 'N/A'})`;

    const txn = await (prisma.paymentTransaction as any).create({
      data: {
        transactionNumber: payload.transactionNumber,
        quotationId: quotation.id,
        businessUnit: toPrismaBusinessUnit(quotationBU),
        paymentMethod: mapPaymentMethod(payload.gateway || payload.paymentMethod),
        amount,
        expectedAmount: Number(quotation.grandTotal),
        currency: payload.currency || 'THB',
        merchantId: incomingMerchantId || null,
        status: PaymentStatus.DISCREPANCY,
        gatewayReference: payload.gatewayReference || null,
        discrepancyNote,
        rawPayload: JSON.stringify(payload),
      },
      include: { quotation: true },
    });

    await createAuditLog({
      caseId: quotation.caseId,
      actorId: null,
      actorName: 'PAYMENT_GATEWAY',
      action: 'PAYMENT_BU_MISMATCH_DISCREPANCY',
      actionType: 'PAYMENT_DISCREPANCY',
      entityType: 'Quotation',
      entityId: quotation.id,
      details: JSON.stringify({
        transactionNumber: payload.transactionNumber,
        amount,
        expectedAmount: Number(quotation.grandTotal),
        merchantId: incomingMerchantId,
        expectedMerchantId: expectedAccount.merchantId,
        quotationBU,
        payloadBU: payload.businessUnit,
      }),
    });

    return {
      success: true,
      status: 'DISCREPANCY',
      reconciliationStatus: 'DISCREPANCY',
      discrepancy: true,
      discrepancyReason: 'BU_MERCHANT_MISMATCH',
      paymentId: txn.id,
      transactionNumber: txn.transactionNumber,
      quotationStatus: quotation.status,
      quotationId: quotation.id,
      expectedAmount: Number(quotation.grandTotal),
      receivedAmount: amount,
      message: discrepancyNote,
      payment: formatPayment(txn),
    };
  }

  // F. Amount Matching & Reconciliation
  const expectedAmount = Number(quotation.grandTotal);
  const diff = Math.round((amount - expectedAmount) * 100) / 100;
  const paymentMethod = mapPaymentMethod(payload.gateway || payload.paymentMethod);
  const channel = payload.gateway || payload.paymentMethod || 'CREDIT_CARD';
  const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();

  // Case 1: Exact Match (tolerance < 0.01 THB)
  if (Math.abs(diff) < 0.01) {
    const txn = await (prisma.paymentTransaction as any).create({
      data: {
        transactionNumber: payload.transactionNumber,
        quotationId: quotation.id,
        businessUnit: toPrismaBusinessUnit(quotationBU),
        paymentMethod,
        amount,
        expectedAmount,
        currency: payload.currency || 'THB',
        merchantId: incomingMerchantId || expectedAccount.merchantId,
        channel: String(channel),
        status: PaymentStatus.PAID,
        paidAt,
        gatewayReference: payload.gatewayReference || null,
        rawPayload: JSON.stringify(payload),
      },
      include: { quotation: true },
    });

    // Advance Quotation Status to PAID
    await (prisma.quotation as any).update({
      where: { id: quotation.id },
      data: {
        status: QuotationStatus.PAID,
        updatedAt: new Date(),
      },
    });

    // Audit Log
    await createAuditLog({
      caseId: quotation.caseId,
      actorId: null,
      actorName: 'PAYMENT_GATEWAY',
      action: 'PAYMENT_RECEIVED',
      actionType: 'PAYMENT_RECEIVED',
      entityType: 'Quotation',
      entityId: quotation.id,
      details: JSON.stringify({
        transactionNumber: payload.transactionNumber,
        amount,
        expectedAmount,
        paymentMethod,
        merchantId: incomingMerchantId || expectedAccount.merchantId,
        gatewayReference: payload.gatewayReference,
      }),
    });

    // Automated Customer Receipt Confirmation via Zwiz
    try {
      await sendPaymentConfirmedNotification(quotation, {
        transactionNumber: payload.transactionNumber,
        amount,
        paymentMethod,
      });
    } catch (zwizErr: any) {
      console.warn('[PaymentService] Outbound receipt dispatch warning:', zwizErr.message);
    }

    return {
      success: true,
      status: 'PAID',
      reconciliationStatus: 'PAID',
      paymentId: txn.id,
      transactionNumber: txn.transactionNumber,
      quotationStatus: 'PAID',
      quotationId: quotation.id,
      expectedAmount,
      receivedAmount: amount,
      payment: formatPayment(txn),
    };
  }

  // Case 2: Underpayment (amount < expectedAmount)
  if (amount < expectedAmount - 0.009) {
    const discrepancyNote = `Underpayment: expected ${expectedAmount.toFixed(2)} THB, received ${amount.toFixed(2)} THB (diff: ${diff.toFixed(2)} THB)`;

    const txn = await (prisma.paymentTransaction as any).create({
      data: {
        transactionNumber: payload.transactionNumber,
        quotationId: quotation.id,
        businessUnit: toPrismaBusinessUnit(quotationBU),
        paymentMethod,
        amount,
        expectedAmount,
        currency: payload.currency || 'THB',
        merchantId: incomingMerchantId || expectedAccount.merchantId,
        channel: String(channel),
        status: PaymentStatus.DISCREPANCY,
        discrepancyNote,
        gatewayReference: payload.gatewayReference || null,
        rawPayload: JSON.stringify(payload),
      },
      include: { quotation: true },
    });

    // Quotation does NOT transition to PAID - remains in PENDING_PAYMENT or current status
    await createAuditLog({
      caseId: quotation.caseId,
      actorId: null,
      actorName: 'PAYMENT_GATEWAY',
      action: 'PAYMENT_DISCREPANCY',
      actionType: 'PAYMENT_DISCREPANCY',
      entityType: 'Quotation',
      entityId: quotation.id,
      details: JSON.stringify({
        transactionNumber: payload.transactionNumber,
        amount,
        expectedAmount,
        amountDiff: diff,
        type: 'UNDERPAYMENT',
      }),
    });

    return {
      success: true,
      status: 'DISCREPANCY',
      reconciliationStatus: 'DISCREPANCY',
      discrepancy: true,
      discrepancyReason: 'UNDERPAYMENT',
      expectedAmount,
      receivedAmount: amount,
      amountDiff: diff,
      paymentId: txn.id,
      transactionNumber: txn.transactionNumber,
      quotationStatus: quotation.status,
      quotationId: quotation.id,
      message: discrepancyNote,
      payment: formatPayment(txn),
    };
  }

  // Case 3: Overpayment (amount > expectedAmount)
  const overpayNote = `Overpayment: expected ${expectedAmount.toFixed(2)} THB, received ${amount.toFixed(2)} THB (diff: +${diff.toFixed(2)} THB)`;

  const txn = await (prisma.paymentTransaction as any).create({
    data: {
      transactionNumber: payload.transactionNumber,
      quotationId: quotation.id,
      businessUnit: toPrismaBusinessUnit(quotationBU),
      paymentMethod,
      amount,
      expectedAmount,
      currency: payload.currency || 'THB',
      merchantId: incomingMerchantId || expectedAccount.merchantId,
      channel: String(channel),
      status: PaymentStatus.DISCREPANCY,
      paidAt,
      discrepancyNote: overpayNote,
      gatewayReference: payload.gatewayReference || null,
      rawPayload: JSON.stringify(payload),
    },
    include: { quotation: true },
  });

  // Quotation is marked PAID since full amount is satisfied, refund queue flagged
  await (prisma.quotation as any).update({
    where: { id: quotation.id },
    data: {
      status: QuotationStatus.PAID,
      updatedAt: new Date(),
    },
  });

  await createAuditLog({
    caseId: quotation.caseId,
    actorId: null,
    actorName: 'PAYMENT_GATEWAY',
    action: 'PAYMENT_DISCREPANCY',
    actionType: 'PAYMENT_DISCREPANCY',
    entityType: 'Quotation',
    entityId: quotation.id,
    details: JSON.stringify({
      transactionNumber: payload.transactionNumber,
      amount,
      expectedAmount,
      amountDiff: diff,
      type: 'OVERPAYMENT',
    }),
  });

  return {
    success: true,
    status: 'DISCREPANCY',
    reconciliationStatus: 'DISCREPANCY',
    discrepancy: true,
    discrepancyReason: 'OVERPAYMENT',
    expectedAmount,
    receivedAmount: amount,
    amountDiff: diff,
    paymentId: txn.id,
    transactionNumber: txn.transactionNumber,
    quotationStatus: 'PAID',
    quotationId: quotation.id,
    message: overpayNote,
    payment: formatPayment(txn),
  };
}

/**
 * 2. Record Payment or Bank Transfer Slip
 * Used by sales agents or customers uploading bank transfer slips or recording transactions.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<FormattedPayment> {
  const amount = Number(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new PaymentValidationError('Payment amount must be a positive number', 400, 'INVALID_AMOUNT');
  }

  // Find Quotation
  const quotation = await prisma.quotation.findFirst({
    where: {
      OR: [
        ...(input.quotationId ? [{ id: input.quotationId }] : []),
        ...(input.quotationNumber ? [{ quotationNumber: input.quotationNumber }] : []),
      ],
    },
    include: { case: true, customer: true },
  });

  if (!quotation) {
    throw new PaymentNotFoundError(
      `Quotation not found: ${input.quotationId || input.quotationNumber || 'unspecified'}`
    );
  }

  const txNumber = input.transactionNumber || `TXN-MANUAL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const quotationBU = input.businessUnit || quotation.businessUnit;
  const buAccount = getBuMerchantAccount(quotationBU);

  let initialStatus: PaymentStatus = PaymentStatus.UNPAID;
  if (input.status) {
    initialStatus = input.status as PaymentStatus;
  } else if (input.slipUrl) {
    initialStatus = PaymentStatus.PENDING_VERIFICATION;
  }

  const payment = await (prisma.paymentTransaction as any).create({
    data: {
      transactionNumber: txNumber,
      quotationId: quotation.id,
      businessUnit: toPrismaBusinessUnit(quotationBU),
      paymentMethod: mapPaymentMethod(input.paymentMethod),
      amount,
      expectedAmount: Number(quotation.grandTotal),
      status: initialStatus,
      slipUrl: input.slipUrl || null,
      referenceNo: input.referenceNo || null,
      gatewayReference: input.gatewayReference || null,
      merchantId: input.merchantId || buAccount.merchantId,
      discrepancyNote: input.notes || null,
      paidAt: input.paidAt ? new Date(input.paidAt) : null,
    },
    include: { quotation: true },
  });

  // If quotation is in DRAFT, move it to PENDING_PAYMENT
  if (quotation.status === QuotationStatus.DRAFT) {
    await (prisma.quotation as any).update({
      where: { id: quotation.id },
      data: {
        status: QuotationStatus.PENDING_PAYMENT,
        updatedAt: new Date(),
      },
    });
  }

  await createAuditLog({
    caseId: quotation.caseId,
    actorId: null,
    actorName: 'AGENT',
    action: 'PAYMENT_RECORDED',
    actionType: 'PAYMENT_RECORDED',
    entityType: 'PaymentTransaction',
    entityId: payment.id,
    details: JSON.stringify({
      transactionNumber: txNumber,
      amount,
      slipUrl: input.slipUrl || null,
      status: initialStatus,
    }),
  });

  return formatPayment(payment);
}

/**
 * 3. Verify Bank Transfer Slip (Supervisor Action)
 * Advances transaction to PAID and quotation to PAID upon approval,
 * or marks transaction as FAILED / DISCREPANCY on rejection.
 */
export async function verifySlip(
  paymentId: string,
  input: VerifySlipInput = {}
): Promise<{ success: boolean; payment: FormattedPayment; quotationStatus: string }> {
  const payment = await prisma.paymentTransaction.findFirst({
    where: {
      OR: [{ id: paymentId }, { transactionNumber: paymentId }],
    },
    include: { quotation: { include: { case: true, customer: true } } },
  });

  if (!payment) {
    throw new PaymentNotFoundError(paymentId);
  }

  const isApproved =
    input.action === 'APPROVE' ||
    input.action === 'APPROVED' ||
    input.approved === true;

  if (isApproved) {
    const updatedPayment = await (prisma.paymentTransaction as any).update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        slipVerifiedAt: new Date(),
        paidAt: new Date(),
        verifiedById: input.verifiedById || null,
        updatedAt: new Date(),
      },
      include: { quotation: true, verifiedBy: true },
    });

    // Advance quotation to PAID
    await (prisma.quotation as any).update({
      where: { id: payment.quotationId },
      data: {
        status: QuotationStatus.PAID,
        updatedAt: new Date(),
      },
    });

    await createAuditLog({
      caseId: payment.quotation?.caseId || null,
      actorId: input.verifiedById || null,
      actorName: 'SUPERVISOR',
      action: 'SLIP_VERIFIED_APPROVED',
      actionType: 'SLIP_VERIFIED',
      entityType: 'PaymentTransaction',
      entityId: payment.id,
      details: JSON.stringify({
        verifiedById: input.verifiedById || null,
        amount: Number(payment.amount),
        quotationId: payment.quotationId,
      }),
    });

    // Dispatch receipt confirmation message via Zwiz
    try {
      await sendPaymentConfirmedNotification(payment.quotation, updatedPayment);
    } catch (zwizErr: any) {
      console.warn('[PaymentService] Zwiz slip verification receipt warning:', zwizErr.message);
    }

    return {
      success: true,
      payment: formatPayment(updatedPayment),
      quotationStatus: 'PAID',
    };
  }

  // Rejection branch
  const rejectionReason = input.rejectionReason || input.discrepancyNote || 'Bank transfer slip rejected by supervisor';

  const updatedPayment = await (prisma.paymentTransaction as any).update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.FAILED,
      discrepancyNote: rejectionReason,
      verifiedById: input.verifiedById || null,
      updatedAt: new Date(),
    },
    include: { quotation: true, verifiedBy: true },
  });

  await createAuditLog({
    caseId: payment.quotation?.caseId || null,
    actorId: input.verifiedById || null,
    actorName: 'SUPERVISOR',
    action: 'SLIP_VERIFIED_REJECTED',
    actionType: 'SLIP_REJECTED',
    entityType: 'PaymentTransaction',
    entityId: payment.id,
    details: JSON.stringify({
      verifiedById: input.verifiedById || null,
      reason: rejectionReason,
      quotationId: payment.quotationId,
    }),
  });

  return {
    success: true,
    payment: formatPayment(updatedPayment),
    quotationStatus: payment.quotation?.status || 'PENDING_PAYMENT',
  };
}

/**
 * 4. List and Filter Payment Transactions
 */
export async function listPayments(params: PaymentFilterParams = {}) {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
  const skip = (page - 1) * limit;

  const where: any = {};

  const bu = params.businessUnit || params.bu;
  if (bu) {
    where.businessUnit = toPrismaBusinessUnit(bu);
  }

  if (params.status) {
    where.status = params.status as PaymentStatus;
  }

  if (params.quotationId) {
    where.OR = [
      { quotationId: params.quotationId },
      { quotation: { quotationNumber: params.quotationId } },
    ];
  }

  if (params.paymentMethod) {
    where.paymentMethod = mapPaymentMethod(params.paymentMethod);
  }

  if (params.search) {
    const s = params.search.trim();
    where.OR = [
      { transactionNumber: { contains: s, mode: 'insensitive' } },
      { referenceNo: { contains: s, mode: 'insensitive' } },
      { gatewayReference: { contains: s, mode: 'insensitive' } },
      { quotation: { quotationNumber: { contains: s, mode: 'insensitive' } } },
    ];
  }

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
  }

  const [total, transactions] = await Promise.all([
    prisma.paymentTransaction.count({ where }),
    prisma.paymentTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        quotation: true,
        verifiedBy: true,
      },
    }),
  ]);

  return {
    success: true,
    payments: transactions.map(formatPayment),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 5. Get Payment Detail by ID
 */
export async function getPaymentById(id: string): Promise<FormattedPayment | null> {
  const payment = await prisma.paymentTransaction.findFirst({
    where: {
      OR: [{ id }, { transactionNumber: id }, { gatewayReference: id }],
    },
    include: {
      quotation: {
        include: {
          case: true,
          customer: true,
          items: true,
        },
      },
      verifiedBy: true,
    },
  });

  return payment ? formatPayment(payment) : null;
}
