import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { CourierMockServer } from '../../mocks/courier-mock-server';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const COURIER_MOCK_URL = process.env.COURIER_MOCK_URL || 'http://127.0.0.1:4040';

describe('Tier 2.9: Phase 2 Boundaries, Edge Conditions & Adversarial Guards', () => {
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

  async function createPaidQuotation() {
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_bnd_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_chidlom', businessUnit: 'Central', senderId: `U_bnd_${Date.now()}` },
        session: { sessionId: `sess_bnd_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Boundary test' }
      })
    });
    const { caseId } = await caseRes.json();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [{ sku: 'PROD-BND', unitPrice: 12000, quantity: 1 }]
      })
    });
    const { quotation } = await quoteRes.json();

    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    return quotation;
  }

  test('T2.9.1 - Shipping label generation with incomplete address returns HTTP 400 INCOMPLETE_ADDRESS', async () => {
    const quote = await createPaidQuotation();

    const res = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quote.id,
        carrier: 'KERRY',
        shippingAddress: '', // Empty address
        postalCode: '',      // Empty postal code
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INCOMPLETE_ADDRESS');
  });

  test('T2.9.2 - Shipping label generation with 0 or negative weight returns HTTP 400 INVALID_WEIGHT', async () => {
    const quote = await createPaidQuotation();

    const res = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quote.id,
        carrier: 'FLASH',
        shippingAddress: '1027 Ploenchit Rd, Bangkok',
        postalCode: '10330',
        parcelWeightKg: -1.5, // Negative weight
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_WEIGHT');
  });

  test('T2.9.3 - Invalid courier carrier code rejected with HTTP 422 INVALID_CARRIER', async () => {
    const quote = await createPaidQuotation();

    const res = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quote.id,
        carrier: 'DHL_EXPRESS', // Unsupported carrier
        shippingAddress: '1027 Ploenchit Rd, Bangkok',
        postalCode: '10330',
        parcelWeightKg: 1.0,
      })
    });

    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_CARRIER');
  });

  test('T2.9.4 - Thermal 4x6 label layout constraint validation (exact 100mm 150mm dimension metadata)', async () => {
    const quote = await createPaidQuotation();

    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quote.id,
        carrier: 'KERRY',
        shippingAddress: '1027 Ploenchit Rd, Bangkok',
        postalCode: '10330',
        parcelWeightKg: 1.5,
      })
    });
    const { trackingNumber } = await labelRes.json();

    const jsonRes = await fetch(`${APP_URL}/api/shipping/labels/${trackingNumber}?format=json`);
    assert.equal(jsonRes.status, 200);
    const meta = await jsonRes.json();
    assert.equal(meta.dimensions.widthMm, 100);
    assert.equal(meta.dimensions.heightMm, 150);
    assert.equal(meta.format, 'thermal_4x6');
  });

  test('T2.9.5 - Routing full-capacity pool: all agents saturated -> case queued without crashing', async () => {
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();

    // Mark all agents capacity 0 (fully saturated)
    for (const a of agents) {
      await fetch(`${APP_URL}/api/agents/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: a.id, presence: 'ONLINE', maxConcurrentChats: 0 })
      });
    }

    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: 'MOST_AVAILABLE' })
    });

    assert.equal(dispatchRes.status, 200);
    const data = await dispatchRes.json();
    assert.equal(data.assignedAgentId, null);
    assert.equal(data.status, 'QUEUED');
  });

  test('T2.9.6 - Customer 360 profile with zero paid orders computes LTV 0.00 and AOV 0.00 without divide-by-zero', async () => {
    // Inbound case without any quotations
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_zero_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_chidlom', businessUnit: 'Central', senderId: `U_zero_${Date.now()}` },
        session: { sessionId: `sess_zero_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Just asking' }
      })
    });
    const { caseId } = await caseRes.json();
    const caseDetail = await (await fetch(`${APP_URL}/api/cases/${caseId}`)).json();

    const res = await fetch(`${APP_URL}/api/customers/${caseDetail.customerId}/360`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.totalOrders, 0);
    assert.equal(data.totalLtv, 0);
    assert.equal(data.aov, 0);
    assert.equal(data.loyaltyTier, 'BRONZE');
  });

  test('T2.9.7 - Frontline role mutation on promotions rejected with HTTP 403 Forbidden', async () => {
    const res = await fetch(`${APP_URL}/api/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'AGENT_SALES' },
      body: JSON.stringify({
        promoCode: 'ILLEGAL_COUPON',
        title: 'Illegal Coupon',
        discountValue: 100,
      })
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'PROMOTION_MUTATION_RESTRICTED');
  });
});
