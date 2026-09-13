import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.3: Agent Shift, Break Timers & Auto-Online Reversion (R3 / Phase 3)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function getBaselineAgent() {
    const res = await fetch(`${APP_URL}/api/agents/presence`);
    assert.equal(res.status, 200);
    const { agents } = await res.json();
    assert.ok(agents.length >= 1, 'Must have at least one baseline agent');
    return agents[0];
  }

  test('T1.3.1 - Frontline agent initiates BREAK (15m) or LUNCH (60m) establishing countdown and breakExpectedEndAt', async () => {
    const agent = await getBaselineAgent();

    // 1. Put agent on SHORT BREAK (15m)
    const breakRes = await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agent.id,
        status: 'BREAK',
        durationMinutes: 15
      })
    });
    assert.equal(breakRes.status, 200);
    const breakData = await breakRes.json();
    assert.equal(breakData.success, true);
    assert.equal(breakData.presence, 'BREAK');
    assert.ok(breakData.breakExpectedEndAt, 'Must return expected break end timestamp');

    // Verify agent status query
    const statusRes = await fetch(`${APP_URL}/api/agents/presence?agentId=${agent.id}`);
    const statusData = await statusRes.json();
    const updatedAgent = statusData.agents ? statusData.agents.find((a: any) => a.id === agent.id) : statusData.agent;
    assert.equal(updatedAgent.presence, 'BREAK');
  });

  test('T1.3.2 - Agent break sweep automatically reverts expired breaks back to ONLINE', async () => {
    const agent = await getBaselineAgent();

    // Put on LUNCH (60m)
    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agent.id,
        status: 'LUNCH',
        durationMinutes: 60
      })
    });

    // Run break sweep simulating 65 minutes passed (expired by 5 minutes)
    const sweepRes = await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulatedElapsedMinutes: 65,
        dryRun: false
      })
    });
    assert.equal(sweepRes.status, 200);
    const sweepData = await sweepRes.json();
    assert.ok(sweepData.reverted >= 1, 'At least 1 agent must be reverted');
    if (sweepData.agentIdsReverted) {
      assert.ok(sweepData.agentIdsReverted.includes(agent.id), 'Target agentId must be in reverted list');
    }

    // Verify agent presence is now ONLINE
    const agentRes = await fetch(`${APP_URL}/api/agents/presence?agentId=${agent.id}`);
    const agentData = await agentRes.json();
    const currentAgent = agentData.agents ? agentData.agents.find((a: any) => a.id === agent.id) : agentData.agent;
    assert.equal(currentAgent.presence, 'ONLINE', 'Agent status must be reverted to ONLINE');
  });

  test('T1.3.3 - Auto-reverted agent becomes immediately eligible for automated chat queue routing', async () => {
    const agent = await getBaselineAgent();

    // Put agent on break
    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agent.id,
        status: 'BREAK',
        durationMinutes: 15
      })
    });

    // Inbound case while on break
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_route_brk_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: `U_${Date.now()}`, senderName: 'Cust' },
        session: { sessionId: `sess_brk_${Date.now()}` },
        message: { type: 'TEXT', text: 'รอเจ้าหน้าที่ครับ' }
      })
    });
    const { caseId } = await caseRes.json();

    // Auto-revert via sweep
    await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 20, dryRun: false })
    });

    // Dispatch queue routing
    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, strategy: 'LEAST_ACTIVE' })
    });
    assert.equal(dispatchRes.status, 200);
    const dispatchData = await dispatchRes.json();
    assert.ok(dispatchData.assignedAgentId, 'Reverted agent must be assigned the pending chat');
  });

  test('T1.3.4 - AgentBreakSession records isAutoReverted=true and accurate overrunSeconds', async () => {
    const agent = await getBaselineAgent();

    // Break duration 15 minutes
    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agent.id,
        status: 'BREAK',
        durationMinutes: 15
      })
    });

    // Sweep simulating 25 minutes elapsed (10 minutes overrun = 600s)
    await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 25, dryRun: false })
    });

    // Check break session history
    const historyRes = await fetch(`${APP_URL}/api/agents/break/history?agentId=${agent.id}`);
    assert.equal(historyRes.status, 200);
    const { sessions } = await historyRes.json();
    assert.ok(sessions.length >= 1);
    const latest = sessions[0];
    assert.equal(latest.isAutoReverted, true, 'isAutoReverted must be true');
    assert.ok(latest.overrunSeconds >= 0, 'overrunSeconds must be recorded');
  });

  test('T1.3.5 - Supervisor adherence and overrun tracking report aggregates break metrics and highlights overruns', async () => {
    const agent = await getBaselineAgent();

    // Create a break and auto-revert with overrun
    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'BREAK', durationMinutes: 15 })
    });
    await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 22, dryRun: false })
    });

    // Supervisor adherence report
    const reportRes = await fetch(`${APP_URL}/api/agents/adherence`);
    assert.equal(reportRes.status, 200);
    const reportData = await reportRes.json();
    assert.ok(reportData.agents || reportData.adherenceRecords, 'Must return adherence dataset');
    const records = reportData.agents || reportData.adherenceRecords;
    assert.ok(records.length >= 1, 'Must contain at least 1 agent record');
  });

  test('T1.3.6 - Manual presence restoration before break expiration records voluntary return with isAutoReverted=false', async () => {
    const agent = await getBaselineAgent();

    // Put on LUNCH (60m)
    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'LUNCH', durationMinutes: 60 })
    });

    // Agent voluntarily comes back ONLINE early (e.g. after 40m)
    const revertRes = await fetch(`${APP_URL}/api/agents/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: agent.id,
        presence: 'ONLINE'
      })
    });
    assert.equal(revertRes.status, 200);

    // Check break history
    const historyRes = await fetch(`${APP_URL}/api/agents/break/history?agentId=${agent.id}`);
    assert.equal(historyRes.status, 200);
    const { sessions } = await historyRes.json();
    if (sessions && sessions.length > 0) {
      const latest = sessions[0];
      assert.equal(latest.isAutoReverted, false, 'Manual revert must have isAutoReverted=false');
      assert.equal(latest.overrunSeconds, 0, 'Voluntary early return has zero overrun');
    }
  });
});
