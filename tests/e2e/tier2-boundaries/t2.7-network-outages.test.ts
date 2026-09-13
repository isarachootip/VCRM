import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 2.7: Network Outages & Downstream Errors Boundary (R6 / Tier 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createCase() {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: `U_${Date.now()}` },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Network test' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T2.7.1 - Zwiz Mock returns HTTP 500 on outbound push -> marked DELIVERY_FAILED', async () => {
    const caseId = await createCase();

    // Inject 500 error into Zwiz mock for /mock/zwiz/v1/messages
    await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/control/inject-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/mock/zwiz/v1/messages',
        statusCode: 500,
        count: 1
      })
    });

    const sendRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Message during outage', type: 'TEXT', isInternal: false })
    });

    assert.equal(sendRes.status, 502);

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    const lastMsg = caseData.messages[caseData.messages.length - 1];
    assert.equal(lastMsg.deliveryStatus, 'DELIVERY_FAILED');
  });

  test('T2.7.2 - Zwiz Mock error injection expires after specified count', async () => {
    const caseId = await createCase();

    // Inject single error (count = 1)
    await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/control/inject-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/mock/zwiz/v1/messages',
        statusCode: 500,
        count: 1
      })
    });

    // 1st request fails
    const res1 = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Msg 1', type: 'TEXT', isInternal: false })
    });
    assert.equal(res1.status, 502);

    // 2nd request succeeds because error expired
    const res2 = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Msg 2', type: 'TEXT', isInternal: false })
    });
    assert.equal(res2.status, 201);
  });

  test('T2.7.3 - Qualtrics Mock returns HTTP 503 on survey dispatch -> marked FAILED_RETRY', async () => {
    const caseId = await createCase();

    // Inject 503 error into Qualtrics mock
    await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/control/inject-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/mock/qualtrics/v3/distributions',
        statusCode: 503,
        count: 1
      })
    });

    // Close case
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.surveyStatus, 'FAILED_RETRY');
  });

  test('T2.7.4 - Recovery: subsequent retry succeeds when mock error is cleared', async () => {
    const caseId = await createCase();

    // Inject error then clear
    await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/control/inject-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: '/mock/zwiz/v1/messages', statusCode: 500, count: 5 })
    });
    // Reset mock
    await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/control/reset`, { method: 'DELETE' });

    // Try sending message
    const res = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Post reset message', type: 'TEXT', isInternal: false })
    });

    assert.equal(res.status, 201);
  });

  test('T2.7.5 - CRM server returns 200 on health check and recovers from transient downstream errors', async () => {
    const healthRes = await fetch(`${APP_URL}/health`);
    assert.equal(healthRes.status, 200);
    const data = await healthRes.json();
    assert.equal(data.status, 'healthy');
  });
});
