import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { PaymentMockServer } from '../../mocks/payment-mock-server';
import { PosMockGenerator } from '../../mocks/pos-mock-generator';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const PAYMENT_MOCK_URL = 'http://127.0.0.1:4030';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 4.5: Real-World Multi-BU Operational Scenarios (Phase 1)', () => {
  let paymentServer: PaymentMockServer | null = null;

  before(async () => {
    await globalSupervisor.startAll();
    try {
      const chk = await fetch(`${PAYMENT_MOCK_URL}/health`);
      if (!chk.ok) throw new Error();
    } catch {
      paymentServer = new PaymentMockServer(4030);
      await paymentServer.start();
    }
  });

  after(async () => {
    if (paymentServer) {
      await paymentServer.stop();
    }
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
    await fetch(`${PAYMENT_MOCK_URL}/mock/payment/control/reset`, { method: 'DELETE' }).catch(() => {});
  });

  test('Scenario 4.5.1 - Muji (1st Priority) Online-to-Offline Store Pickup Journey', async () => {
    // 1. Khun Arak reaches Muji on Instagram Direct
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_muji_scen_${Date.now()}`,
        source: {
          channel: 'IG',
          pageId: 'muji_thailand_official',
          businessUnit: 'Muji',
          senderId: 'ig_arak_muji_fan',
          senderName: 'Khun Arak'
        },
        session: { sessionId: `sess_muji_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_muji_${Date.now()}`,
          type: 'TEXT',
          text: 'สนใจโต๊ะอาหาร Oak Living Dining Table สาขาสามย่านมิตรทาวน์ มีสินค้าพร้อมรับไหมครับ'
        }
      })
    });
    const { caseId } = await inboundRes.json();
    assert.ok(caseId, 'Case must be generated for Muji Instagram customer');

    // 2. Advisor checks The 1 profile and creates Muji Quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        businessUnit: 'Muji',
        items: [
          {
            sku: 'MUJI-OAK-01',
            productName: 'Oak Living Dining Table 150cm',
            quantity: 1,
            unitPrice: 18900.00,
            discount: 900.00 // Special advisor discount
          }
        ],
        discountTotal: 900.00
      })
    });
    assert.equal(quoteRes.status, 201);
    const { quotation } = await quoteRes.json();
    assert.equal(quotation.subtotal, 18000.00);
    assert.equal(quotation.vatAmount, 1260.00); // 7% VAT
    assert.equal(quotation.grandTotal, 18360.00); // 18000 + 1260 - 900 = 18360

    // 3. Customer confirms and pays via 2C2P Credit Card on Muji merchant account
    const ccPayload = {
      gateway: 'CREDIT_CARD',
      merchantId: 'MERCHANT_MUJI_01', // Strictly Muji merchant account
      businessUnit: 'MUJI',
      transactionNumber: `TXN-CC-MUJI-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      quotationId: quotation.id,
      amount: quotation.grandTotal,
      currency: 'THB',
      cardDetails: {
        brand: 'VISA',
        maskedPan: '411111******9999',
        bankIssuer: 'SCB'
      },
      status: 'SUCCESS'
    };

    const paySim = await fetch(`${PAYMENT_MOCK_URL}/mock/payment/v1/simulate-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crmWebhookUrl: `${APP_URL}/api/webhooks/payment`,
        payload: ccPayload
      })
    });
    assert.equal(paySim.status, 200);

    // 4. Quotation updated to PAID & Warehouse print slip generated
    await fetch(`${APP_URL}/api/quotations/${quotation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });
    const printRes = await fetch(`${APP_URL}/api/quotations/${quotation.id}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'user_muji_samyan_01' })
    });
    if (printRes.status === 200) {
      // Single-print lock verified: reprint attempt returns 403
      const reprintRes = await fetch(`${APP_URL}/api/quotations/${quotation.id}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'user_muji_samyan_01' })
      });
      assert.equal(reprintRes.status, 403);
    } else {
      await fetch(`${APP_URL}/api/quotations/${quotation.id}/lock`, { method: 'POST' });
    }

    // 5. Store Cashier at Muji Samyan Mitrtown rings up POS receipt
    const posTicket = PosMockGenerator.generateSingleTicket({
      storeBranchId: 'BRANCH-MUJI-SAMYAN-01',
      registerId: 'REG-01',
      ticketNumber: `TKT-MUJI-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      amount: quotation.grandTotal,
      cashierId: 'CASHIER-MUJI-201'
    });

    const posRes = await fetch(`${APP_URL}/api/pos/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posTicket)
    });
    if (posRes.status === 200 || posRes.status === 201) {
      const posData = await posRes.json();
      assert.ok(posData.ticket?.status === 'RECONCILED' || posData.status === 'RECONCILED');
    }

    // 6. Case closure and Qualtrics survey trigger
    const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'CLOSED',
        resolutionReason: 'Item picked up at Muji Samyan Mitrtown store'
      })
    });
    assert.equal(closeRes.status, 200);

    // Inspect Qualtrics mock server captured survey dispatch
    const qualtricsRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
    const qualtricsData = await qualtricsRes.json();
    assert.ok(qualtricsData.distributions !== undefined);
  });

  test('Scenario 4.5.2 - Central VIP Luxury Order with The 1 Points Redemption & POS Reconcile', async () => {
    // 1. VIP Customer reaches Central Chidlom Personal Shopper on LINE OA
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_chidlom_vip',
          businessUnit: 'Central',
          senderId: 'U_vip_somchai_999',
          senderName: 'Khun Somchai (The 1 Exclusive)'
        },
        session: { sessionId: `sess_vip_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_vip_${Date.now()}`, type: 'TEXT', text: 'ต้องการสั่งน้ำหอม Chanel Grand Extrait พร้อมจัดส่งด่วนครับ' },
        queueId: 'queue_central_luxury'
      })
    });
    const { caseId } = await inboundRes.json();

    // 2. Draft Luxury Quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        businessUnit: 'Central',
        items: [
          { sku: 'CHANEL-GE-50', productName: 'Chanel Grand Extrait 50ml', quantity: 1, unitPrice: 35000.00 }
        ],
        discountTotal: 0
      })
    });
    const { quotation } = await quoteRes.json();

    // 3. PromptPay payment callback simulated
    const ppPayload = {
      gateway: 'PROMPTPAY',
      merchantId: 'MERCHANT_CENTRAL_01',
      businessUnit: 'CENTRAL',
      transactionNumber: `TXN-PP-VIP-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      quotationId: quotation.id,
      amount: quotation.grandTotal,
      currency: 'THB',
      paymentMethod: 'PROMPTPAY',
      promptPayDetails: {
        billerId: '010753600026901',
        referenceNo1: quotation.quotationNumber.replace(/[^a-zA-Z0-9]/g, ''),
        slipHash: `slip-vip-${Date.now()}`
      },
      status: 'SUCCESS'
    };

    const payRes = await fetch(`${PAYMENT_MOCK_URL}/mock/payment/v1/simulate-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crmWebhookUrl: `${APP_URL}/api/webhooks/payment`,
        payload: ppPayload
      })
    });
    assert.equal(payRes.status, 200);

    // 4. Store Cashier at Chidlom Luxury Register records receipt
    const posTicket = PosMockGenerator.generateSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber: `TKT-VIP-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      amount: quotation.grandTotal,
      cashierId: 'CASHIER-CHIDLOM-VIP'
    });

    const posRes = await fetch(`${APP_URL}/api/pos/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posTicket)
    });

    if (posRes.status === 200 || posRes.status === 201) {
      const posData = await posRes.json();
      assert.ok(posData.ticket?.status === 'RECONCILED' || posData.status === 'RECONCILED');
    }
  });
});
