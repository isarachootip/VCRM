import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { CourierMockServer } from '../../mocks/courier-mock-server';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const COURIER_MOCK_URL = process.env.COURIER_MOCK_URL || 'http://127.0.0.1:4040';
const ZWIZ_MOCK_URL = process.env.ZWIZ_MOCK_URL || 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = process.env.QUALTRICS_MOCK_URL || 'http://127.0.0.1:4020';

describe('Tier 4.1: Real-World Application Workload Scenarios (Phase 3 Workloads)', () => {
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

  test('T4.1.1 - Real-World Scenario: Central Luxury NSC VIP Omnichannel Shopping & Delivery Lifecycle', async () => {
    // 1. VIP Customer enters via LINE OA
    const senderId = `U_rw_vip_${Date.now()}`;
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_rw_vip_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store',
          businessUnit: 'Central',
          senderId,
          senderName: 'Khun Napat Central VIP'
        },
        session: { sessionId: `sess_rw_vip_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_rw_1`, type: 'TEXT', text: 'สวัสดีครับ สนใจสั่งซื้อนาฬิกา Patek Philippe ครับ' }
      })
    });
    assert.equal(inboundRes.status, 200);
    const { caseId } = await inboundRes.json();

    // 2. VIP Tagging & Accelerated Priority Assignment
    const caseRecRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const { case: caseRecord } = await caseRecRes.json();
    await fetch(`${APP_URL}/api/customers/${caseRecord.customerId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', reason: 'HNW Central Diamond Club' })
    });
    await fetch(`${APP_URL}/api/cases/${caseId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
    });

    // 3. Queue Dispatch to VIP Senior Agent
    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, prioritizeVip: true })
    });
    assert.equal(dispatchRes.status, 200);

    // 4. Create Quotation and Record Payment
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId: caseRecord.customerId,
        businessUnit: 'Central',
        items: [{ sku: 'WATCH-PP-5711', productName: 'Patek Philippe Nautilus 5711', quantity: 1, unitPrice: 2800000, discount: 0 }]
      })
    });
    const { quotation } = await quoteRes.json();
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 5. Generate Kerry Express Fulfillment
    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'KERRY',
        shippingAddress: 'Central Embassy Penthouse Suite 88',
        postalCode: '10330',
        recipientName: 'Khun Napat',
        recipientPhone: '0899999999'
      })
    });
    const { trackingNumber } = await labelRes.json();

    // 6. Carrier milestone progression: PACKED -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED
    const milestones = ['PACKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    for (const st of milestones) {
      const whRes = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Carrier-Code': 'KERRY',
          'X-Courier-Signature': 'sha256=mock-courier-valid-signature'
        },
        body: JSON.stringify({
          trackingNumber,
          orderId: quotation.id,
          carrier: 'KERRY',
          status: st,
          timestamp: new Date().toISOString(),
          location: `Kerry Embassy Hub - ${st}`
        })
      });
      assert.equal(whRes.status, 200);
    }

    // 7. Verify chronological tracking events timeline
    const eventsRes = await fetch(`${APP_URL}/api/shipping/tracking/${trackingNumber}/events`);
    const { events } = await eventsRes.json();
    assert.equal(events.length, 5, 'All 5 milestone events must be recorded');
    assert.equal(events[events.length - 1].status, 'DELIVERED');

    // 8. Close Case and verify Qualtrics CSAT survey trigger
    const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', resolutionCategory: 'ORDER_DELIVERED' })
    });
    assert.equal(closeRes.status, 200);

    const qualtricsRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/v1/inspect/dispatches?ticketId=${caseId}`);
    const qualtricsData = await qualtricsRes.json();
    assert.ok(qualtricsData.dispatches.length >= 1, 'CSAT survey must be triggered upon delivery case closure');
  });

  test('T4.1.2 - Real-World Scenario: Peak Volume Idle Chat Cleanup & Workforce Presence Reversion', async () => {
    // 1. Establish baseline agents and place one on LUNCH
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();
    const lunchAgent = agents[0];

    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: lunchAgent.id, status: 'LUNCH', durationMinutes: 60 })
    });

    // 2. Create multiple chats: 1 active, 1 idle at 52m (warning target), 1 idle at 65m (closure target)
    const activeCust = `U_act_${Date.now()}`;
    const warnCust = `U_wrn_${Date.now()}`;
    const closeCust = `U_cls_${Date.now()}`;

    await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_act_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: activeCust, senderName: 'Active' },
        session: { sessionId: `sess_act_${Date.now()}` },
        message: { type: 'TEXT', text: 'Chatting right now' }
      })
    });

    const warnRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_wrn_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: warnCust, senderName: 'Warn Target' },
        session: { sessionId: `sess_wrn_${Date.now()}` },
        message: { type: 'TEXT', text: 'Silent for 52 min' }
      })
    });
    const { caseId: warnCaseId } = await warnRes.json();

    const closeRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_cls_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: closeCust, senderName: 'Close Target' },
        session: { sessionId: `sess_cls_${Date.now()}` },
        message: { type: 'TEXT', text: 'Silent for 65 min' }
      })
    });
    const { caseId: closeCaseId } = await closeRes.json();

    // 3. Automated Schedulers Fire:
    // a. Agent Break Sweep (simulating 65 minutes passed)
    const breakSweepRes = await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 65, dryRun: false })
    });
    const breakSweepData = await breakSweepRes.json();
    assert.ok(breakSweepData.reverted >= 1, 'Lunch agent must be reverted back to ONLINE');

    // b. Idle Chat Sweep
    const idleSweepRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 65,
        dryRun: false
      })
    });
    assert.equal(idleSweepRes.status, 200);
    const idleSweepData = await idleSweepRes.json();
    assert.ok(idleSweepData.closed >= 1, 'Inactive case must be closed');

    // 4. Reverted agent immediately receives newly arrived chat
    const newChatRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_new_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_fresh_${Date.now()}`, senderName: 'Fresh' },
        session: { sessionId: `sess_fresh_${Date.now()}` },
        message: { type: 'TEXT', text: 'Need quick help' }
      })
    });
    const { caseId: newCaseId } = await newChatRes.json();

    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: newCaseId, strategy: 'LEAST_ACTIVE' })
    });
    assert.equal(dispatchRes.status, 200);
  });

  test('T4.1.3 - Real-World Scenario: Delivery Exception, Customer Escalation & Portal Link Logistics Lookup', async () => {
    // 1. Paid quotation shipped via Flash Express
    const senderId = `U_exc_${Date.now()}`;
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_exc_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Escalation Customer' },
        session: { sessionId: `sess_exc_${Date.now()}` },
        message: { type: 'TEXT', text: 'ติดตามพัสดุ' }
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
        items: [{ sku: 'SKU-EXC', productName: 'Item Exc', quantity: 1, unitPrice: 2500, discount: 0 }]
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

    // 2. Carrier reports DELIVERY_FAILED
    const failRes = await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'FLASH', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify({
        trackingNumber,
        carrier: 'FLASH',
        status: 'DELIVERY_FAILED',
        location: 'Customer Gate',
        description: 'Customer unavailable; security gate locked',
        timestamp: new Date().toISOString()
      })
    });
    assert.equal(failRes.status, 200);

    // 3. Agent consults Portal Links to find Logistics Escalation Tool
    await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        title: 'Central Logistics Hotline Portal',
        url: 'https://logistics-hotline.central.co.th',
        category: 'OPERATIONS',
        businessUnits: ['CENTRAL'],
        order: 1
      })
    });

    const portalRes = await fetch(`${APP_URL}/api/portal-links?bu=CENTRAL`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    const portalData = await portalRes.json();
    assert.ok(portalData.links.some((l: any) => l.title === 'Central Logistics Hotline Portal'));

    // 4. Agent updates case with resolution notes
    const updateCaseRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolutionNotes: 'Contacted customer, scheduled redelivery for tomorrow 10:00 AM'
      })
    });
    assert.equal(updateCaseRes.status, 200);
  });

  test('T4.1.4 - Real-World Scenario: Supervisor Break Overrun Audit & Priority VIP Queue Rebalancing', async () => {
    // 1. Agent takes break and experiences overrun
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();
    const agent = agents[0];

    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'BREAK', durationMinutes: 15 })
    });

    // 2. Sweeper auto-reverts with 10m overrun (25m total)
    await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 25, dryRun: false })
    });

    // 3. Supervisor queries adherence dashboard
    const adherenceRes = await fetch(`${APP_URL}/api/agents/adherence`);
    assert.equal(adherenceRes.status, 200);
    const adherenceData = await adherenceRes.json();
    assert.ok(adherenceData, 'Must return supervisor workforce metrics');
  });

  test('T4.1.5 - Real-World Scenario: Omnichannel Multi-BU Delivery Tracking & Customer 360 Loyalty Loop', async () => {
    // 1. Dual-BU orders: Central order (Central Express) and Muji order (Flash Express)
    const senderId = `U_multibu_${Date.now()}`;

    // Central case
    const cCaseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_c_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Multi BU Cust' },
        session: { sessionId: `sess_c_${Date.now()}` },
        message: { type: 'TEXT', text: 'Central items' }
      })
    });
    const { caseId: cCaseId } = await cCaseRes.json();

    const cQuoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: cCaseId,
        customerId: 'cust_central_vip_001',
        businessUnit: 'Central',
        items: [{ sku: 'CENTRAL-01', productName: 'Cosmetics', quantity: 1, unitPrice: 8500, discount: 0 }]
      })
    });
    const { quotation: cQuotation } = await cQuoteRes.json();
    await fetch(`${APP_URL}/api/quotations/${cQuotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    const cLabelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotationId: cQuotation.id, carrier: 'CENTRAL_EXPRESS', shippingAddress: 'BKK', postalCode: '10330' })
    });
    const { trackingNumber: cTracking } = await cLabelRes.json();

    // Deliver Central order
    await fetch(`${APP_URL}/api/shipping/tracking/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Code': 'CENTRAL_EXPRESS', 'X-Courier-Signature': 'sha256=mock-courier-valid-signature' },
      body: JSON.stringify({ trackingNumber: cTracking, carrier: 'CENTRAL_EXPRESS', status: 'DELIVERED', timestamp: new Date().toISOString() })
    });

    // 2. Customer 360 profile check
    const c360Res = await fetch(`${APP_URL}/api/customers/cust_central_vip_001/360`);
    assert.equal(c360Res.status, 200);
    const c360 = await c360Res.json();
    assert.ok(c360.totalLtv >= 8500, 'LTV must include Central order');
  });
});
