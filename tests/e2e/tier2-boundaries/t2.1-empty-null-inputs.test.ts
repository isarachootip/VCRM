import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 2.1: Empty / Null / Whitespace Inputs Boundary (R6 / Tier 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T2.1.1 - Inbound message with empty text and no media returns HTTP 400 Bad Request', async () => {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_empty_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_empty_01' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: '   ' }
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('T2.1.2 - Inbound customer name containing only whitespace handled gracefully with fallback', async () => {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_ws_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_ws_user_99', senderName: '   ' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'สอบถามครับ' }
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    const caseRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
    const caseData = await caseRes.json();

    assert.ok(caseData.customer.name.includes('Guest Customer'));
  });

  test('T2.1.3 - Outbound agent message with empty string content rejected with HTTP 400', async () => {
    // Create case first
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_test_01' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Hello' }
      })
    });
    const { caseId } = await initRes.json();

    const emptySendRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '   ', type: 'TEXT', isInternal: false })
    });

    assert.equal(emptySendRes.status, 400);
  });

  test('T2.1.4 - Inbound case with missing or undefined businessUnit assigns default Central BU', async () => {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_nobu_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', senderId: 'U_nobu_01' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'No BU specified' }
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    const caseRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
    const caseData = await caseRes.json();

    assert.equal(caseData.businessUnit, 'Central');
  });

  test('T2.1.5 - CSAT response with empty feedback comment succeeds with null comment', async () => {
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_csat_empty' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'CSAT Setup' }
      })
    });
    const { caseId } = await initRes.json();
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const csatRes = await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId: `R_nocomment_${Date.now()}`,
        caseId,
        metrics: { csatScore: 5 },
        feedback: { comment: '' }
      })
    });

    assert.equal(csatRes.status, 200);
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.csatScore, 5);
    assert.equal(caseData.feedbackComment, null);
  });
});
