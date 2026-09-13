import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 1.3: Bot State Synchronization on Case Closure (R1 / F3)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createOpenCase(senderId = 'U_state_sync_user_001', sessionId = `sess_${Date.now()}`) {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_init_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_official', businessUnit: 'Central', senderId, senderName: 'Khun Somchai' },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_init_${Date.now()}`, type: 'TEXT', text: 'Inquiry before close' }
      })
    });
    const data = await res.json();
    return { caseId: data.caseId, senderId, sessionId };
  }

  test('T1.3.1 - Case closure dispatches bot state update with botState ACTIVE to Zwiz mock', async () => {
    const { caseId, senderId } = await createOpenCase();

    // Close the case
    const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'CLOSED',
        closureReason: 'RESOLVED_BY_AGENT'
      })
    });

    assert.equal(closeRes.status, 200);

    // Verify Zwiz mock received state update
    const stateUpdate = await waitFor(async () => {
      const resp = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?userId=${senderId}`);
      const data = await resp.json();
      return data.updates?.length > 0 ? data.updates[0] : null;
    }, { description: 'Zwiz bot state update' });

    assert.equal(stateUpdate.userId, senderId);
    assert.equal(stateUpdate.botState, 'ACTIVE');
    assert.equal(stateUpdate.action, 'RESET_TO_MAIN_MENU');
  });

  test('T1.3.2 - Bot state update payload integrity (userId, sessionId, caseId, action)', async () => {
    const { caseId, senderId, sessionId } = await createOpenCase('U_integrity_user_002', 'sess_custom_9988');

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'ORDER_COMPLETED' })
    });

    const update = await waitFor(async () => {
      const resp = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?caseId=${caseId}`);
      const data = await resp.json();
      return data.updates?.[0] || null;
    });

    assert.equal(update.userId, senderId);
    assert.equal(update.sessionId, sessionId);
    assert.equal(update.caseId, caseId);
    assert.equal(update.botState, 'ACTIVE');
    assert.ok(update.closedAt);
    assert.ok(update.receivedAt);
  });

  test('T1.3.3 - Case audit trail logs BOT_STATE_SYNC_SUCCESS', async () => {
    const { caseId } = await createOpenCase();

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();

    const syncAudit = caseData.auditLogs.find((a: any) => a.action === 'BOT_STATE_SYNC_SUCCESS');
    assert.ok(syncAudit, 'Audit trail must record BOT_STATE_SYNC_SUCCESS');
  });

  test('T1.3.4 - Idempotent close guard: closing an already closed case does not re-trigger bot state sync', async () => {
    const { caseId, senderId } = await createOpenCase('U_idemp_user_004');

    // First close
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    // Wait for first state update to register
    await waitFor(async () => {
      const resp = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?userId=${senderId}`);
      const data = await resp.json();
      return data.updates?.length === 1 ? true : null;
    });

    // Second close attempt
    const secondRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    assert.equal(secondRes.status, 200);

    // Inspect updates: must remain 1
    const checkResp = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?userId=${senderId}`);
    const checkData = await checkResp.json();
    assert.equal(checkData.updates.length, 1, 'Duplicate state sync must be suppressed');
  });

  test('T1.3.5 - Case status transitions to CLOSED and closedAt timestamp is recorded', async () => {
    const { caseId } = await createOpenCase();

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();

    assert.equal(caseData.status, 'CLOSED');
    assert.ok(caseData.closedAt, 'closedAt must be populated');
    assert.ok(caseData.session.sessionEnd, 'sessionEnd must be stamped upon case closure');
  });
});
