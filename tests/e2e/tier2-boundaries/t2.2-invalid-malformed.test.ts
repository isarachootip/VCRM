import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 2.2: Invalid Formats & Malformed Payloads Boundary (R6 / Tier 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T2.2.1 - Inbound webhook with malformed JSON body returns HTTP 400 Bad Request', async () => {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "eventId": "evt_broken", "source": { ' // truncated broken JSON
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('T2.2.2 - Inbound channel specified as unsupported "WHATSAPP" returns HTTP 422', async () => {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_wa_${Date.now()}`,
        source: { channel: 'WHATSAPP', pageId: 'wa_page', senderId: 'wa_user_01' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Hello' }
      })
    });

    assert.equal(res.status, 422);
    const data = await res.json();
    assert.ok(data.error.includes('Unsupported social channel'));
  });

  test('T2.2.3 - Case status transition from CLOSED to DRAFT returns HTTP 400', async () => {
    // Create and close case
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_state_test' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Test' }
      })
    });
    const { caseId } = await initRes.json();
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    // Try to transition CLOSED -> DRAFT
    const badTransRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DRAFT' })
    });

    assert.equal(badTransRes.status, 400);
    const data = await badTransRes.json();
    assert.ok(data.error.includes('Invalid status transition'));
  });

  test('T2.2.4 - CSAT score value out of bounds (csatScore=10 on 1-5 scale) returns HTTP 422', async () => {
    const res = await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId: `R_out_of_bounds_${Date.now()}`,
        caseId: 'case_dummy_123',
        metrics: { csatScore: 10 } // Invalid! Scale is 1-5
      })
    });

    assert.equal(res.status, 422);
    const data = await res.json();
    assert.ok(data.error.includes('csatScore must be between 1 and 5'));
  });

  test('T2.2.5 - Non-existent case ID parameter returns HTTP 404', async () => {
    const res = await fetch(`${APP_URL}/api/cases/non_existent_case_uuid_9999`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });
});
