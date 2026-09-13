import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = 'http://127.0.0.1:3001';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 2.5: Duplicate & Replay Attacks Boundary (R6 / Tier 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T2.5.1 - Repeated webhook delivery with identical messageId returns 200 without duplicate insertion', async () => {
    const fixedMsgId = `msg_fixed_${Date.now()}`;
    const payload = {
      eventId: `evt_rep_${Date.now()}`,
      source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_rep_01' },
      session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
      message: { messageId: fixedMsgId, type: 'TEXT', text: 'Original message' }
    };

    // 1st delivery
    const r1 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(r1.status, 200);
    const d1 = await r1.json();

    // 2nd delivery with same messageId
    const r2 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(r2.status, 200);
    const d2 = await r2.json();
    assert.equal(d2.duplicate, true);

    // Verify messages count in Case is exactly 1
    const caseRes = await fetch(`${APP_URL}/api/cases/${d1.caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.messages.length, 1);
  });

  test('T2.5.2 - Replay of Zwiz bot state update is idempotent', async () => {
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_state_idemp' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Idempotency test' }
      })
    });
    const { caseId } = await initRes.json();

    // Close case
    const close1 = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert.equal(close1.status, 200);

    // Replay close
    const close2 = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert.equal(close2.status, 200);
    const d2 = await close2.json();
    assert.equal(d2.idempotent, true);
  });

  test('T2.5.3 - Duplicate Qualtrics survey response with same responseId is idempotent', async () => {
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_csat_dedup' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'CSAT Dedup' }
      })
    });
    const { caseId } = await initRes.json();
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const fixedRespId = `R_fixed_${Date.now()}`;
    const payload = { responseId: fixedRespId, caseId, metrics: { csatScore: 5 } };

    const q1 = await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(q1.status, 200);

    const q2 = await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(q2.status, 200);
    const d2 = await q2.json();
    assert.equal(d2.idempotent, true);
  });

  test('T2.5.4 - Replayed case closure request returns current Closed status without re-triggering survey', async () => {
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_survey_dedup' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Test' }
      })
    });
    const { caseId } = await initRes.json();

    // 1st close
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    // 2nd close
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    // Qualtrics should only have 1 distribution
    const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
    const qData = await qRes.json();
    assert.equal(qData.distributions.length, 1);
  });

  test('T2.5.5 - Duplicate session start events retain initial sessionStart timestamp', async () => {
    const initialStart = '2026-09-12T14:00:00.000Z';
    const sessionId = `sess_immut_${Date.now()}`;
    const senderId = 'U_immut_start';

    // 1st message with initial start
    const r1 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId },
        session: { sessionId, sessionStart: initialStart, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_1_${Date.now()}`, type: 'TEXT', text: 'Hello 1' }
      })
    });
    const { caseId } = await r1.json();

    // 2nd message with later start timestamp in same session
    await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId },
        session: { sessionId, sessionStart: '2026-09-12T14:30:00.000Z', botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_2_${Date.now()}`, type: 'TEXT', text: 'Hello 2' }
      })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.session.sessionStart, initialStart);
  });
});
