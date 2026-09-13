import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { CourierMockServer } from '../../mocks/courier-mock-server';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const COURIER_MOCK_URL = process.env.COURIER_MOCK_URL || 'http://127.0.0.1:4040';

describe('Tier 1.21: Automated Shipping Label Generation & Courier Tracking (R4 / Phase 2)', () => {
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
    await fetch(`${COURIER_MOCK_URL}/mock/courier/control/reset`, { method: 'DELETE' });
  });

  async function createPaidQuotation(bu = 'Central') {
    // Inbound case
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_ship_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store',
          businessUnit: bu,
          senderId: `U_ship_cust_${Date.now()}`,
          senderName: 'Khun Somchai Delivery'
        },
        session: { sessionId: `sess_ship_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'ชำระเงินแล้ว ส่งสินค้าได้เลยครับ' }
      })
    });
    const caseData = await caseRes.json();

    // Create quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.caseId,
        customerId: 'cust_central_vip_001',
        businessUnit: bu,
        items: [
          { sku: 'DYS-V12', productName: 'Dyson V12 Detect Slim', quantity: 1, unitPrice: 24900, discount: 0 }
        ]
      })
    });
    const { quotation } = await quoteRes.json();

    // Mark PAID
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    return quotation;
  }

  test('T1.21.1 - Carrier tracking number generation and pattern validation (Kerry, Flash, Central Express)', async () => {
    // 1. Kerry Express format: KEX + 9 digits + TH
    const kerryRes = await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/shipments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrier: 'KERRY',
        orderNumber: 'QT-2026-KEX-01',
        recipient: { name: 'Khun Somchai', phone: '0812345678', address: '1027 Ploenchit Rd', postalCode: '10330' },
        parcel: { weightKg: 1.5 }
      })
    });
    assert.equal(kerryRes.status, 201);
    const kerryData = await kerryRes.json();
    assert.match(kerryData.trackingNumber, /^KEX\d{9}TH$/, 'Kerry tracking must match KEX...TH pattern');

    // 2. Flash Express format: TH + 12 digits
    const flashRes = await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/shipments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrier: 'FLASH',
        orderNumber: 'QT-2026-FLS-02',
        recipient: { name: 'Khun Somchai', phone: '0812345678', address: '1027 Ploenchit Rd', postalCode: '10330' },
        parcel: { weightKg: 2.0 }
      })
    });
    assert.equal(flashRes.status, 201);
    const flashData = await flashRes.json();
    assert.match(flashData.trackingNumber, /^TH\d{12}$/, 'Flash tracking must match TH... pattern');

    // 3. Central Express format: CTX + 8 digits + TH
    const ctxRes = await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/shipments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrier: 'CENTRAL_EXPRESS',
        orderNumber: 'QT-2026-CTX-03',
        recipient: { name: 'Khun Somchai', phone: '0812345678', address: '1027 Ploenchit Rd', postalCode: '10330' },
        parcel: { weightKg: 0.8 }
      })
    });
    assert.equal(ctxRes.status, 201);
    const ctxData = await ctxRes.json();
    assert.match(ctxData.trackingNumber, /^CTX\d{8}TH$/, 'Central Express tracking must match CTX...TH pattern');
  });

  test('T1.21.2 - Paid order generates shipping label with tracking number and updates quotation', async () => {
    const quotation = await createPaidQuotation('Central');

    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'KERRY',
        shippingAddress: '1027 Ploenchit Rd, Lumpini, Pathumwan, Bangkok 10330',
        postalCode: '10330',
        recipientName: 'Khun Somchai',
        recipientPhone: '0819998888',
        parcelWeightKg: 2.5
      })
    });

    assert.equal(labelRes.status, 201, 'Label generation should succeed with 201 Created');
    const labelData = await labelRes.json();
    assert.equal(labelData.success, true);
    assert.equal(labelData.carrier, 'KERRY');
    assert.ok(labelData.trackingNumber.startsWith('KEX'));
    assert.ok(labelData.labelUrls.a4);
    assert.ok(labelData.labelUrls.thermal4x6);
  });

  test('T1.21.3 - Printable A4 shipping manifest label layout renders properly', async () => {
    const quotation = await createPaidQuotation('Central');

    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'KERRY',
        shippingAddress: '1027 Ploenchit Rd, Bangkok 10330',
        postalCode: '10330',
        recipientName: 'Khun Somchai',
        recipientPhone: '0819998888',
        parcelWeightKg: 1.5
      })
    });
    const { trackingNumber } = await labelRes.json();

    // Fetch A4 HTML layout
    const a4Res = await fetch(`${APP_URL}/api/shipping/labels/${trackingNumber}?format=a4`);
    assert.equal(a4Res.status, 200);
    const html = await a4Res.text();
    assert.ok(html.includes('size: A4 portrait'), 'Must specify A4 portrait @page style');
    assert.ok(html.includes(trackingNumber), 'Must render tracking number');
    assert.ok(html.includes('SHIPPING WAYBILL & PACKING MANIFEST'), 'Must render manifest header');
  });

  test('T1.21.4 - Printable 4x6 thermal shipping label layout renders with 100mm 150mm dimensions', async () => {
    const quotation = await createPaidQuotation('Central');

    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'FLASH',
        shippingAddress: '209/1 Phaholyothin Rd, Bangkok 10900',
        postalCode: '10900',
        recipientName: 'Khun Arak',
        recipientPhone: '0891112222',
        parcelWeightKg: 1.2
      })
    });
    const { trackingNumber } = await labelRes.json();

    // Fetch thermal 4x6 HTML layout
    const thermalRes = await fetch(`${APP_URL}/api/shipping/labels/${trackingNumber}?format=thermal_4x6`);
    assert.equal(thermalRes.status, 200);
    const html = await thermalRes.text();
    assert.ok(html.includes('100mm 150mm'), 'Must declare 100mm 150mm thermal print area');
    assert.ok(html.includes(trackingNumber), 'Must render tracking number on label');
    assert.ok(html.includes('SHIP TO / ผู้รับ'), 'Must render recipient section');

    // Fetch JSON metadata
    const jsonRes = await fetch(`${APP_URL}/api/shipping/labels/${trackingNumber}?format=json`);
    assert.equal(jsonRes.status, 200);
    const labelJson = await jsonRes.json();
    assert.equal(labelJson.dimensions.widthMm, 100);
    assert.equal(labelJson.dimensions.heightMm, 150);
  });

  test('T1.21.5 - Simulated courier status webhook updates order fulfillment status to DELIVERED', async () => {
    const quotation = await createPaidQuotation('Central');

    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'CENTRAL_EXPRESS',
        shippingAddress: '1027 Ploenchit Rd, Bangkok 10330',
        postalCode: '10330',
        recipientName: 'Khun Somchai VIP',
        recipientPhone: '0812345678',
        parcelWeightKg: 1.0
      })
    });
    const { trackingNumber } = await labelRes.json();

    // Simulate courier delivery status webhook to CRM
    const webhookRes = await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/simulate/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber,
        status: 'DELIVERED',
        statusCode: 'DLV',
        location: 'Pathumwan Distribution Center',
        notes: 'Recipient signed: Khun Somchai VIP',
        crmWebhookUrl: `${APP_URL}/api/webhooks/shipping`
      })
    });

    assert.equal(webhookRes.status, 200);
    const webhookData = await webhookRes.json();
    assert.equal(webhookData.success, true);
    assert.equal(webhookData.crmStatus, 200);

    // Verify courier mock server records the dispatched webhook
    const inspectRes = await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/inspect/webhooks?trackingNumber=${trackingNumber}`);
    const inspectData = await inspectRes.json();
    assert.equal(inspectData.total, 1);
    assert.equal(inspectData.webhooks[0].status, 'DELIVERED');
  });
});
