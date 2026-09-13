import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 2.3: Agent Break Timers & Reversion Boundary Cases (R3 Boundaries)', () => {
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
    const { agents } = await res.json();
    return agents[0];
  }

  test('T2.3.1 - Boundary: Break duration at 14m does NOT auto-revert; 15m auto-reverts to ONLINE', async () => {
    const agent = await getBaselineAgent();

    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'BREAK', durationMinutes: 15 })
    });

    // 14 minutes elapsed: should NOT revert
    const sweep14 = await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 14, dryRun: false })
    });
    const data14 = await sweep14.json();
    assert.equal(data14.reverted, 0, 'Must not revert at 14m');

    // 15 minutes elapsed: SHOULD revert
    const sweep15 = await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 15, dryRun: false })
    });
    const data15 = await sweep15.json();
    assert.ok(data15.reverted >= 1, 'Must revert at 15m');
  });

  test('T2.3.2 - Boundary: Lunch duration at 59m does NOT auto-revert; 60m auto-reverts to ONLINE', async () => {
    const agent = await getBaselineAgent();

    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'LUNCH', durationMinutes: 60 })
    });

    // 59 minutes: should NOT revert
    const sweep59 = await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 59, dryRun: false })
    });
    const data59 = await sweep59.json();
    assert.equal(data59.reverted, 0, 'Must not revert at 59m');

    // 60 minutes: SHOULD revert
    const sweep60 = await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 60, dryRun: false })
    });
    const data60 = await sweep60.json();
    assert.ok(data60.reverted >= 1, 'Must revert at 60m');
  });

  test('T2.3.3 - Boundary: OFFLINE agent attempting to enter BREAK returns HTTP 400 Bad Request', async () => {
    const agent = await getBaselineAgent();

    // Set OFFLINE first
    await fetch(`${APP_URL}/api/agents/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: agent.id, presence: 'OFFLINE' })
    });

    // Attempt break
    const res = await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'BREAK', durationMinutes: 15 })
    });

    assert.ok(res.status >= 400, 'Offline agent starting break must return 4xx error');
  });

  test('T2.3.4 - Boundary: Agent already on BREAK attempting second break returns 409 Conflict or idempotent state', async () => {
    const agent = await getBaselineAgent();

    // Break 1
    const res1 = await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'BREAK', durationMinutes: 15 })
    });
    assert.equal(res1.status, 200);

    // Break 2 while already on break
    const res2 = await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'LUNCH', durationMinutes: 60 })
    });

    assert.ok([200, 400, 409].includes(res2.status), 'Must handle concurrent break request gracefully');
  });

  test('T2.3.5 - Boundary: Negative or invalid break duration returns HTTP 400 Bad Request', async () => {
    const agent = await getBaselineAgent();

    const invalidDurations = [-15, 0, 'thirty', 2000];
    for (const duration of invalidDurations) {
      const res = await fetch(`${APP_URL}/api/agents/break`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, status: 'BREAK', durationMinutes: duration })
      });
      assert.ok(res.status >= 400, `Expected 4xx error for duration: ${duration}`);
    }
  });

  test('T2.3.6 - Boundary: Auto-revert with zero active chats restores full capacity headroom without corruption', async () => {
    const agent = await getBaselineAgent();

    await fetch(`${APP_URL}/api/agents/break`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status: 'BREAK', durationMinutes: 15 })
    });

    await fetch(`${APP_URL}/api/agents/break-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulatedElapsedMinutes: 20, dryRun: false })
    });

    const presenceRes = await fetch(`${APP_URL}/api/agents/presence?agentId=${agent.id}`);
    const presenceData = await presenceRes.json();
    const updated = presenceData.agents ? presenceData.agents.find((a: any) => a.id === agent.id) : presenceData.agent;
    assert.equal(updated.presence, 'ONLINE');
    assert.equal(updated.activeChatCount, 0, 'Active chat count must remain 0');
  });
});
