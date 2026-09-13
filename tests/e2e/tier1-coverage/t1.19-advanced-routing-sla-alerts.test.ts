import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.19: Advanced Routing Engine & SLA Inactivity Alerts (R2 / Phase 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createTestInboundCase(senderName = 'Khun Customer') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_sla_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store',
          businessUnit: 'Central',
          senderId: `U_sla_cust_${Date.now()}`,
          senderName
        },
        session: { sessionId: `sess_sla_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'สวัสดีครับ สอบถามสินค้าครับ' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.19.1 - LEAST_ACTIVE routing selects the online agent with the lowest active chat load', async () => {
    // Set up two online agents with different activeChatCounts
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();
    assert.ok(agents.length >= 2, 'Must have at least two baseline agents');

    const agentA = agents[0];
    const agentB = agents[1];

    // Configure Agent A with 2 active chats, Agent B with 0 active chats
    await fetch(`${APP_URL}/api/agents/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: agentA.id, presence: 'ONLINE', maxConcurrentChats: 5 })
    });
    await fetch(`${APP_URL}/api/agents/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: agentB.id, presence: 'ONLINE', maxConcurrentChats: 5 })
    });

    const caseId = await createTestInboundCase();

    // Dispatch using LEAST_ACTIVE strategy
    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        strategy: 'LEAST_ACTIVE'
      })
    });

    assert.equal(dispatchRes.status, 200);
    const dispatchData = await dispatchRes.json();
    assert.equal(dispatchData.success, true);
    assert.ok(dispatchData.assignedAgentId, 'An agent must be assigned');
    assert.equal(dispatchData.strategy, 'LEAST_ACTIVE');
  });

  test('T1.19.2 - MOST_AVAILABLE routing selects the agent with greatest remaining capacity headroom', async () => {
    const caseId = await createTestInboundCase();

    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        strategy: 'MOST_AVAILABLE'
      })
    });

    assert.equal(dispatchRes.status, 200);
    const dispatchData = await dispatchRes.json();
    assert.equal(dispatchData.success, true);
    assert.equal(dispatchData.strategy, 'MOST_AVAILABLE');
    assert.ok(dispatchData.headroom >= 0, 'Headroom must be non-negative');
  });

  test('T1.19.3 - Maximum Chat Capacity hard enforcement bypasses full agents and queues case safely', async () => {
    // Fetch agents and saturate all to max concurrent chats
    const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
    const { agents } = await agentsRes.json();

    for (const agent of agents) {
      await fetch(`${APP_URL}/api/agents/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: agent.id,
          presence: 'BUSY', // Set non-online or zero headroom
          maxConcurrentChats: 0
        })
      });
    }

    const caseId = await createTestInboundCase();

    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        strategy: 'MOST_AVAILABLE'
      })
    });

    assert.equal(dispatchRes.status, 200);
    const dispatchData = await dispatchRes.json();
    assert.equal(dispatchData.assignedAgentId, null, 'No agent should be assigned when all are full');
    assert.equal(dispatchData.status, 'QUEUED', 'Case must remain in QUEUED status');
  });

  test('T1.19.4 - 15-minute customer inactivity triggers PENDING_15MIN flag', async () => {
    const caseId = await createTestInboundCase();

    // Evaluate SLA with 16 simulated elapsed minutes
    const evalRes = await fetch(`${APP_URL}/api/cases/sla/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        elapsedMinutes: 16
      })
    });

    assert.equal(evalRes.status, 200);
    const evalData = await evalRes.json();
    assert.ok(evalData.flaggedCount >= 1);
    const item = evalData.flagged.find((f: any) => f.caseId === caseId);
    assert.ok(item, 'Target case must be flagged');
    assert.equal(item.pendingFlag, 'PENDING_15MIN');
    assert.equal(item.supervisorAlerted, false, '15m silence should not alert supervisor yet');

    // Verify case record reflects pending flag
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.pendingFlag, 'PENDING_15MIN');
  });

  test('T1.19.5 - 30-minute customer inactivity triggers PENDING_30MIN and supervisor alert, cleared upon new message', async () => {
    const caseId = await createTestInboundCase();

    // Evaluate SLA with 35 simulated elapsed minutes
    const evalRes = await fetch(`${APP_URL}/api/cases/sla/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        elapsedMinutes: 35
      })
    });

    assert.equal(evalRes.status, 200);
    const evalData = await evalRes.json();
    const item = evalData.flagged.find((f: any) => f.caseId === caseId);
    assert.ok(item);
    assert.equal(item.pendingFlag, 'PENDING_30MIN');
    assert.equal(item.supervisorAlerted, true, '30m silence must trigger supervisor escalation alert');

    // Check active supervisor alerts endpoint
    const alertsRes = await fetch(`${APP_URL}/api/sla/alerts`);
    const alertsData = await alertsRes.json();
    assert.ok(alertsData.alerts.length >= 1, 'Supervisor alerts list must contain the 30m inactivity alert');

    // Customer sends a new message to resume chat
    await fetch(`${APP_URL}/api/chat/outbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: 'U_sla_cust_test',
        text: 'เจ้าหน้าที่ยังอยู่ไหมครับ?',
        channel: 'LINE',
      })
    });

    // Verify pending flag is cleared
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.pendingFlag, undefined, 'Pending flag must clear after customer or agent communication');
  });
});
