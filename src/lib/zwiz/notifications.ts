/**
 * Automated Quotation Lifecycle Chat Notifications (R3 - Phase 2)
 * Path: src/lib/zwiz/notifications.ts
 *
 * Implements:
 * - QUOTATION_CREATED: Payment link button card sent when quote enters PENDING_PAYMENT.
 * - PAYMENT_REMINDER: Reminder button card sent for pending quotations.
 * - PAYMENT_CONFIRMED: Payment receipt confirmation with order summary sent when quotation is PAID.
 * - QUOTATION_EXPIRED: Expiration notice sent when quotation reaches EXPIRED.
 * - Interacts via ZwizClient with comprehensive audit logging and resilient error handling.
 */

import { prisma } from '@/lib/db';
import { zwizClient } from './client';
import { createAuditLog } from '@/lib/audit/logger';
import {
  buildQuotationCreatedTemplate,
  buildPaymentReminderTemplate,
  buildPaymentConfirmedTemplate,
  buildQuotationExpiredTemplate,
} from './templates';

export interface NotificationResult {
  success: boolean;
  event: string;
  quotationId: string;
  quotationNumber: string;
  messageId?: string;
  channel?: string;
  recipientId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Resolves full quotation record with case and customer relations.
 */
async function resolveQuotation(quotationOrId: any) {
  if (typeof quotationOrId === 'string') {
    return prisma.quotation.findFirst({
      where: {
        OR: [{ id: quotationOrId }, { quotationNumber: quotationOrId }],
      },
      include: {
        case: true,
        customer: true,
        items: true,
      },
    });
  }

  // If already an object but missing relations, re-fetch
  if (quotationOrId && (!quotationOrId.case || !quotationOrId.customer || !quotationOrId.items)) {
    const fetched = await prisma.quotation.findFirst({
      where: { id: quotationOrId.id },
      include: {
        case: true,
        customer: true,
        items: true,
      },
    });
    return fetched || quotationOrId;
  }

  return quotationOrId;
}

/**
 * Resolves destination channel, recipient ID, and page ID from quotation/case.
 */
function resolveDestination(quotation: any) {
  const targetCase = quotation.case;
  const targetCustomer = quotation.customer;

  const caseId = targetCase?.id || quotation.caseId || 'case_unknown';
  const recipientId =
    targetCustomer?.lineUserId ||
    targetCustomer?.fbPsid ||
    targetCustomer?.channelUserId ||
    targetCustomer?.externalId ||
    'customer_unknown';

  const channel = targetCase?.channel || targetCustomer?.channel || 'LINE';
  const pageId = targetCase?.pageId || 'central_chatshop';

  return { caseId, recipientId, channel, pageId, targetCase, targetCustomer };
}

/**
 * 1. QUOTATION_CREATED: Dispatches secure payment link button card.
 */
export async function sendQuotationCreatedNotification(quotationOrId: any): Promise<NotificationResult> {
  const quotation = await resolveQuotation(quotationOrId);
  if (!quotation) {
    return {
      success: false,
      event: 'QUOTATION_CREATED',
      quotationId: 'unknown',
      quotationNumber: 'unknown',
      error: 'Quotation not found',
    };
  }

  const { caseId, recipientId, channel, pageId, targetCase } = resolveDestination(quotation);
  const templatePayload = buildQuotationCreatedTemplate({
    quotationNumber: quotation.quotationNumber,
    grandTotal: quotation.grandTotal,
    paymentLinkUrl: quotation.paymentLinkUrl,
    expiresAt: quotation.expiresAt,
    items: quotation.items,
  });

  try {
    const response = await zwizClient.sendMessage({
      caseId,
      recipientId,
      channel,
      pageId,
      message: templatePayload as any,
      metadata: {
        sourceEvent: 'QUOTATION_CREATED',
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        grandTotal: Number(quotation.grandTotal),
        issuedAt: quotation.issuedAt ? new Date(quotation.issuedAt).toISOString() : new Date().toISOString(),
      },
    });

    await createAuditLog({
      caseId: targetCase?.id || null,
      action: 'NOTIFICATION_SENT',
      actionType: 'NOTIFICATION_SENT',
      entityType: 'Quotation',
      entityId: quotation.id,
      details: JSON.stringify({
        event: 'QUOTATION_CREATED',
        quotationNumber: quotation.quotationNumber,
        messageId: response.messageId,
        channel,
        recipientId,
      }),
    });

    return {
      success: true,
      event: 'QUOTATION_CREATED',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      messageId: response.messageId,
      channel,
      recipientId,
    };
  } catch (err: any) {
    console.warn(`[ZwizNotification] Failed to send QUOTATION_CREATED notice for ${quotation.quotationNumber}:`, err.message);
    return {
      success: false,
      event: 'QUOTATION_CREATED',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      channel,
      recipientId,
      error: err.message,
    };
  }
}

/**
 * 2. PAYMENT_REMINDER: Dispatches payment reminder card for pending quotations.
 */
export async function sendPaymentReminderNotification(
  quotationOrId: any,
  options: { urgent?: boolean } = {}
): Promise<NotificationResult> {
  const quotation = await resolveQuotation(quotationOrId);
  if (!quotation) {
    return {
      success: false,
      event: 'PAYMENT_REMINDER',
      quotationId: 'unknown',
      quotationNumber: 'unknown',
      error: 'Quotation not found',
    };
  }

  // Guard: only send reminders for pending payment
  if (quotation.status !== 'PENDING_PAYMENT' && quotation.status !== 'DRAFT') {
    return {
      success: false,
      skipped: true,
      event: 'PAYMENT_REMINDER',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      error: `Quotation status is ${quotation.status}, reminder suppressed`,
    };
  }

  const { caseId, recipientId, channel, pageId, targetCase } = resolveDestination(quotation);
  const isUrgent = options.urgent ?? false;
  const templatePayload = buildPaymentReminderTemplate(
    {
      quotationNumber: quotation.quotationNumber,
      grandTotal: quotation.grandTotal,
      paymentLinkUrl: quotation.paymentLinkUrl,
      expiresAt: quotation.expiresAt,
    },
    isUrgent
  );

  try {
    const response = await zwizClient.sendMessage({
      caseId,
      recipientId,
      channel,
      pageId,
      message: templatePayload as any,
      metadata: {
        sourceEvent: 'PAYMENT_REMINDER',
        urgent: isUrgent,
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
      },
    });

    await createAuditLog({
      caseId: targetCase?.id || null,
      action: 'NOTIFICATION_SENT',
      actionType: 'NOTIFICATION_SENT',
      entityType: 'Quotation',
      entityId: quotation.id,
      details: JSON.stringify({
        event: 'PAYMENT_REMINDER',
        urgent: isUrgent,
        quotationNumber: quotation.quotationNumber,
        messageId: response.messageId,
        channel,
        recipientId,
      }),
    });

    return {
      success: true,
      event: 'PAYMENT_REMINDER',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      messageId: response.messageId,
      channel,
      recipientId,
    };
  } catch (err: any) {
    console.warn(`[ZwizNotification] Failed to send PAYMENT_REMINDER for ${quotation.quotationNumber}:`, err.message);
    return {
      success: false,
      event: 'PAYMENT_REMINDER',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      channel,
      recipientId,
      error: err.message,
    };
  }
}

/**
 * 3. PAYMENT_CONFIRMED: Dispatches payment receipt confirmation with order summary.
 */
export async function sendPaymentConfirmedNotification(
  quotationOrId: any,
  paymentOrDetails?: any
): Promise<NotificationResult> {
  const quotation = await resolveQuotation(quotationOrId);
  if (!quotation) {
    return {
      success: false,
      event: 'PAYMENT_CONFIRMED',
      quotationId: 'unknown',
      quotationNumber: 'unknown',
      error: 'Quotation not found',
    };
  }

  const { caseId, recipientId, channel, pageId, targetCase } = resolveDestination(quotation);
  const templatePayload = buildPaymentConfirmedTemplate(
    {
      quotationNumber: quotation.quotationNumber,
      grandTotal: quotation.grandTotal,
      businessUnit: quotation.businessUnit,
    },
    paymentOrDetails
      ? {
          transactionNumber: paymentOrDetails.transactionNumber,
          paymentMethod: paymentOrDetails.paymentMethod,
          amount: paymentOrDetails.amount,
        }
      : undefined
  );

  try {
    const response = await zwizClient.sendMessage({
      caseId,
      recipientId,
      channel,
      pageId,
      message: templatePayload as any,
      metadata: {
        sourceEvent: 'PAYMENT_CONFIRMED',
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        transactionNumber: paymentOrDetails?.transactionNumber || null,
        amount: Number(paymentOrDetails?.amount ?? quotation.grandTotal),
      },
    });

    await createAuditLog({
      caseId: targetCase?.id || null,
      action: 'NOTIFICATION_SENT',
      actionType: 'NOTIFICATION_SENT',
      entityType: 'Quotation',
      entityId: quotation.id,
      details: JSON.stringify({
        event: 'PAYMENT_CONFIRMED',
        quotationNumber: quotation.quotationNumber,
        messageId: response.messageId,
        channel,
        recipientId,
        amount: Number(paymentOrDetails?.amount ?? quotation.grandTotal),
      }),
    });

    return {
      success: true,
      event: 'PAYMENT_CONFIRMED',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      messageId: response.messageId,
      channel,
      recipientId,
    };
  } catch (err: any) {
    console.warn(`[ZwizNotification] Failed to send PAYMENT_CONFIRMED notice for ${quotation.quotationNumber}:`, err.message);
    return {
      success: false,
      event: 'PAYMENT_CONFIRMED',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      channel,
      recipientId,
      error: err.message,
    };
  }
}

/**
 * 4. QUOTATION_EXPIRED: Dispatches quotation expiration notice.
 */
export async function sendQuotationExpiredNotification(
  quotationOrId: any,
  options: { reason?: string } = {}
): Promise<NotificationResult> {
  const quotation = await resolveQuotation(quotationOrId);
  if (!quotation) {
    return {
      success: false,
      event: 'QUOTATION_EXPIRED',
      quotationId: 'unknown',
      quotationNumber: 'unknown',
      error: 'Quotation not found',
    };
  }

  const { caseId, recipientId, channel, pageId, targetCase } = resolveDestination(quotation);
  const templatePayload = buildQuotationExpiredTemplate({
    quotationNumber: quotation.quotationNumber,
    grandTotal: quotation.grandTotal,
  });

  try {
    const response = await zwizClient.sendMessage({
      caseId,
      recipientId,
      channel,
      pageId,
      message: templatePayload as any,
      metadata: {
        sourceEvent: 'QUOTATION_EXPIRED',
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        reason: options.reason || '24H_AUTO_EXPIRATION',
      },
    });

    await createAuditLog({
      caseId: targetCase?.id || null,
      action: 'NOTIFICATION_SENT',
      actionType: 'NOTIFICATION_SENT',
      entityType: 'Quotation',
      entityId: quotation.id,
      details: JSON.stringify({
        event: 'QUOTATION_EXPIRED',
        quotationNumber: quotation.quotationNumber,
        messageId: response.messageId,
        channel,
        recipientId,
        reason: options.reason,
      }),
    });

    return {
      success: true,
      event: 'QUOTATION_EXPIRED',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      messageId: response.messageId,
      channel,
      recipientId,
    };
  } catch (err: any) {
    console.warn(`[ZwizNotification] Failed to send QUOTATION_EXPIRED notice for ${quotation.quotationNumber}:`, err.message);
    return {
      success: false,
      event: 'QUOTATION_EXPIRED',
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      channel,
      recipientId,
      error: err.message,
    };
  }
}
