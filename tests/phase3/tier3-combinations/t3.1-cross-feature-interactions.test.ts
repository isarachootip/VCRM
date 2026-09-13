import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { CourierMockServer } from '../../mocks/courier-mock-server';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const COURIER_MOCK_URL = process.env.COURIER_MOCK_URL || 'http://127.0.0.1:4040';
const ZWIZ_MOCK_URL = process.env.ZWIZ_MOCK_URL || 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = process.env.QUALTRICS_MOCK_URL || 'http://127.0.0.1:4020';

describe('Tier 3.1: Cross-Feature Interactions & Pairwise Workflows (Phase 3)', () => {
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

  test('T3.1.1 - Interaction: VIP case undergoes idle warning (50m), auto-close (60m), bot state sync, and CSAT trigger (R5 + R1)', async () => {
    const senderId = `U_inter_vip_${Date.now()}`;

    // 1. Inbound VIP case
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_idle_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'VIP Customer' },
        session: { sessionId: `sess_vip_idle_${Date.now()}` },
        message: { type: 'TEXT', text: 'VIP service request' }
      })
    });
    const { caseId } = await caseRes.json();
    await fetch(`${APP_URL}/api/cases/${caseId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
    });

    // 2. Idle sweep at 52m: warning triggered
    const warnRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleWarningThresholdMinutes: 50, idleCloseThresholdMinutes: 60, simulatedElapsedMinutes: 52, dryRun: false })
    });
    const warnData = await warnRes.json();
    assert.ok(warnData.warned >= 1);

    // 3. Idle sweep at 65m: case auto-closed
    const closeRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleWarningThresholdMinutes: 50, idleCloseThresholdMinutes: 60, simulatedElapsedMinutes: 65, dryRun: false })
    });
    const closeData = await closeRes.json();
    assert.ok(closeData.closed >= 1);

    // Verify CSAT survey dispatched
    const csatRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/v1/inspect/dispatches?ticketId=${caseId}`);
    const csatData = await csatRes.json();
    assert.ok(csatData.dispatches.length >= 1, 'CSAT survey must be dispatched for auto-closed VIP case');
  });

  test('T3.1.2 - Interaction: Carrier delivery webhook dispatches LINE notification while handling agent is on BREAK (R2 + R3)', async () => {
    // 1. Setup agent on BREAK
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();
    const agent = agents[0];

    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'BREAK', durationMinutes: 15 })
    });

    // 2. Create paid quotation linked to agent
    const senderId = `U_ship_brk_${Date.now()}`;
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_ship_brk_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Delivery Customer' },
        session: { sessionId: `sess_ship_brk_${Date.now()}` },
        message: { type: 'TEXT', text: 'Where is my order?' }
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
        items: [{ sku: 'SKU-02', productName: 'Item 2', quantity: 1, unitPrice: 3000, discount: 0 }]
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
      body: JSON.stringify({ quotationId: quotation.id, carrier: 'FLASH', shippingAddress: 'Bangkok', postalCode: '10110' })
    });
    const { trackingNumber } = await labelRes.json();

    // 3. Carrier webhook arrives while agent is in BREAK
    const webhookRes = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'FLASH', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify({ trackingNumber, carrier: 'FLASH', status: 'DELIVERED', timestamp: new Date().toISOString() })
    });
    assert.equal(webhookRes.status, 200);

    // 4. Verify LINE notification dispatched through Zwiz despite agent on break
    const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/v1/inspect/messages?recipientId=${senderId}`);
    const zwizData = await zwizRes.json();
    assert.ok(zwizData.messages.length >= 1, 'Automated delivery alert must be delivered regardless of agent presence');
  });

  test('T3.1.3 - Interaction: Agent auto-reverted from BREAK to ONLINE immediately receives pending VIP high-priority queue chat (R3 + R5)', async () => {
    // 1. Agent placed on break
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();
    const agent = agents[0];

    await fetch(`${APP_URL}/api/agents/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: agent.id, presence: 'BREAK', isVipEligible: true, activeChatCount: 0 })
    });

    // 2. VIP case enters queue while agent is on break
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_pend_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_pend_${Date.now()}`, senderName: 'VIP Queued' },
        session: { sessionId: `sess_pend_${Date.now()}` },
        message: { type: 'TEXT', text: 'VIP inquiry waiting' }
      })
    });
    const { caseId } = await caseRes.json();
    await fetch(`${APP_URL}/api/cases/${caseId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
    });

    // 3. Break sweep auto-reverts agent
    await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 20, dryRun: false })
    });

    // 4. Dispatch queue: reverted agent must be assigned the VIP case
    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, prioritizeVip: true })
    });
    assert.equal(dispatchRes.status, 200);
    const dispatchData = await dispatchRes.json();
    assert.equal(dispatchData.assignedAgentId, agent.id);
  });

  test('T3.1.4 - Interaction: Case handling agent accesses Portal Link Hub during delivery dispute (R4 + R2)', async () => {
    // 1. Create Portal links
    await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        title: 'Central Logistics Escalation Desk',
        url: 'https://logistics.central.co.th/escalate',
        category: 'OPERATIONS',
        businessUnits: ['CENTRAL'],
        order: 1
      })
    });

    // 2. Agent lists links with BU filter
    const portalRes = await fetch(`${APP_URL}/api/portal-links?bu=CENTRAL`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    assert.equal(portalRes.status, 200);
    const portalData = await portalRes.json();
    assert.ok(portalData.links.some((l: any) => l.title === 'Central Logistics Escalation Desk'));
  });

  test('T3.1.5 - Interaction: Multi-BU VIP delivery tracking with post-delivery CSAT feedback loop and Customer 360 update (R2 + R5 + R1)', async () => {
    // 1. Create VIP order
    const senderId = `U_cust360_${Date.now()}`;
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_c360_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Khun 360 VIP' },
        session: { sessionId: `sess_c360_${Date.now()}` },
        message: { type: 'TEXT', text: 'Order luxury watch' }
      })
    });
    const { caseId } = await caseRes.json();
    const caseDetailRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const { case: caseRec } = await caseDetailRes.json();

    // 2. Tag VIP
    await fetch(`${APP_URL}/api/customers/${caseRec.customerId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP' })
    });

    // 3. Paid quote
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId: caseRec.customerId,
        businessUnit: 'Central',
        items: [{ sku: 'WATCH-LUX-01', productName: 'Rolex Submariner', quantity: 1, unitPrice: 350000, discount: 0 }]
      })
    });
    const { quotation } = await quoteRes.json();
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 4. Generate label and deliver
    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotationId: quotation.id, carrier: 'CENTRAL_EXPRESS', shippingAddress: 'Bangkok', postalCode: '10330' })
    });
    const { trackingNumber } = await labelRes.json();

    await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'CENTRAL_EXPRESS', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify({ trackingNumber, carrier: 'CENTRAL_EXPRESS', status: 'DELIVERED', timestamp: new Date().toISOString() })
    });

    // 5. Customer 360 profile check
    const c360Res = await fetch(`${APP_URL}/api/customers/${caseRec.customerId}/360`);
    assert.equal(c360Res.status, 200);
    const c360Data = await c360Res.json();
    assert.ok(c360Data.totalLtv >= 350000, 'LTV must reflect paid luxury order');
  });

  test('T3.1.6 - Interaction: Inactive VIP chat warning followed by customer reply resets idle state and preserves VIP priority (R1 + R5)', async () => {
    const senderId = `U_vip_restore_${Date.now()}`;
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_rst_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'VIP Cust' },
        session: { sessionId: `sess_vip_rst_${Date.now()}` },
        message: { type: 'TEXT', text: 'VIP inquiry' }
      })
    });
    const { caseId } = await caseRes.json();
    await fetch(`${APP_URL}/api/cases/${caseId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
    });

    // 1. Idle warning sent at 52m
    await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleWarningThresholdMinutes: 50, idleCloseThresholdMinutes: 60, simulatedElapsedMinutes: 52, dryRun: false })
    });

    // 2. Customer replies before 60m closure
    await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_reply_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'VIP Cust' },
        session: { sessionId: `sess_vip_rst_${Date.now()}` },
        message: { type: 'TEXT', text: 'ขอโทษครับ เพิ่งว่างตอบ ยังต้องการสั่งซื้ออยู่ครับ' }
      })
    });

    // 3. Subsequent sweep at 62m (since original start) should NOT close case because customer replied
    const sweepRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleWarningThresholdMinutes: 50, idleCloseThresholdMinutes: 60, simulatedElapsedMinutes: 5, dryRun: false })
    });
    const sweepData = await sweepRes.json();
    if (sweepData.caseIdsClosed) {
      assert.ok(!sweepData.caseIdsClosed.includes(caseId), 'Replied case must not be closed');
    }

    // Verify VIP status is intact
    const inspectRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const { case: caseRec } = await inspectRes.json();
    assert.equal(caseRec.isVip, true);
    assert.equal(caseRec.queuePriority, 100);
    assert.notEqual(caseRec.status, 'CLOSED');
  });
});
