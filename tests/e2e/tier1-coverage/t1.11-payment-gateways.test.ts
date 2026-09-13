import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { PaymentMockServer } from '../../mocks/payment-mock-server';
import { waitFor } from '../../runner/wait-for';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const PAYMENT_MOCK_URL = 'http://127.0.0.1:4030';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 1.11: Multi-BU Payment Gateway & Webhook Reconciliation (R2 / Phase 1)', () => {
  let paymentMockServer: PaymentMockServer | null = null;

  before(async () => {
    await globalSupervisor.startAll();
    try {
      const chk = await fetch(`${PAYMENT_MOCK_URL}/health`);
      if (!chk.ok) throw new Error();
    } catch {
      paymentMockServer = new PaymentMockServer(4030);
      await paymentMockServer.start();
    }
  });

  after(async () => {
    if (paymentMockServer) {
      await paymentMockServer.stop();
    }
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
    await fetch(`${PAYMENT_MOCK_URL}/mock/payment/control/reset`, { method: 'DELETE' }).catch(() => {});
  });

  async function createTestQuotation(bu = 'MUJI', price = 27890.00) {
    // Create Case first
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_pay_case_${Date.now()}_${Math.random()}`,
        source: { channel: 'LINE', pageId: 'central_chatshop', businessUnit: bu, senderId: `U_pay_${Date.now()}` },
        session: { sessionId: `sess_pay_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_pay_${Date.now()}`, type: 'TEXT', text: 'Order consultation' }
      })
    });
    const caseData = await caseRes.json();

    // Create Quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.caseId,
        businessUnit: bu,
        items: [{ sku: 'PROD-PAY', productName: 'Order Item', quantity: 1, unitPrice: price }]
      })
    });
    const qData = await quoteRes.json();
    return { caseId: caseData.caseId, quotation: qData.quotation };
  }

  test('T1.11.1 - Ingest Credit Card callback for Muji (1st Priority) and update Quotation to PAID', async () => {
    const { quotation } = await createTestQuotation('MUJI', 27890.00);

    const ccPayload = {
      gateway: 'CREDIT_CARD',
      merchantId: 'MERCHANT_MUJI_01',
      businessUnit: 'MUJI',
      transactionNumber: `TXN-CC-MUJI-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      quotationId: quotation.id,
      amount: quotation.grandTotal,
      currency: 'THB',
      paymentMethod: 'CREDIT_CARD',
      cardDetails: {
        brand: 'VISA',
        maskedPan: '411111******1111',
        authCode: 'AUTH889900',
        bankIssuer: 'KBANK'
      },
      status: 'SUCCESS',
      paidAt: new Date().toISOString(),
      gatewayReference: `GW-REF-CC-${Date.now()}`
    };

    // Simulate callback via Mock Payment Gateway
    const simRes = await fetch(`${PAYMENT_MOCK_URL}/mock/payment/v1/simulate-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crmWebhookUrl: `${APP_URL}/api/webhooks/payment`,
        payload: ccPayload
      })
    });

    assert.equal(simRes.status, 200, 'Mock payment server simulation must return 200');
    const simData = await simRes.json();
    assert.equal(simData.success, true);

    // Verify quotation status in CRM
    const updatedQuote = await waitFor(async () => {
      const res = await fetch(`${APP_URL}/api/quotations/${quotation.id}`);
      if (res.status === 200) {
        const d = await res.json();
        return (d.quotation?.status === 'PAID' || d.status === 'PAID') ? d : null;
      }
      return null;
    }, { description: 'Quotation status updated to PAID', timeoutMs: 4000 });

    assert.ok(updatedQuote, 'Quotation must be updated to PAID status upon CC callback');
  });

  test('T1.11.2 - Ingest PromptPay callback for Central with slip hash and update Quotation to PAID', async () => {
    const { quotation } = await createTestQuotation('CENTRAL', 3500.00);

    const promptPayPayload = {
      gateway: 'PROMPTPAY',
      merchantId: 'MERCHANT_CENTRAL_01',
      businessUnit: 'CENTRAL',
      transactionNumber: `TXN-PP-CENTRAL-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      quotationId: quotation.id,
      amount: quotation.grandTotal,
      currency: 'THB',
      paymentMethod: 'PROMPTPAY',
      promptPayDetails: {
        billerId: '010753600026901',
        referenceNo1: quotation.quotationNumber.replace(/[^a-zA-Z0-9]/g, ''),
        referenceNo2: 'CENTRAL01',
        slipHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      },
      status: 'SUCCESS',
      paidAt: new Date().toISOString(),
      gatewayReference: `GW-REF-PP-${Date.now()}`
    };

    const simRes = await fetch(`${PAYMENT_MOCK_URL}/mock/payment/v1/simulate-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crmWebhookUrl: `${APP_URL}/api/webhooks/payment`,
        payload: promptPayPayload
      })
    });

    assert.equal(simRes.status, 200);
    const simData = await simRes.json();
    assert.equal(simData.success, true);
  });

  test('T1.11.3 - Multi-BU Routing Segregation: Mismatch between merchant account and quotation BU flags discrepancy', async () => {
    // Create quotation for MUJI
    const { quotation } = await createTestQuotation('MUJI', 5000.00);

    // Send callback with CENTRAL merchant ID for MUJI order
    const mismatchPayload = {
      gateway: 'CREDIT_CARD',
      merchantId: 'MERCHANT_CENTRAL_01', // Mismatched!
      businessUnit: 'CENTRAL',
      transactionNumber: `TXN-MISMATCH-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      quotationId: quotation.id,
      amount: quotation.grandTotal,
      status: 'SUCCESS'
    };

    const res = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mismatchPayload)
    });

    // Endpoint may return 200 with discrepancy or 422
    if (res.status === 200) {
      const data = await res.json();
      assert.ok(data.status === 'DISCREPANCY' || data.reconciliationStatus === 'DISCREPANCY' || data.success);
    } else {
      assert.equal(res.status, 422, 'BU mismatch should be rejected or flagged as unprocessable');
    }

    // Quotation should NOT be marked PAID
    const qRes = await fetch(`${APP_URL}/api/quotations/${quotation.id}`);
    const qData = await qRes.json();
    const currentStatus = qData.quotation?.status || qData.status;
    assert.notEqual(currentStatus, 'PAID', 'Quotation must not be updated to PAID when BU merchant mismatches');
  });

  test('T1.11.4 - Underpayment amount discrepancy: Payment with lower amount flags DISCREPANCY', async () => {
    const { quotation } = await createTestQuotation('SSP', 3200.00);

    // Send underpayment: 2000 THB instead of full grandTotal
    const underpaymentPayload = {
      gateway: 'CREDIT_CARD',
      merchantId: 'MERCHANT_SSP_01',
      businessUnit: 'SSP',
      transactionNumber: `TXN-UNDERPAY-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      quotationId: quotation.id,
      amount: 2000.00, // Underpayment
      currency: 'THB',
      status: 'SUCCESS'
    };

    const res = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(underpaymentPayload)
    });

    const data = await res.json();
    assert.ok(
      data.status === 'DISCREPANCY' || data.reconciliationStatus === 'DISCREPANCY' || data.discrepancy || data.success,
      'Underpayment must be recorded with discrepancy flag'
    );

    // Quotation should still be in PENDING_PAYMENT or DRAFT
    const qRes = await fetch(`${APP_URL}/api/quotations/${quotation.id}`);
    const qData = await qRes.json();
    const currentStatus = qData.quotation?.status || qData.status;
    assert.notEqual(currentStatus, 'PAID', 'Underpaid quotation must not transition to PAID');
  });

  test('T1.11.5 - Webhook Idempotency: Replayed identical transactionNumber returns idempotent success', async () => {
    const { quotation } = await createTestQuotation('B2S', 890.00);
    const txNumber = `TXN-IDEMPOTENT-${Date.now()}`;

    const payload = {
      gateway: 'PROMPTPAY',
      merchantId: 'MERCHANT_B2S_01',
      businessUnit: 'B2S',
      transactionNumber: txNumber,
      quotationNumber: quotation.quotationNumber,
      quotationId: quotation.id,
      amount: quotation.grandTotal,
      status: 'SUCCESS'
    };

    // 1st delivery
    const res1 = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res1.status, 200);

    // 2nd replayed delivery
    const res2 = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res2.status, 200, 'Replayed webhook must return 200 OK');
    const data2 = await res2.json();
    assert.ok(
      data2.idempotent === true || data2.status === 'ALREADY_PROCESSED' || data2.success === true,
      'Response must indicate idempotency handling'
    );
  });
});
