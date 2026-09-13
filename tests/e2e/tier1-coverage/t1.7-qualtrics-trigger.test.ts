import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 1.7: Post-Closure Qualtrics CSAT Survey Trigger (R4 / F7)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createCase(bu = 'Central', queueId = 'queue_central_sales', ownerId = 'agent_sarah_01') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_q_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_page', businessUnit: bu, senderId: `U_q_${Date.now()}` },
        session: { sessionId: `sess_q_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_q_${Date.now()}`, type: 'TEXT', text: 'CSAT test query' },
        queueId
      })
    });
    const data = await res.json();

    // Assign owner
    if (ownerId) {
      await fetch(`${APP_URL}/api/cases/${data.caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId })
      });
    }

    return data.caseId;
  }

  test('T1.7.1 - Case closure triggers post-closure CSAT survey dispatch to Qualtrics mock', async () => {
    const caseId = await createCase();

    const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    assert.equal(closeRes.status, 200);

    const captured = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.length > 0 ? qData.distributions[0] : null;
    }, { description: 'Qualtrics survey dispatch' });

    assert.equal(captured.caseId, caseId);
    assert.ok(captured.distributionId.startsWith('EMD_dist_'));
  });

  test('T1.7.2 - BU and Queue survey mapping includes correct survey template metadata', async () => {
    const caseId = await createCase('Central Beauty Club', 'queue_beauty_advisory');

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const captured = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });

    assert.equal(captured.businessUnit, 'Central Beauty Club');
    assert.equal(captured.queueId, 'queue_beauty_advisory');
    assert.equal(captured.surveyId, 'SV_qualtrics_central_beauty_club');
  });

  test('T1.7.3 - Case record updated with surveyStatus DISPATCHED and distributionId', async () => {
    const caseId = await createCase();

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const updatedCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
      const c = await cRes.json();
      return c.surveyStatus === 'DISPATCHED' ? c : null;
    }, { description: 'Case surveyStatus DISPATCHED' });

    assert.equal(updatedCase.surveyStatus, 'DISPATCHED');
    assert.ok(updatedCase.distributionId);
  });

  test('T1.7.4 - Spam case suppression: closureReason SPAM skips CSAT dispatch (status EXEMPT)', async () => {
    const caseId = await createCase();

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'CLOSED',
        closureReason: 'SPAM_OR_WRONG_NUMBER'
      })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.surveyStatus, 'EXEMPT');

    // Confirm Qualtrics mock did not receive any distribution
    const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
    const qData = await qRes.json();
    assert.equal(qData.distributions.length, 0);
  });

  test('T1.7.5 - Survey dispatch metadata contains handling agent ID for score attribution', async () => {
    const caseId = await createCase('Central', 'queue_luxury_vip', 'agent_specialist_ploi');

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const captured = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });

    assert.equal(captured.embeddedData.agentId, 'agent_specialist_ploi');
    assert.ok(captured.embeddedData.closureTimestamp);
  });
});
