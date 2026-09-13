import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 1.20: Interactive Zwiz Templates & Automated Payment Notifications (R3 / Phase 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createTestInboundCase() {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store',
          businessUnit: 'Central',
          senderId: `U_tmpl_cust_${Date.now()}`,
          senderName: 'Khun Interactive'
        },
        session: { sessionId: `sess_tmpl_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'ขอดูแคตตาล็อกสินค้าหน่อยครับ' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.20.1 - Outbound dispatcher formats and transmits valid BUTTONS template card to Zwiz mock', async () => {
    const caseId = await createTestInboundCase();

    const sendRes = await fetch(`${APP_URL}/api/templates/interactive/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        templateType: 'BUTTONS',
        title: 'โปรโมชั่นพิเศษ Dyson V12',
        subtitle: 'รับส่วนลดทันที 1,000 บาท เมื่อสั่งซื้อวันนี้',
        actions: [
          { type: 'URI', label: 'สั่งซื้อทันที', url: 'https://pay.central.co.th/item/DYS-V12' },
          { type: 'POSTBACK', label: 'ขอใบเสนอราคา', data: 'action=request_quote&item=DYS-V12' }
        ]
      })
    });

    assert.equal(sendRes.status, 200);
    const sendData = await sendRes.json();
    assert.equal(sendData.success, true);
    assert.ok(sendData.messageId);

    // Verify stored in Zwiz mock server inspection store
    const inspectRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/templates?templateType=BUTTONS`);
    const inspectData = await inspectRes.json();
    assert.ok(inspectData.total >= 1, 'Zwiz mock must capture the BUTTONS template');
  });

  test('T1.20.2 - Outbound message with QUICK_REPLIES options delivers successfully to Zwiz mock', async () => {
    const caseId = await createTestInboundCase();

    const sendRes = await fetch(`${APP_URL}/api/templates/interactive/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        templateType: 'QUICK_REPLIES',
        title: 'ช่องทางการจัดส่ง',
        subtitle: 'กรุณาเลือกช่องทางการจัดส่งที่ท่านสะดวกค่ะ',
        quickReplies: [
          { label: 'Kerry Express', action: 'POSTBACK', data: 'carrier=KERRY' },
          { label: 'Flash Express', action: 'POSTBACK', data: 'carrier=FLASH' },
          { label: 'รับที่สาขาชิดลม', action: 'POSTBACK', data: 'pickup=CHIDLOM' }
        ]
      })
    });

    assert.equal(sendRes.status, 200);

    const inspectRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/templates?templateType=QUICK_REPLIES`);
    const inspectData = await inspectRes.json();
    assert.ok(inspectData.total >= 1, 'Zwiz mock must capture the QUICK_REPLIES template');
  });

  test('T1.20.3 - Multi-card CAROUSEL template serializes and delivers with uniform action count', async () => {
    const caseId = await createTestInboundCase();

    const sendRes = await fetch(`${APP_URL}/api/templates/interactive/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        templateType: 'CAROUSEL',
        columns: [
          {
            title: 'Lancôme Advanced Génifique',
            text: 'เซรั่มฟื้นบำรุงผิว 50ml ราคา 4,500 บาท',
            actions: [{ type: 'URI', label: 'ช้อปเลย', url: 'https://pay.central.co.th/item/LAN-01' }]
          },
          {
            title: 'Estée Lauder ANR Synchronized',
            text: 'เซรั่มฟื้นบำรุงผิวกลางคืน 50ml ราคา 4,800 บาท',
            actions: [{ type: 'URI', label: 'ช้อปเลย', url: 'https://pay.central.co.th/item/EL-01' }]
          }
        ]
      })
    });

    assert.equal(sendRes.status, 200);

    const inspectRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/templates?templateType=CAROUSEL`);
    const inspectData = await inspectRes.json();
    assert.ok(inspectData.total >= 1, 'Zwiz mock must capture the CAROUSEL template');
  });

  test('T1.20.4 - Quotation creation automatically dispatches payment link button card to customer', async () => {
    const caseId = await createTestInboundCase();

    // Create quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId: 'cust_central_vip_001',
        businessUnit: 'Central',
        items: [
          { sku: 'DYS-V12', productName: 'Dyson V12', quantity: 1, unitPrice: 20000, discount: 0 }
        ]
      })
    });
    const quoteData = await quoteRes.json();
    const quotationId = quoteData.quotation.id;

    // Trigger payment event pipeline for quotation created
    const notifRes = await fetch(`${APP_URL}/api/notifications/payment-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'QUOTATION_CREATED',
        quotationId
      })
    });

    assert.equal(notifRes.status, 200);
    const notifData = await notifRes.json();
    assert.equal(notifData.success, true);
    assert.equal(notifData.event, 'QUOTATION_CREATED');

    // Verify payment card was captured by Zwiz
    const inspectRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/templates?templateType=PAYMENT_LINK`);
    const inspectData = await inspectRes.json();
    assert.ok(inspectData.total >= 1, 'Payment link template must be recorded in Zwiz mock');
  });

  test('T1.20.5 - Verified payment callback dispatches order confirmation card with summary', async () => {
    const caseId = await createTestInboundCase();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId: 'cust_central_vip_001',
        businessUnit: 'Central',
        items: [
          { sku: 'MUJI-SHIRT', productName: 'Linen Shirt', quantity: 2, unitPrice: 990, discount: 0 }
        ]
      })
    });
    const { quotation } = await quoteRes.json();

    // Transition to PAID
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // Send confirmation event
    const notifRes = await fetch(`${APP_URL}/api/notifications/payment-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'PAYMENT_CONFIRMED',
        quotationId: quotation.id
      })
    });

    assert.equal(notifRes.status, 200);
    const notifData = await notifRes.json();
    assert.equal(notifData.event, 'PAYMENT_CONFIRMED');

    const inspectRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/templates?templateType=PAYMENT_CONFIRMATION`);
    const inspectData = await inspectRes.json();
    assert.ok(inspectData.total >= 1, 'Payment confirmation template must be recorded in Zwiz mock');
  });
});
