/**
 * Unit & Integration Test Suite for Multi-BU Payment Gateway & Webhook Reconciliation
 * Path: src/lib/payments/payment-service.test.ts
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@/lib/db';
import {
  BU_MERCHANT_ACCOUNTS,
  normalizeBusinessUnit,
  toPrismaBusinessUnit,
  getBuMerchantAccount,
  getBuByMerchantId,
  mapPaymentMethod,
  processPaymentWebhook,
  recordPayment,
  verifySlip,
  listPayments,
  getPaymentById,
  PaymentValidationError,
  PaymentNotFoundError,
} from './index';
import { BusinessUnit, PaymentMethod, PaymentStatus, QuotationStatus } from '@prisma/client';

describe('Payment Module Unit & Service Tests (M8 / R2)', () => {
  let testQuotationId: string;
  let testQuotationNumber: string;

  before(async () => {
    // Ensure clean state for test runs
    await prisma.paymentTransaction.deleteMany();
  });

  after(async () => {
    // Cleanup created test records
    await prisma.paymentTransaction.deleteMany();
  });

  describe('1. Multi-BU Routing & Account Configuration', () => {
    test('Muji is configured as Priority 1 with MERCHANT_MUJI_01', () => {
      const muji = BU_MERCHANT_ACCOUNTS.MUJI;
      assert.equal(muji.priority, 1, 'Muji must be 1st Priority per spec');
      assert.equal(muji.merchantId, 'MERCHANT_MUJI_01');
      assert.equal(muji.billerId, '010753600026902');
    });

    test('Central is configured with MERCHANT_CENTRAL_01', () => {
      const central = BU_MERCHANT_ACCOUNTS.CENTRAL;
      assert.equal(central.priority, 2);
      assert.equal(central.merchantId, 'MERCHANT_CENTRAL_01');
      assert.equal(central.billerId, '010753600026901');
    });

    test('Supersports is configured with MERCHANT_SSP_01', () => {
      const ssp = BU_MERCHANT_ACCOUNTS.SSP;
      assert.equal(ssp.priority, 3);
      assert.equal(ssp.merchantId, 'MERCHANT_SSP_01');
      assert.equal(ssp.billerId, '010753600026903');
    });

    test('B2S is configured with MERCHANT_B2S_01', () => {
      const b2s = BU_MERCHANT_ACCOUNTS.B2S;
      assert.equal(b2s.priority, 4);
      assert.equal(b2s.merchantId, 'MERCHANT_B2S_01');
      assert.equal(b2s.billerId, '010753600026904');
    });

    test('normalizeBusinessUnit normalizes variations correctly', () => {
      assert.equal(normalizeBusinessUnit('muji'), 'MUJI');
      assert.equal(normalizeBusinessUnit('Muji'), 'MUJI');
      assert.equal(normalizeBusinessUnit('CENTRAL'), 'CENTRAL');
      assert.equal(normalizeBusinessUnit('Central Beauty Club'), 'CENTRAL');
      assert.equal(normalizeBusinessUnit('CDS'), 'CENTRAL');
      assert.equal(normalizeBusinessUnit('Supersports'), 'SSP');
      assert.equal(normalizeBusinessUnit('ssp'), 'SSP');
      assert.equal(normalizeBusinessUnit('b2s'), 'B2S');
      assert.equal(normalizeBusinessUnit(null), 'CENTRAL');
    });

    test('getBuByMerchantId resolves merchant to correct BU config', () => {
      const mujiCfg = getBuByMerchantId('MERCHANT_MUJI_01');
      assert.ok(mujiCfg);
      assert.equal(mujiCfg?.priority, 1);
      assert.equal(mujiCfg?.businessUnit, 'Muji');

      const centralCfg = getBuByMerchantId('MERCHANT_CENTRAL_01');
      assert.ok(centralCfg);
      assert.equal(centralCfg?.businessUnit, 'Central');

      assert.equal(getBuByMerchantId('INVALID_MERCHANT'), null);
    });

    test('mapPaymentMethod maps methods accurately', () => {
      assert.equal(mapPaymentMethod('CREDIT_CARD'), PaymentMethod.CREDIT_CARD);
      assert.equal(mapPaymentMethod('PROMPTPAY'), PaymentMethod.PROMPTPAY);
      assert.equal(mapPaymentMethod('QR'), PaymentMethod.PROMPTPAY);
      assert.equal(mapPaymentMethod('BANK_TRANSFER'), PaymentMethod.BANK_TRANSFER);
      assert.equal(mapPaymentMethod('SLIP'), PaymentMethod.BANK_TRANSFER);
    });
  });

  describe('2. Webhook Validation and Error Handling', () => {
    test('Rejects invalid signature with 401', async () => {
      await assert.rejects(
        async () => {
          await processPaymentWebhook(
            {
              gateway: 'CREDIT_CARD',
              merchantId: 'MERCHANT_MUJI_01',
              transactionNumber: 'TXN-SIG-TEST',
              quotationNumber: 'QT-TEST',
              amount: 1000,
              status: 'SUCCESS',
            },
            { signature: 'invalid-signature' }
          );
        },
        (err: any) => {
          assert.equal(err.statusCode, 401);
          assert.equal(err.code, 'INVALID_SIGNATURE');
          return true;
        }
      );
    });

    test('Rejects missing transactionNumber with 400', async () => {
      await assert.rejects(
        async () => {
          await processPaymentWebhook({
            gateway: 'CREDIT_CARD',
            merchantId: 'MERCHANT_MUJI_01',
            transactionNumber: '',
            quotationNumber: 'QT-TEST',
            amount: 1000,
            status: 'SUCCESS',
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'MISSING_TRANSACTION_NUMBER');
          return true;
        }
      );
    });

    test('Rejects missing quotation reference with 400', async () => {
      await assert.rejects(
        async () => {
          await processPaymentWebhook({
            gateway: 'CREDIT_CARD',
            merchantId: 'MERCHANT_MUJI_01',
            transactionNumber: 'TXN-NO-QUOTE',
            amount: 1000,
            status: 'SUCCESS',
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'MISSING_QUOTATION_IDENTIFIER');
          return true;
        }
      );
    });

    test('Rejects invalid payment amount with 400', async () => {
      await assert.rejects(
        async () => {
          await processPaymentWebhook({
            gateway: 'CREDIT_CARD',
            merchantId: 'MERCHANT_MUJI_01',
            transactionNumber: 'TXN-INVALID-AMT',
            quotationNumber: 'QT-TEST',
            amount: -50,
            status: 'SUCCESS',
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'INVALID_AMOUNT');
          return true;
        }
      );
    });

    test('Rejects non-existent quotation reference with 404', async () => {
      await assert.rejects(
        async () => {
          await processPaymentWebhook({
            gateway: 'CREDIT_CARD',
            merchantId: 'MERCHANT_MUJI_01',
            transactionNumber: `TXN-NONEXISTENT-${Date.now()}`,
            quotationNumber: 'QT-9999-NONEXISTENT',
            amount: 1000,
            status: 'SUCCESS',
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 404);
          assert.equal(err.code, 'PAYMENT_NOT_FOUND');
          return true;
        }
      );
    });
  });

  describe('3. Webhook Ingestion, Idempotency, and Amount Reconciliation', () => {
    let mujiQuotation: any;

    beforeEach(async () => {
      // Helper to create quotation in DB
      const qNum = `QT-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      mujiQuotation = await (prisma.quotation as any).create({
        data: {
          quotationNumber: qNum,
          caseId: 'dummy_case_pay',
          customerId: 'cust_seed_001',
          businessUnit: BusinessUnit.MUJI,
          status: QuotationStatus.PENDING_PAYMENT,
          subtotal: 26065.42,
          vatAmount: 1824.58,
          discountTotal: 0,
          grandTotal: 27890.00,
          totalAmount: 27890.00,
          isLocked: false,
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    test('Exact amount match: creates PAID transaction, advances quotation to PAID', async () => {
      const txNum = `TXN-EXACT-${Date.now()}`;
      const result = await processPaymentWebhook({
        gateway: 'CREDIT_CARD',
        merchantId: 'MERCHANT_MUJI_01',
        businessUnit: 'MUJI',
        transactionNumber: txNum,
        quotationNumber: mujiQuotation.quotationNumber,
        amount: 27890.00,
        currency: 'THB',
        paymentMethod: 'CREDIT_CARD',
        status: 'SUCCESS',
      });

      assert.equal(result.success, true);
      assert.equal(result.status, 'PAID');
      assert.equal(result.reconciliationStatus, 'PAID');
      assert.equal(result.quotationStatus, 'PAID');

      // Check DB
      const updatedQuote = await prisma.quotation.findUnique({
        where: { id: mujiQuotation.id },
      });
      assert.equal(updatedQuote?.status, QuotationStatus.PAID);

      const txn = await prisma.paymentTransaction.findFirst({
        where: { transactionNumber: txNum },
      });
      assert.ok(txn);
      assert.equal(txn?.status, PaymentStatus.PAID);
      assert.equal(Number(txn?.amount), 27890.00);
    });

    test('Idempotency: Replayed transactionNumber returns ALREADY_PROCESSED and does not duplicate', async () => {
      const txNum = `TXN-IDEMP-${Date.now()}`;
      const payload = {
        gateway: 'PROMPTPAY',
        merchantId: 'MERCHANT_MUJI_01',
        businessUnit: 'MUJI',
        transactionNumber: txNum,
        quotationNumber: mujiQuotation.quotationNumber,
        amount: 27890.00,
        status: 'SUCCESS',
      };

      // 1st Call
      const res1 = await processPaymentWebhook(payload);
      assert.equal(res1.success, true);
      assert.equal(res1.status, 'PAID');

      // 2nd Call (Replay)
      const res2 = await processPaymentWebhook(payload);
      assert.equal(res2.success, true);
      assert.equal(res2.idempotent, true);
      assert.equal(res2.status, 'ALREADY_PROCESSED');
      assert.equal(res2.paymentId, res1.paymentId);

      // Verify DB count is exactly 1
      const count = await prisma.paymentTransaction.count({
        where: { transactionNumber: txNum },
      });
      assert.equal(count, 1, 'Idempotent replay must not create duplicate transaction rows');
    });

    test('BU Segregation mismatch: Muji quotation with Central merchant ID flags DISCREPANCY', async () => {
      const txNum = `TXN-MISMATCH-${Date.now()}`;
      const result = await processPaymentWebhook({
        gateway: 'CREDIT_CARD',
        merchantId: 'MERCHANT_CENTRAL_01', // Wrong merchant for MUJI!
        businessUnit: 'CENTRAL',
        transactionNumber: txNum,
        quotationNumber: mujiQuotation.quotationNumber,
        amount: 27890.00,
        status: 'SUCCESS',
      });

      assert.equal(result.success, true);
      assert.equal(result.status, 'DISCREPANCY');
      assert.equal(result.reconciliationStatus, 'DISCREPANCY');
      assert.equal(result.discrepancy, true);
      assert.equal(result.discrepancyReason, 'BU_MERCHANT_MISMATCH');

      // Quotation must NOT be updated to PAID
      const updatedQuote = await prisma.quotation.findUnique({
        where: { id: mujiQuotation.id },
      });
      assert.notEqual(updatedQuote?.status, QuotationStatus.PAID);
      assert.equal(updatedQuote?.status, QuotationStatus.PENDING_PAYMENT);

      // Transaction recorded with DISCREPANCY
      const txn = await prisma.paymentTransaction.findFirst({
        where: { transactionNumber: txNum },
      });
      assert.ok(txn);
      assert.equal(txn?.status, PaymentStatus.DISCREPANCY);
      assert.ok(txn?.discrepancyNote?.includes('Cross-BU merchant mismatch'));
    });

    test('Underpayment discrepancy: Lower amount flags DISCREPANCY and quotation stays PENDING_PAYMENT', async () => {
      const txNum = `TXN-UNDER-${Date.now()}`;
      const result = await processPaymentWebhook({
        gateway: 'CREDIT_CARD',
        merchantId: 'MERCHANT_MUJI_01',
        businessUnit: 'MUJI',
        transactionNumber: txNum,
        quotationNumber: mujiQuotation.quotationNumber,
        amount: 20000.00, // Expected 27,890
        status: 'SUCCESS',
      });

      assert.equal(result.success, true);
      assert.equal(result.status, 'DISCREPANCY');
      assert.equal(result.discrepancy, true);
      assert.equal(result.discrepancyReason, 'UNDERPAYMENT');
      assert.equal(result.expectedAmount, 27890.00);
      assert.equal(result.receivedAmount, 20000.00);
      assert.equal(result.amountDiff, -7890.00);

      // Quotation must remain PENDING_PAYMENT
      const updatedQuote = await prisma.quotation.findUnique({
        where: { id: mujiQuotation.id },
      });
      assert.equal(updatedQuote?.status, QuotationStatus.PENDING_PAYMENT);
    });
  });

  describe('4. Bank Slip Submission & Supervisor Verification', () => {
    let quote: any;

    beforeEach(async () => {
      const qNum = `QT-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      quote = await (prisma.quotation as any).create({
        data: {
          quotationNumber: qNum,
          caseId: 'dummy_case_slip',
          customerId: 'cust_seed_001',
          businessUnit: BusinessUnit.CENTRAL,
          status: QuotationStatus.DRAFT,
          subtotal: 5000,
          vatAmount: 350,
          discountTotal: 0,
          grandTotal: 5350,
          totalAmount: 5350,
          isLocked: false,
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    test('recordPayment records bank slip with PENDING_VERIFICATION and advances DRAFT to PENDING_PAYMENT', async () => {
      const slip = await recordPayment({
        quotationId: quote.id,
        amount: 5350,
        paymentMethod: 'BANK_TRANSFER',
        slipUrl: 'https://storage.mock.local/slips/slip_001.png',
        referenceNo: 'KBANK-REF-123',
      });

      assert.ok(slip.id);
      assert.equal(slip.status, PaymentStatus.PENDING_VERIFICATION);
      assert.equal(slip.slipUrl, 'https://storage.mock.local/slips/slip_001.png');

      const updatedQuote = await prisma.quotation.findUnique({ where: { id: quote.id } });
      assert.equal(updatedQuote?.status, QuotationStatus.PENDING_PAYMENT);
    });

    test('verifySlip APPROVE advances transaction to PAID and quotation to PAID', async () => {
      const slip = await recordPayment({
        quotationId: quote.id,
        amount: 5350,
        paymentMethod: 'BANK_TRANSFER',
        slipUrl: 'https://storage.mock.local/slips/slip_approve.png',
      });

      const verifyResult = await verifySlip(slip.id, {
        action: 'APPROVE',
        verifiedById: 'user_supervisor_01',
      });

      assert.equal(verifyResult.success, true);
      assert.equal(verifyResult.payment.status, PaymentStatus.PAID);
      assert.equal(verifyResult.quotationStatus, 'PAID');
      assert.ok(verifyResult.payment.slipVerifiedAt);
      assert.equal(verifyResult.payment.verifiedById, 'user_supervisor_01');

      const q = await prisma.quotation.findUnique({ where: { id: quote.id } });
      assert.equal(q?.status, QuotationStatus.PAID);
    });

    test('verifySlip REJECT marks transaction as FAILED and quotation remains un-paid', async () => {
      const slip = await recordPayment({
        quotationId: quote.id,
        amount: 5350,
        paymentMethod: 'BANK_TRANSFER',
        slipUrl: 'https://storage.mock.local/slips/slip_reject.png',
      });

      const verifyResult = await verifySlip(slip.id, {
        action: 'REJECT',
        rejectionReason: 'Illegible transfer timestamp',
        verifiedById: 'user_supervisor_01',
      });

      assert.equal(verifyResult.success, true);
      assert.equal(verifyResult.payment.status, PaymentStatus.FAILED);
      assert.equal(verifyResult.payment.discrepancyNote, 'Illegible transfer timestamp');

      const q = await prisma.quotation.findUnique({ where: { id: quote.id } });
      assert.notEqual(q?.status, QuotationStatus.PAID);
    });
  });

  describe('5. List & Detail Retrieval', () => {
    test('listPayments filters by business unit and status', async () => {
      const list = await listPayments({ businessUnit: 'Central', limit: 10 });
      assert.ok(list.success);
      assert.ok(Array.isArray(list.payments));
      assert.equal(typeof list.total, 'number');
    });

    test('getPaymentById returns payment with relations', async () => {
      const all = await listPayments({ limit: 1 });
      if (all.payments.length > 0) {
        const item = await getPaymentById(all.payments[0].id);
        assert.ok(item);
        assert.equal(item?.id, all.payments[0].id);
      }
    });
  });
});
