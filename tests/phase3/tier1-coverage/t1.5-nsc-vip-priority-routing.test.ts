import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.5: NSC VIP Customer Tagging & Priority Queue Routing (R5 / Phase 3)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T1.5.1 - Administrator or Digital Assistant can tag customer with NSC VIP status', async () => {
    const customerId = 'cust_central_vip_001';

    const vipRes = await fetch(`${APP_URL}/api/customers/${customerId}/vip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
      },
      body: JSON.stringify({
        isVip: true,
        vipTier: 'NSC_VIP',
        reason: 'High net worth private banking customer'
      })
    });

    assert.equal(vipRes.status, 200);
    const vipData = await vipRes.json();
    assert.equal(vipData.success, true);
    assert.equal(vipData.customer.isVip, true);
    assert.equal(vipData.customer.vipTier, 'NSC_VIP');
  });

  test('T1.5.2 - Inbound chat from VIP customer automatically flags case with isVip=true and queuePriority=100', async () => {
    // 1. Ensure customer is tagged VIP
    const senderId = `U_vip_${Date.now()}`;
    // Create initial inbound to establish customer record
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_init_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Khun VIP Member' },
        session: { sessionId: `sess_vip_init_${Date.now()}` },
        message: { type: 'TEXT', text: 'สวัสดีครับ' }
      })
    });
    const { caseId: initCaseId } = await initRes.json();
    const caseRecRes = await fetch(`${APP_URL}/api/cases/${initCaseId}`);
    const { case: caseRec } = await caseRecRes.json();

    // Tag customer as VIP
    await fetch(`${APP_URL}/api/customers/${caseRec.customerId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP' })
    });

    // 2. New inbound chat from this VIP customer
    const vipChatRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_chat_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Khun VIP Member' },
        session: { sessionId: `sess_vip_chat_${Date.now()}` },
        message: { type: 'TEXT', text: 'ต้องการจองสินค้าล่วงหน้าครับ' }
      })
    });
    const { caseId: vipCaseId } = await vipChatRes.json();

    // Verify case record has VIP flags
    const inspectCaseRes = await fetch(`${APP_URL}/api/cases/${vipCaseId}`);
    const { case: inspectedCase } = await inspectCaseRes.json();
    assert.equal(inspectedCase.isVip, true, 'Case must be tagged isVip=true');
    assert.equal(inspectedCase.queuePriority, 100, 'VIP case must have priority weight 100');
  });

  test('T1.5.3 - Priority queue routing dispatches VIP chat exclusively or with top priority to VIP-eligible senior agents', async () => {
    // Configure agents: Agent A (standard agent, not VIP eligible), Agent B (senior DA, VIP eligible)
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();
    assert.ok(agents.length >= 2, 'Need 2 agents for routing test');

    const agentStandard = agents[0];
    const agentVip = agents[1];

    await fetch(`${APP_URL}/api/agents/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: agentStandard.id, presence: 'ONLINE', isVipEligible: false })
    });
    await fetch(`${APP_URL}/api/agents/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: agentVip.id, presence: 'ONLINE', isVipEligible: true })
    });

    // Create VIP case
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_route_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_vip_route_${Date.now()}`, senderName: 'VIP Customer' },
        session: { sessionId: `sess_vip_route_${Date.now()}` },
        message: { type: 'TEXT', text: 'VIP inquiry' }
      })
    });
    const { caseId } = await caseRes.json();

    // Mark case as VIP
    await fetch(`${APP_URL}/api/cases/${caseId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
    });

    // Dispatch queue
    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, prioritizeVip: true })
    });

    assert.equal(dispatchRes.status, 200);
    const dispatchData = await dispatchRes.json();
    assert.equal(dispatchData.assignedAgentId, agentVip.id, 'VIP case must be routed to VIP-eligible agent');
  });

  test('T1.5.4 - Dedicated VIP SLA timer activates accelerated 5-minute first response threshold', async () => {
    // Create VIP case
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_sla_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_vip_sla_${Date.now()}`, senderName: 'VIP Customer' },
        session: { sessionId: `sess_vip_sla_${Date.now()}` },
        message: { type: 'TEXT', text: 'VIP urgent request' }
      })
    });
    const { caseId } = await caseRes.json();

    await fetch(`${APP_URL}/api/cases/${caseId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
    });

    // Evaluate SLA after 6 minutes (exceeds 5m VIP threshold but below 15m standard)
    const slaRes = await fetch(`${APP_URL}/api/cases/sla/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, elapsedMinutes: 6 })
    });

    assert.equal(slaRes.status, 200);
    const slaData = await slaRes.json();
    assert.ok(
      slaData.alerts.some((a: any) => a.caseId === caseId && a.alertType.includes('VIP')),
      'Must trigger VIP accelerated SLA breach alert at 6 minutes'
    );
  });

  test('T1.5.5 - Visual VIP badge metadata is included in case details and queue list representations', async () => {
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_meta_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_vip_badge_${Date.now()}`, senderName: 'VIP Member' },
        session: { sessionId: `sess_vip_badge_${Date.now()}` },
        message: { type: 'TEXT', text: 'Hello' }
      })
    });
    const { caseId } = await caseRes.json();

    await fetch(`${APP_URL}/api/cases/${caseId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
    });

    // Get Case detail
    const getRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    assert.equal(getRes.status, 200);
    const { case: caseRec } = await getRes.json();
    assert.equal(caseRec.isVip, true);
    assert.equal(caseRec.queuePriority, 100);

    // Get Queue list
    const listRes = await fetch(`${APP_URL}/api/cases?isVip=true`);
    assert.equal(listRes.status, 200);
    const { cases } = await listRes.json();
    assert.ok(cases.some((c: any) => c.id === caseId), 'VIP case must appear when filtering by isVip=true');
  });

  test('T1.5.6 - Standard non-VIP customer defaults to normal priority (0) and 15-minute standard SLA', async () => {
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_std_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_std_${Date.now()}`, senderName: 'Standard Customer' },
        session: { sessionId: `sess_std_${Date.now()}` },
        message: { type: 'TEXT', text: 'Standard inquiry' }
      })
    });
    const { caseId } = await caseRes.json();

    const getRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const { case: caseRec } = await getRes.json();
    assert.equal(caseRec.isVip, false, 'Non-VIP must default to isVip=false');
    assert.equal(caseRec.queuePriority, 0, 'Standard queue priority must be 0');

    // SLA evaluate at 6 minutes: should NOT breach standard 15m threshold
    const slaRes = await fetch(`${APP_URL}/api/cases/sla/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, elapsedMinutes: 6 })
    });
    const slaData = await slaRes.json();
    assert.ok(
      !slaData.alerts.some((a: any) => a.caseId === caseId && a.alertType.includes('BREACH')),
      'Standard case must not breach at 6 minutes'
    );
  });
});
