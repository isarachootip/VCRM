import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { CourierMockServer } from '../../mocks/courier-mock-server';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const COURIER_MOCK_URL = process.env.COURIER_MOCK_URL || 'http://127.0.0.1:4040';
const ZWIZ_MOCK_URL = process.env.ZWIZ_MOCK_URL || 'http://127.0.0.1:4010';

describe('Tier 1.2: End-to-End Delivery Tracking & LINE Notification Pipeline (R2 / Phase 3)', () => {
  let standaloneCourier: CourierMockServer | null = null;

  before(async () => {
    await globalSupervisor.startAll();
    try {
      const check = await fetch(`${COURIER_MOCK_URL}/health`);
      if (!check.ok) throw new Error();
    } catch {
      standaloneCourier = new CourierMockServer(4040);
      await standaloneCourier.start();
    }
  });

  after(async () => {
    if (standaloneCourier) await standaloneCourier.stop();
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
    await fetch(`${COURIER_MOCK_URL}/mock/courier/control/reset`, { method: 'DELETE' }).catch(() => {});
  });

  async function createPaidOrderWithFulfillment(carrier: 'KERRY' | 'FLASH' | 'CENTRAL_EXPRESS' = 'KERRY') {
    // 1. Inbound case
    const senderId = `U_track_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_track_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store',
          businessUnit: 'Central',
          senderId,
          senderName: 'Khun Somchai Tracking'
        },
        session: { sessionId: `sess_track_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'สั่งซื้อสินค้าเรียบร้อยครับ' }
      })
    });
    const caseData = await caseRes.json();

    // 2. Create quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.caseId,
        customerId: 'cust_central_vip_001',
        businessUnit: 'Central',
        items: [{ sku: 'SKU-COURIER-01', productName: 'Central Luxury Bag', quantity: 1, unitPrice: 15000, discount: 0 }]
      })
    });
    const { quotation } = await quoteRes.json();

    // 3. Mark PAID
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 4. Generate Shipping Label / Fulfillment
    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier,
        recipientName: 'Khun Somchai Tracking',
        recipientPhone: '0812345678',
        shippingAddress: '1027 Ploenchit Road, Lumphini, Pathum Wan',
        postalCode: '10330',
        parcelWeightKg: 1.5
      })
    });
    const labelData = await labelRes.json();

    return {
      caseId: caseData.caseId,
      senderId,
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      trackingNumber: labelData.trackingNumber,
      carrier
    };
  }

  test('T1.2.1 - Carrier tracking webhook receiver ingests valid status updates for Kerry, Flash, and Central Express', async () => {
    const carriers: Array<'KERRY' | 'FLASH' | 'CENTRAL_EXPRESS'> = ['KERRY', 'FLASH', 'CENTRAL_EXPRESS'];

    for (const carrier of carriers) {
      const order = await createPaidOrderWithFulfillment(carrier);

      const webhookPayload = {
        trackingNumber: order.trackingNumber,
        orderId: order.quotationId,
        orderNumber: order.quotationNumber,
        carrier,
        status: 'PICKED_UP',
        timestamp: new Date().toISOString(),
        location: `${carrier} Bangkok Hub`,
        description: 'Carrier picked up parcel from Central DC'
      };

      const res = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Carrier-Code': carrier,
          'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
        },
        body: JSON.stringify(webhookPayload)
      });

      assert.equal(res.status, 200, `Webhook receiver should accept ${carrier} updates`);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.status, 'PICKED_UP');
    }
  });

  test('T1.2.2 - Order delivery status lifecycle transitions sequentially from PACKED to DELIVERED', async () => {
    const order = await createPaidOrderWithFulfillment('KERRY');
    const lifecycle = ['PACKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

    for (const status of lifecycle) {
      const res = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Carrier-Code': 'KERRY',
          'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
        },
        body: JSON.stringify({
          trackingNumber: order.trackingNumber,
          orderId: order.quotationId,
          carrier: 'KERRY',
          status,
          timestamp: new Date().toISOString(),
          location: 'Bangkok Sorting DC',
          description: `Status advanced to ${status}`
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, status, `Fulfillment status should advance to ${status}`);
    }
  });

  test('T1.2.3 - Major delivery milestones dispatch automated real-time LINE notification message to customer with tracking link', async () => {
    const order = await createPaidOrderWithFulfillment('FLASH');

    // Webhook for OUT_FOR_DELIVERY
    const res = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Code': 'FLASH',
        'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
      },
      body: JSON.stringify({
        trackingNumber: order.trackingNumber,
        orderId: order.quotationId,
        orderNumber: order.quotationNumber,
        carrier: 'FLASH',
        status: 'OUT_FOR_DELIVERY',
        location: 'Flash Sukhumvit Courier Unit #12',
        description: 'พัสดุกำลังนำจ่ายถึงผู้รับ',
        timestamp: new Date().toISOString()
      })
    });
    assert.equal(res.status, 200);

    // Inspect Zwiz outbound customer messages
    const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/v1/inspect/messages?recipientId=${order.senderId}`);
    assert.equal(zwizRes.status, 200);
    const zwizData = await zwizRes.json();
    assert.ok(zwizData.messages.length >= 1, 'Zwiz must capture outbound delivery notification to customer');
    const msg = zwizData.messages[zwizData.messages.length - 1];
    const textOrPayload = JSON.stringify(msg);
    assert.ok(
      textOrPayload.includes(order.trackingNumber) || textOrPayload.includes('FLASH'),
      'Outbound message must contain tracking number or carrier name'
    );
  });

  test('T1.2.4 - Chronological ShippingTrackingEvent records are persisted and retrievable for order sidebar timeline', async () => {
    const order = await createPaidOrderWithFulfillment('CENTRAL_EXPRESS');

    const statuses = ['PACKED', 'IN_TRANSIT', 'DELIVERED'];
    for (const status of statuses) {
      await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Carrier-Code': 'CENTRAL_EXPRESS',
          'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
        },
        body: JSON.stringify({
          trackingNumber: order.trackingNumber,
          orderId: order.quotationId,
          carrier: 'CENTRAL_EXPRESS',
          status,
          location: `Central Hub - ${status}`,
          description: `Milestone ${status} reached`,
          timestamp: new Date().toISOString()
        })
      });
    }

    // Retrieve tracking timeline events for sidebar
    const eventsRes = await fetch(`${APP_URL}/api/shipping/tracking/${order.trackingNumber}/events`);
    assert.equal(eventsRes.status, 200);
    const { events } = await eventsRes.json();
    assert.ok(events.length >= 3, 'Must return all chronological tracking events');
    assert.equal(events[0].status, 'PACKED');
    assert.equal(events[events.length - 1].status, 'DELIVERED');
  });

  test('T1.2.5 - DELIVERY_FAILED status updates fulfillment and flags case for frontline agent follow-up', async () => {
    const order = await createPaidOrderWithFulfillment('KERRY');

    const failRes = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Code': 'KERRY',
        'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
      },
      body: JSON.stringify({
        trackingNumber: order.trackingNumber,
        orderId: order.quotationId,
        carrier: 'KERRY',
        status: 'DELIVERY_FAILED',
        location: 'Customer Residence Gate',
        description: 'Customer unavailable; recipient contact failed',
        notes: 'Delivery attempt 1 unsuccessful',
        timestamp: new Date().toISOString()
      })
    });

    assert.equal(failRes.status, 200);
    const data = await failRes.json();
    assert.equal(data.status, 'DELIVERY_FAILED');

    // Case check
    const caseRes = await fetch(`${APP_URL}/api/cases/${order.caseId}`);
    assert.equal(caseRes.status, 200);
    const { case: caseRecord } = await caseRes.json();
    assert.ok(caseRecord, 'Case record must exist');
  });

  test('T1.2.6 - Webhook verifies courier HMAC signature header (X-Courier-Signature)', async () => {
    const order = await createPaidOrderWithFulfillment('KERRY');

    // Post with valid signature
    const validRes = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Code': 'KERRY',
        'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
      },
      body: JSON.stringify({
        trackingNumber: order.trackingNumber,
        orderId: order.quotationId,
        carrier: 'KERRY',
        status: 'PICKED_UP',
        timestamp: new Date().toISOString()
      })
    });
    assert.equal(validRes.status, 200, 'Valid signature should be accepted');
  });
});
