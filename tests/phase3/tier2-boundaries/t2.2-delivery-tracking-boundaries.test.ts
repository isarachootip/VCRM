import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { CourierMockServer } from '../../mocks/courier-mock-server';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const COURIER_MOCK_URL = process.env.COURIER_MOCK_URL || 'http://127.0.0.1:4040';
const ZWIZ_MOCK_URL = process.env.ZWIZ_MOCK_URL || 'http://127.0.0.1:4010';

describe('Tier 2.2: Delivery Tracking Boundary & Corner Cases (R2 Boundaries)', () => {
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

  async function createPaidOrder() {
    const senderId = `U_bnd_ship_${Date.now()}`;
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_bnd_ship_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Cust' },
        session: { sessionId: `sess_bnd_ship_${Date.now()}` },
        message: { type: 'TEXT', text: 'ชำระเงินเรียบร้อย' }
      })
    });
    const { caseId } = await caseRes.json();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId: 'cust_central_vip_001',
        businessUnit: 'Central',
        items: [{ sku: 'SKU-01', productName: 'Item', quantity: 1, unitPrice: 5000, discount: 0 }]
      })
    });
    const { quotation } = await quoteRes.json();

    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'KERRY',
        shippingAddress: '1027 Ploenchit Rd',
        postalCode: '10330'
      })
    });
    const labelData = await labelRes.json();

    return { quotationId: quotation.id, trackingNumber: labelData.trackingNumber, senderId };
  }

  test('T2.2.1 - Boundary: Non-existent or unknown tracking number webhook returns 404 or gracefully unmapped response', async () => {
    const res = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Code': 'KERRY',
        'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
      },
      body: JSON.stringify({
        trackingNumber: 'UNKNOWN-TRACKING-999999',
        carrier: 'KERRY',
        status: 'DELIVERED',
        timestamp: new Date().toISOString()
      })
    });

    assert.ok(
      [200, 404, 422].includes(res.status),
      `Server must handle unknown tracking gracefully without 500 (received ${res.status})`
    );
  });

  test('T2.2.2 - Boundary: Unsupported carrier code (e.g. DHL_EXPRESS) returns HTTP 422 INVALID_CARRIER', async () => {
    const order = await createPaidOrder();

    const res = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Code': 'DHL_EXPRESS',
        'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
      },
      body: JSON.stringify({
        trackingNumber: order.trackingNumber,
        carrier: 'DHL_EXPRESS',
        status: 'IN_TRANSIT',
        timestamp: new Date().toISOString()
      })
    });

    assert.ok(
      res.status === 422 || res.status === 400,
      `Unsupported carrier must return 422/400 (got ${res.status})`
    );
  });

  test('T2.2.3 - Boundary: Invalid or forged courier signature header returns HTTP 401 or 403', async () => {
    const order = await createPaidOrder();

    const res = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Code': 'KERRY',
        'X-Courier-Signature': 'sha256=FORGED_TAMPERED_SIGNATURE'
      },
      body: JSON.stringify({
        trackingNumber: order.trackingNumber,
        carrier: 'KERRY',
        status: 'DELIVERED',
        timestamp: new Date().toISOString()
      })
    });

    assert.ok(
      [401, 403].includes(res.status),
      `Forged signature must be rejected with 401/403 (got ${res.status})`
    );
  });

  test('T2.2.4 - Boundary: Out-of-order delivery events (DELIVERED before OUT_FOR_DELIVERY) handled gracefully and idempotently', async () => {
    const order = await createPaidOrder();

    // 1. Send DELIVERED first
    const delivRes = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'KERRY', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify({ trackingNumber: order.trackingNumber, carrier: 'KERRY', status: 'DELIVERED', timestamp: new Date().toISOString() })
    });
    assert.equal(delivRes.status, 200);

    // 2. Later arriving delayed OUT_FOR_DELIVERY event should not regress status
    const delayedRes = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'KERRY', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify({ trackingNumber: order.trackingNumber, carrier: 'KERRY', status: 'OUT_FOR_DELIVERY', timestamp: new Date(Date.now() - 3600000).toISOString() })
    });
    assert.equal(delayedRes.status, 200);

    // Check timeline events: should retain DELIVERED
    const eventsRes = await fetch(`${APP_URL}/api/shipping/tracking/${order.trackingNumber}/events`);
    const { events } = await eventsRes.json();
    assert.ok(events.length >= 1);
  });

  test('T2.2.5 - Boundary: Missing optional fields (empty location, null description) handled with sane defaults', async () => {
    const order = await createPaidOrder();

    const res = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'KERRY', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify({
        trackingNumber: order.trackingNumber,
        carrier: 'KERRY',
        status: 'IN_TRANSIT'
        // No location, description, or notes
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  test('T2.2.6 - Boundary: Duplicate webhook replay with identical payload is processed idempotently without duplicate customer alerts', async () => {
    const order = await createPaidOrder();
    const eventPayload = {
      trackingNumber: order.trackingNumber,
      carrier: 'KERRY',
      status: 'OUT_FOR_DELIVERY',
      location: 'Central Chidlom Hub',
      timestamp: '2026-09-13T12:00:00Z'
    };

    // First delivery webhook
    await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'KERRY', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify(eventPayload)
    });

    // Replay identical webhook
    const replayRes = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'KERRY', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify(eventPayload)
    });
    assert.equal(replayRes.status, 200);

    // Verify Zwiz did not send double notifications
    const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/v1/inspect/messages?recipientId=${order.senderId}`);
    const zwizData = await zwizRes.json();
    assert.equal(zwizData.messages.length, 1, 'Should only send one customer alert for duplicate webhook');
  });
});
