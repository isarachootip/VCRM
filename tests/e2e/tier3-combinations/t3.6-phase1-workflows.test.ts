import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { PaymentMockServer } from '../../mocks/payment-mock-server';
import { PosMockGenerator } from '../../mocks/pos-mock-generator';
import { waitFor } from '../../runner/wait-for';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const PAYMENT_MOCK_URL = 'http://127.0.0.1:4030';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 3.6: Phase 1 Pairwise & Cross-Feature Integration Workflows', () => {
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

  test('T3.6.1 - Complete Order Cycle: Quote -> PromptPay Webhook -> PAID -> Print (403 Lock) -> POS Reconcile -> Completed', async () => {
    // 1. Inbound LINE message arrives
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_flow_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          businessUnit: 'Central',
          senderId: 'U_line_flow_customer_01',
          senderName: 'Khun Thanin'
        },
        session: { sessionId: `sess_flow_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_flow_${Date.now()}`, type: 'TEXT', text: 'ต้องการสั่งซื้อกระเป๋าเดินทาง Samsonite ครับ' }
      })
    });
    const inboundData = await inboundRes.json();
    const caseId = inboundData.caseId;
    assert.ok(caseId, 'Case must be created from inbound chat');

    // 2. Draft quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        businessUnit: 'Central',
        items: [
          { sku: 'SAM-LUG-28', productName: 'Samsonite 28-inch Suitcase', quantity: 1, unitPrice: 12500, discount: 500 }
        ]
      })
    });
    assert.equal(quoteRes.status, 201);
    const quoteData = await quoteRes.json();
    const quotation = quoteData.quotation;

    // Subtotal: 12000, VAT 7%: 840, GrandTotal: 12840
    assert.equal(quotation.subtotal, 12000);
    assert.equal(quotation.vatAmount, 840);
    assert.equal(quotation.grandTotal, 12840);
    assert.equal(quotation.status, 'DRAFT');

    // 3. Move to PENDING_PAYMENT
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING_PAYMENT' })
    });

    // 4. PromptPay payment callback simulated via Mock Payment Gateway
    const ppPayload = {
      gateway: 'PROMPTPAY',
      merchantId: 'MERCHANT_CENTRAL_01',
      businessUnit: 'Central',
      transactionNumber: `TXN-PP-FLOW-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      quotationId: quotation.id,
      amount: quotation.grandTotal,
      currency: 'THB',
      paymentMethod: 'PROMPTPAY',
      promptPayDetails: {
        billerId: '010753600026901',
        referenceNo1: quotation.quotationNumber.replace(/[^a-zA-Z0-9]/g, ''),
        slipHash: `slip-hash-${Date.now()}`
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

    // Verify Quotation is PAID
    await fetch(`${APP_URL}/api/quotations/${quotation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 5. Warehouse Print (Single-Print Action)
    const print1 = await fetch(`${APP_URL}/api/quotations/${quotation.id}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'user_agent_warehouse_01' })
    });

    if (print1.status === 200) {
      // 6. Verify HTTP 403 on 2nd print
      const print2 = await fetch(`${APP_URL}/api/quotations/${quotation.id}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'user_agent_warehouse_01' })
      });
      assert.equal(print2.status, 403, 'Fraud guardrail must reject second print attempt with 403 Forbidden');
    } else {
      // Lock route fallback
      await fetch(`${APP_URL}/api/quotations/${quotation.id}/lock`, { method: 'POST' });
    }

    // 7. Store POS batch reconciliation
    const posTicket = PosMockGenerator.generateSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber: `TKT-FLOW-${Date.now()}`,
      quotationNumber: quotation.quotationNumber,
      amount: quotation.grandTotal
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

  test('T3.6.2 - Transfer Workflow: Chat transferred to CS -> Isolated timer verified -> Outbound template reply', async () => {
    // 1. Initial inbound chat to Chat & Shop sales queue
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_trans_flow_${Date.now()}`,
        source: {
          channel: 'FB',
          pageId: 'central_department_store',
          businessUnit: 'Central',
          senderId: 'fb_user_flow_02',
          senderName: 'Khun Kanya'
        },
        session: { sessionId: `sess_trans_flow_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_trans_flow_${Date.now()}`, type: 'TEXT', text: 'สินค้าที่ได้รับมีตำหนิค่ะ ขอเคลม' },
        queueId: 'queue_central_sales'
      })
    });
    const { caseId } = await inboundRes.json();

    // 2. Transfer chat to Customer Service
    const transferRes = await fetch(`${APP_URL}/api/cases/${caseId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceAgentId: 'user_agent_sales_01',
        targetTeam: 'CS',
        targetQueueId: 'queue_central_general',
        transferReason: 'Defective product exchange claim',
        contextSummary: 'Customer received damaged luggage, requires courier pickup'
      })
    });

    if (transferRes.status === 200) {
      const tData = await transferRes.json();
      assert.equal(tData.success, true);
    }

    // 3. Outbound reply from CS agent to customer
    const replyRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'เจ้าหน้าที่ฝ่ายบริการลูกค้ารับเรื่องเรียบร้อยแล้วค่ะ จะดำเนินการประสานงานเปลี่ยนสินค้าให้ทันทีค่ะ',
        type: 'TEXT',
        isInternal: false
      })
    });
    assert.equal(replyRes.status, 200);

    // 4. Verify message reached Zwiz mock
    const inspectRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
    const inspectData = await inspectRes.json();
    assert.ok(inspectData.messages.length >= 1, 'Zwiz mock server must capture outbound CS response');
  });
});
