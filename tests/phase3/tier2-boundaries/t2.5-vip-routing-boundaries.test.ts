import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 2.5: NSC VIP Priority Routing Boundary Cases (R5 Boundaries)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T2.5.1 - Boundary: Tagging non-existent customer ID as VIP returns HTTP 404 Not Found', async () => {
    const res = await fetch(`${APP_URL}/api/customers/non_existent_cust_999/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP' })
    });

    assert.equal(res.status, 404, 'Non-existent customer must return 404');
  });

  test('T2.5.2 - Boundary: Invalid or empty vipTier value returns HTTP 400 or 422 Unprocessable Entity', async () => {
    const res = await fetch(`${APP_URL}/api/customers/cust_central_vip_001/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ isVip: true, vipTier: '' })
    });

    assert.ok(
      [400, 422].includes(res.status),
      `Invalid VIP tier must return 400/422 (got ${res.status})`
    );
  });

  test('T2.5.3 - Boundary: VIP queue routing when all VIP agents are at max chat capacity safely queues case with priority retained', async () => {
    // Put all agents at max chat capacity
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();

    for (const a of agents) {
      await fetch(`${APP_URL}/api/agents/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: a.id,
          presence: 'ONLINE',
          isVipEligible: true,
          maxConcurrentChats: 2,
          activeChatCount: 2 // Maxed out
        })
      });
    }

    // Create VIP case
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_cap_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_cap_${Date.now()}`, senderName: 'VIP Cap' },
        session: { sessionId: `sess_cap_${Date.now()}` },
        message: { type: 'TEXT', text: 'VIP inquiry at full capacity' }
      })
    });
    const { caseId } = await caseRes.json();
    await fetch(`${APP_URL}/api/cases/${caseId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
    });

    // Dispatch
    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, prioritizeVip: true })
    });

    assert.equal(dispatchRes.status, 200);
    const dispatchData = await dispatchRes.json();
    assert.equal(dispatchData.assignedAgentId, null, 'Must not assign when capacity full');
    assert.equal(dispatchData.status, 'QUEUED', 'Must retain QUEUED status safely');
  });

  test('T2.5.4 - Boundary: Revoking VIP status (isVip: false) resets priority and returns subsequent cases to normal queue priority', async () => {
    const customerId = 'cust_central_vip_001';

    // 1. Set VIP
    await fetch(`${APP_URL}/api/customers/${customerId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP' })
    });

    // 2. Revoke VIP
    const revokeRes = await fetch(`${APP_URL}/api/customers/${customerId}/vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ isVip: false, vipTier: null, reason: 'Tier expired' })
    });
    assert.equal(revokeRes.status, 200);
    const revokeData = await revokeRes.json();
    assert.equal(revokeData.customer.isVip, false);

    // 3. Inbound chat after revocation
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_revoked_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: 'line_user_vip_001', senderName: 'Revoked VIP' },
        session: { sessionId: `sess_revoked_${Date.now()}` },
        message: { type: 'TEXT', text: 'Hello' }
      })
    });
    const { caseId } = await caseRes.json();

    const getRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const { case: caseRec } = await getRes.json();
    assert.equal(caseRec.isVip, false, 'Revoked customer case must not be VIP');
    assert.equal(caseRec.queuePriority, 0, 'Queue priority must revert to 0');
  });

  test('T2.5.5 - Concurrency race: Multiple VIP cases dispatched simultaneously to VIP agent pool respect max chat capacity without overflow', async () => {
    // Configure single VIP agent with maxConcurrentChats = 2
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();
    const vipAgent = agents[0];

    await fetch(`${APP_URL}/api/agents/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: vipAgent.id, presence: 'ONLINE', isVipEligible: true, maxConcurrentChats: 2, activeChatCount: 0 })
    });

    // Create 3 VIP cases
    const caseIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: `evt_race_${i}_${Date.now()}`,
          source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_race_${i}_${Date.now()}`, senderName: `VIP ${i}` },
          session: { sessionId: `sess_race_${i}_${Date.now()}` },
          message: { type: 'TEXT', text: `VIP message ${i}` }
        })
      });
      const data = await res.json();
      caseIds.push(data.caseId);
      await fetch(`${APP_URL}/api/cases/${data.caseId}/vip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP', queuePriority: 100 })
      });
    }

    // Parallel dispatch all 3
    const dispatchPromises = caseIds.map(caseId =>
      fetch(`${APP_URL}/api/routing/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, prioritizeVip: true })
      }).then(r => r.json())
    );

    const results = await Promise.all(dispatchPromises);
    const assigned = results.filter(r => r.assignedAgentId === vipAgent.id);
    const queued = results.filter(r => r.assignedAgentId === null);

    assert.ok(assigned.length <= 2, `Assigned count (${assigned.length}) must not exceed maxConcurrentChats (2)`);
    assert.ok(queued.length >= 1, 'Third case must be safely queued when capacity reached');
  });

  test('T2.5.6 - RBAC: Frontline agent attempting to tag customer as VIP returns HTTP 403 Forbidden', async () => {
    const res = await fetch(`${APP_URL}/api/customers/cust_central_vip_001/vip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'AGENT' // Non-admin, non-DA
      },
      body: JSON.stringify({ isVip: true, vipTier: 'NSC_VIP' })
    });

    assert.equal(res.status, 403, 'Frontline agent mutating VIP status must be rejected with 403');
  });
});
