import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = process.env.ZWIZ_MOCK_URL || 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = process.env.QUALTRICS_MOCK_URL || 'http://127.0.0.1:4020';

describe('Tier 1.1: Automated Idle Chat Auto-Close & Warning System (R1 / Phase 3)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  /**
   * Helper: simulate an inbound case with custom timestamps or simulate message history
   */
  async function createInboundChat(options: {
    senderId?: string;
    senderName?: string;
    text?: string;
    bu?: string;
  } = {}) {
    const senderId = options.senderId || `U_idle_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_idle_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store',
          businessUnit: options.bu || 'Central',
          senderId,
          senderName: options.senderName || 'Khun Idle Customer'
        },
        session: { sessionId: `sess_idle_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_in_${Date.now()}`, type: 'TEXT', text: options.text || 'สวัสดีครับ สอบถามสินค้าครับ' }
      })
    });
    assert.equal(res.status, 200, 'Inbound case creation should return 200');
    const data = await res.json();
    return { caseId: data.caseId, senderId };
  }

  test('T1.1.1 - Inactive chat reaching warning threshold (50m) receives pre-closure warning message via Zwiz without closing case', async () => {
    const { caseId, senderId } = await createInboundChat();

    // Trigger idle sweep simulating 50 minutes of inactivity
    const sweepRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 52,
        dryRun: false
      })
    });

    assert.equal(sweepRes.status, 200, 'Idle sweep endpoint should return 200');
    const sweepData = await sweepRes.json();
    assert.ok(sweepData.scanned >= 1, 'At least 1 case should be scanned');
    assert.ok(sweepData.warned >= 1, 'Case should be flagged for warning');
    if (sweepData.caseIdsWarned) {
      assert.ok(sweepData.caseIdsWarned.includes(caseId), 'caseId must be in caseIdsWarned list');
    }

    // Verify case status remains OPEN or IN_PROGRESS (not CLOSED)
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    assert.equal(caseRes.status, 200);
    const { case: caseRecord } = await caseRes.json();
    assert.notEqual(caseRecord.status, 'CLOSED', 'Case must not be closed when only warned');
    assert.ok(caseRecord.idleWarningSentAt, 'idleWarningSentAt timestamp must be recorded on case');

    // Verify Zwiz received pre-closure warning outbound message
    const zwizInspectRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/v1/inspect/messages?recipientId=${senderId}`);
    assert.equal(zwizInspectRes.status, 200);
    const zwizData = await zwizInspectRes.json();
    assert.ok(zwizData.messages.length >= 1, 'Zwiz must have captured pre-closure warning message');
  });

  test('T1.1.2 - Inactive chat reaching closure threshold (60m) automatically transitions to CLOSED with CUSTOMER_INACTIVE_AUTO_CLOSED reason', async () => {
    const { caseId } = await createInboundChat();

    // Trigger idle sweep simulating 65 minutes of inactivity
    const sweepRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 65,
        dryRun: false
      })
    });

    assert.equal(sweepRes.status, 200);
    const sweepData = await sweepRes.json();
    assert.ok(sweepData.closed >= 1, 'At least 1 case should be closed');
    if (sweepData.caseIdsClosed) {
      assert.ok(sweepData.caseIdsClosed.includes(caseId), 'Target caseId must be in closed list');
    }

    // Inspect case record
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    assert.equal(caseRes.status, 200);
    const { case: caseRecord } = await caseRes.json();
    assert.equal(caseRecord.status, 'CLOSED', 'Case status must be CLOSED');
    assert.equal(
      caseRecord.closureReason,
      'CUSTOMER_INACTIVE_AUTO_CLOSED',
      'closureReason must be set to CUSTOMER_INACTIVE_AUTO_CLOSED'
    );
    assert.ok(caseRecord.closedAt, 'closedAt must be populated');
  });

  test('T1.1.3 - Auto-closure triggers Zwiz user bot state synchronization to terminate session', async () => {
    const { caseId, senderId } = await createInboundChat();

    // Execute auto-closure sweep
    await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 62,
        dryRun: false
      })
    });

    // Inspect Zwiz bot state updates
    const stateRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/v1/inspect/state-updates?userId=${senderId}`);
    assert.equal(stateRes.status, 200);
    const stateData = await stateRes.json();
    assert.ok(stateData.updates.length >= 1, 'Zwiz must receive bot state reset update upon auto-closure');
    const lastUpdate = stateData.updates[stateData.updates.length - 1];
    assert.ok(
      ['ACTIVE', 'SESSION_TERMINATED', 'BOT_ACTIVE', 'IDLE'].includes(lastUpdate.botState) || lastUpdate.reset === true,
      'State update must indicate bot reactivation or session termination'
    );
  });

  test('T1.1.4 - Auto-closure automatically triggers Qualtrics CSAT post-chat survey dispatch', async () => {
    const { caseId } = await createInboundChat();

    // Execute auto-closure sweep
    await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 70,
        dryRun: false
      })
    });

    // Inspect Qualtrics survey dispatches
    const qualtricsRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/v1/inspect/dispatches?ticketId=${caseId}`);
    assert.equal(qualtricsRes.status, 200);
    const qualtricsData = await qualtricsRes.json();
    assert.ok(qualtricsData.dispatches.length >= 1, 'Qualtrics survey dispatch must be triggered on auto-closure');
    const dispatch = qualtricsData.dispatches[0];
    assert.equal(dispatch.ticketId, caseId, 'Survey dispatch must link to the closed case');
  });

  test('T1.1.5 - Dry-run mode evaluates idle candidates without mutating case status or sending external alerts', async () => {
    const { caseId, senderId } = await createInboundChat();

    const dryRunRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 75,
        dryRun: true
      })
    });

    assert.equal(dryRunRes.status, 200);
    const dryRunData = await dryRunRes.json();
    assert.ok(dryRunData.scanned >= 1);
    assert.ok(dryRunData.closed >= 1 || dryRunData.dryRunCandidates?.length >= 1);

    // Verify case in database remains OPEN
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const { case: caseRecord } = await caseRes.json();
    assert.notEqual(caseRecord.status, 'CLOSED', 'Dry run must not update case status in database');

    // Verify no Zwiz state updates dispatched
    const stateRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/v1/inspect/state-updates?userId=${senderId}`);
    const stateData = await stateRes.json();
    assert.equal(stateData.updates.length, 0, 'Dry run must not dispatch bot state updates');
  });

  test('T1.1.6 - Inbound customer reply resets inactivity timer and prevents auto-closure', async () => {
    const { caseId, senderId } = await createInboundChat();

    // Customer sends a new message resetting activity
    const replyRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_reply_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          businessUnit: 'Central',
          senderId,
          senderName: 'Khun Idle Customer'
        },
        session: { sessionId: `sess_idle_active_${Date.now()}` },
        message: { messageId: `msg_reply_${Date.now()}`, type: 'TEXT', text: 'ยังสนใจอยู่ครับ ขอดูรูปเพิ่มเติมหน่อย' }
      })
    });
    assert.equal(replyRes.status, 200);

    // Run idle sweep with simulated elapsed minutes < 50 for the updated message
    const sweepRes = await fetch(`${APP_URL}/api/cases/idle-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idleWarningThresholdMinutes: 50,
        idleCloseThresholdMinutes: 60,
        simulatedElapsedMinutes: 20, // Reset to 20m
        dryRun: false
      })
    });

    assert.equal(sweepRes.status, 200);
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const { case: caseRecord } = await caseRes.json();
    assert.notEqual(caseRecord.status, 'CLOSED', 'Active case must remain open');
    assert.equal(caseRecord.idleWarningSentAt, null, 'Warning must not be triggered for active chat');
  });
});
