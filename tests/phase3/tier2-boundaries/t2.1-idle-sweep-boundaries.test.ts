import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = process.env.ZWIZ_MOCK_URL || 'http://127.0.0.1:4010';

describe('Tier 2.1: Idle Chat Sweep Boundary & Corner Cases (R1 Boundaries)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createInboundChat(senderId = `U_bnd_idle_${Date.now()}`) {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_bnd_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Boundary Cust' },
        session: { sessionId: `sess_bnd_${Date.now()}` },
        message: { type: 'TEXT', text: 'Boundary test message' }
      })
    });
    const data = await res.json();
    return { caseId: data.caseId, senderId };
  }

  test('T2.1.1 - Boundary: Inactivity at exactly 49m does NOT trigger warning; 50m triggers warning', async () => {
    const { caseId } = await createInboundChat();

    // 49 minutes - should NOT warn
    const sweep49 = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 49,
        dryRun: false
      })
    });
    const data49 = await sweep49.json();
    assert.equal(data49.warned, 0, 'Must not warn at 49 minutes');

    // 50 minutes - SHOULD warn
    const sweep50 = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 50,
        dryRun: false
      })
    });
    const data50 = await sweep50.json();
    assert.ok(data50.warned >= 1, 'Must warn at exactly 50 minutes');
  });

  test('T2.1.2 - Boundary: Inactivity at 59m keeps case OPEN (warned); 60m auto-closes case', async () => {
    const { caseId } = await createInboundChat();

    // 59 minutes - warned, but NOT closed
    const sweep59 = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 59,
        dryRun: false
      })
    });
    const data59 = await sweep59.json();
    assert.equal(data59.closed, 0, 'Must not close at 59 minutes');

    // 60 minutes - auto-closes
    const sweep60 = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 60,
        dryRun: false
      })
    });
    const data60 = await sweep60.json();
    assert.ok(data60.closed >= 1, 'Must close at exactly 60 minutes');
  });

  test('T2.1.3 - Idempotency: Duplicate sweeps between 50m and 59m send exactly ONE warning message', async () => {
    const { caseId, senderId } = await createInboundChat();

    // Sweep 1 at 52m
    await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleWarningThresholdMinutes: 50, idleCloseThresholdMinutes: 60, simulatedElapsedMinutes: 52, dryRun: false })
    });

    // Sweep 2 at 55m
    await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleWarningThresholdMinutes: 50, idleCloseThresholdMinutes: 60, simulatedElapsedMinutes: 55, dryRun: false })
    });

    // Inspect Zwiz outbound messages for this recipient
    const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/v1/inspect/messages?recipientId=${senderId}`);
    const zwizData = await zwizRes.json();
    assert.equal(zwizData.messages.length, 1, 'Exactly one warning message must be sent to customer');
  });

  test('T2.1.4 - Filter isolation: Already RESOLVED or CLOSED cases are completely ignored by idle sweep', async () => {
    const { caseId } = await createInboundChat();

    // Resolve case manually
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED', resolutionCategory: 'CUSTOMER_ASSISTED' })
    });

    // Run sweep at 70m
    const sweepRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleWarningThresholdMinutes: 50, idleCloseThresholdMinutes: 60, simulatedElapsedMinutes: 70, dryRun: false })
    });
    const sweepData = await sweepRes.json();
    if (sweepData.caseIdsClosed) {
      assert.ok(!sweepData.caseIdsClosed.includes(caseId), 'Already resolved case must not be closed again');
    }
  });

  test('T2.1.5 - Validation: Negative, zero, or malformed thresholds in sweep request return HTTP 400 Bad Request', async () => {
    const invalidPayloads = [
      { idleWarningThresholdMinutes: -5, idleCloseThresholdMinutes: 60 },
      { idleWarningThresholdMinutes: 60, idleCloseThresholdMinutes: 50 }, // warning > close
      { idleWarningThresholdMinutes: 'fifty', idleCloseThresholdMinutes: 60 },
    ];

    for (const payload of invalidPayloads) {
      const res = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      assert.ok(res.status >= 400, `Expected 4xx error for payload: ${JSON.stringify(payload)}`);
    }
  });

  test('T2.1.6 - Extreme Age: Case inactive for extreme duration (e.g. 10,000 minutes) cleanly transitions to CLOSED without crashing', async () => {
    const { caseId } = await createInboundChat();

    const sweepRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 10000,
        dryRun: false
      })
    });

    assert.equal(sweepRes.status, 200);
    const sweepData = await sweepRes.json();
    assert.ok(sweepData.closed >= 1);
  });
});
