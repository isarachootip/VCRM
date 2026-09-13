import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { CourierMockServer } from '../../mocks/courier-mock-server';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const COURIER_MOCK_URL = process.env.COURIER_MOCK_URL || 'http://127.0.0.1:4040';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 3.7: Phase 2 Pairwise & Cross-Feature Integration Workflows', () => {
  let courierServer: CourierMockServer | null = null;

  before(async () => {
    await globalSupervisor.startAll();
    try {
      const check = await fetch(`${COURIER_MOCK_URL}/health`);
      if (!check.ok) throw new Error();
    } catch {
      courierServer = new CourierMockServer(4040);
      await courierServer.start();
    }
  });

  after(async () => {
    if (courierServer) await courierServer.stop();
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
    await fetch(`${COURIER_MOCK_URL}/mock/courier/control/reset`, { method: 'DELETE' });
  });

  test('T3.7.1 - End-to-End EOR Order Cycle: Inbound LINE -> MOST_AVAILABLE routing -> EOR fields -> Quote -> Payment Notification -> Kerry Thermal Label -> Webhook Delivery -> Customer 360', async () => {
    // 1. Inbound LINE chat
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_eor_flow_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_chidlom',
          pageName: 'Central Chidlom',
          businessUnit: 'Central',
          senderId: 'U_eor_flow_cust_01',
          senderName: 'Khun Thanin VIP'
        },
        session: { sessionId: `sess_eor_flow_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_eor_flow_${Date.now()}`, type: 'TEXT', text: 'สั่งซื้อสินค้า EOR สาขาชิดลมครับ' }
      })
    });
    const { caseId } = await inboundRes.json();

    // 2. Dispatch via MOST_AVAILABLE routing
    const routeRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, strategy: 'MOST_AVAILABLE' })
    });
    const routeData = await routeRes.json();
    assert.equal(routeData.success, true);
    assert.ok(routeData.assignedAgentId);

    // 3. Populate EOR fields
    const eorRes = await fetch(`${APP_URL}/api/cases/${caseId}/eor-fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'AGENT_EOR', 'x-user-team': 'EOR' },
      body: JSON.stringify({
        ticketNumber: 'TK-EOR-FLOW-001',
        sellingStoreName: 'Central Chidlom',
        sellingStoreStaffId: 'STF-CHIDLOM-VIP',
        metadata: { posTerminal: 'POS-02', lockerId: 'LOCKER-A01' }
      })
    });
    assert.equal(eorRes.status, 200);

    // 4. Create quotation
    const caseDetail = await (await fetch(`${APP_URL}/api/cases/${caseId}`)).json();
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId: caseDetail.customerId,
        businessUnit: 'Central',
        items: [{ sku: 'LUX-WATCH', productName: 'Luxury Watch', quantity: 1, unitPrice: 35000, discount: 0 }]
      })
    });
    const { quotation } = await quoteRes.json();

    // 5. Trigger automated payment notification
    await fetch(`${APP_URL}/api/notifications/payment-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'QUOTATION_CREATED', quotationId: quotation.id })
    });

    // 6. Transition quotation to PAID
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 7. Generate Kerry Express thermal shipping label
    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'KERRY',
        shippingAddress: '1027 Ploenchit Rd, Bangkok 10330',
        postalCode: '10330',
        recipientName: 'Khun Thanin VIP',
        recipientPhone: '0812345678',
        parcelWeightKg: 1.2
      })
    });
    assert.equal(labelRes.status, 201);
    const { trackingNumber } = await labelRes.json();
    assert.match(trackingNumber, /^KEX\d{9}TH$/);

    // 8. Courier delivers parcel
    const webhookRes = await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/simulate/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber,
        status: 'DELIVERED',
        statusCode: 'DLV',
        location: 'Bangkok Chidlom Hub',
        crmWebhookUrl: `${APP_URL}/api/webhooks/shipping`
      })
    });
    assert.equal(webhookRes.status, 200);

    // 9. Customer 360 profile verification
    const c360Res = await fetch(`${APP_URL}/api/customers/${caseDetail.customerId}/360`);
    const c360 = await c360Res.json();
    assert.equal(c360.totalLtv, 35000);
    assert.equal(c360.totalOrders, 1);
    assert.ok(c360.loyaltyTier === 'GOLD' || c360.loyaltyTier === 'PLATINUM');
  });

  test('T3.7.2 - SLA Escalation & Payment Recovery: Inactivity flags -> Supervisor shares promo -> Customer resumes and completes payment', async () => {
    // 1. Inbound chat
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_sla_flow_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_beauty_club',
          businessUnit: 'Central Beauty Club',
          senderId: 'U_sla_recovery_cust',
          senderName: 'Khun Pim'
        },
        session: { sessionId: `sess_sla_flow_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_sla_flow_${Date.now()}`, type: 'TEXT', text: 'สนใจแป้งฝุ่นลอร่าครับ' }
      })
    });
    const { caseId } = await inboundRes.json();

    // 2. Customer goes silent for 35 minutes
    const evalRes = await fetch(`${APP_URL}/api/cases/sla/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, elapsedMinutes: 35 })
    });
    const evalData = await evalRes.json();
    assert.ok(evalData.flagged.some((f: any) => f.caseId === caseId && f.pendingFlag === 'PENDING_30MIN'));

    // 3. Supervisor quick-shares BEAUTY10 promo coupon card to re-engage
    const shareRes = await fetch(`${APP_URL}/api/promotions/BEAUTY10/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, recipientId: 'U_sla_recovery_cust' })
    });
    assert.equal(shareRes.status, 200);

    // 4. Customer replies to chat
    await fetch(`${APP_URL}/api/chat/outbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: 'U_sla_recovery_cust',
        text: 'ขอใช้คูปอง BEAUTY10 เลยครับ',
        channel: 'LINE'
      })
    });

    // 5. Verify pending inactivity flag is cleared
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.pendingFlag, undefined, 'Pending flag must clear upon customer reply');
  });

  test('T3.7.3 - Central Express Same-Day Luxury Delivery & Omnichannel Identity Resolution', async () => {
    // 1. Customer initiates via LINE
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_ctx_flow_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_chidlom',
          businessUnit: 'Central',
          senderId: 'U_ctx_luxury_cust',
          senderName: 'Khun Ananda'
        },
        session: { sessionId: `sess_ctx_flow_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_ctx_${Date.now()}`, type: 'TEXT', text: 'สั่งซื้อกระเป๋าแบรนด์เนม ด่วน 3 ชม. ครับ' }
      })
    });
    const { caseId } = await inboundRes.json();
    const caseDetail = await (await fetch(`${APP_URL}/api/cases/${caseId}`)).json();

    // 2. Link customer identities across Facebook and Phone
    const linkRes = await fetch(`${APP_URL}/api/customers/${caseDetail.customerId}/identities/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fbPsid: 'FB_LUXURY_ANANDA_007',
        phone: '0817779999'
      })
    });
    assert.equal(linkRes.status, 200);

    // 3. Create and pay quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId: caseDetail.customerId,
        businessUnit: 'Central',
        items: [{ sku: 'LUX-BAG', productName: 'Designer Handbag', quantity: 1, unitPrice: 75000, discount: 0 }]
      })
    });
    const { quotation } = await quoteRes.json();
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 4. Generate Central Express same-day delivery tracking
    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'CENTRAL_EXPRESS',
        shippingAddress: '1027 Ploenchit Rd, Bangkok 10330',
        postalCode: '10330',
        recipientName: 'Khun Ananda VIP',
        recipientPhone: '0817779999',
        parcelWeightKg: 0.9
      })
    });
    assert.equal(labelRes.status, 201);
    const { trackingNumber } = await labelRes.json();
    assert.match(trackingNumber, /^CTX\d{8}TH$/);

    // 5. Courier milestone progression
    await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/simulate/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber,
        status: 'IN_TRANSIT',
        location: 'Ploenchit Central Hub',
        crmWebhookUrl: `${APP_URL}/api/webhooks/shipping`
      })
    });
    await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/simulate/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber,
        status: 'DELIVERED',
        location: 'Delivered to recipient',
        crmWebhookUrl: `${APP_URL}/api/webhooks/shipping`
      })
    });

    // 6. Verify tracking history from courier endpoint
    const trackRes = await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/tracking/${trackingNumber}`);
    assert.equal(trackRes.status, 200);
    const trackData = await trackRes.json();
    assert.equal(trackData.status, 'DELIVERED');
    assert.ok(trackData.events.length >= 2);
  });
});
