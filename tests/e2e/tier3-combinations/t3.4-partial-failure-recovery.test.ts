import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 3.4: Partial Failure & Resilient Recovery Flow (Pairwise Integration Flow 4)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('Flow 4: Resilient recovery when Qualtrics survey trigger fails but Zwiz state sync succeeds', async () => {
    // 1. Create open case
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_fail_retry_01' },
        session: { sessionId: `sess_fail_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Partial failure test' }
      })
    });
    const { caseId } = await initRes.json();

    // 2. Inject 503 error into Qualtrics mock (1 failure)
    await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/control/inject-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/mock/qualtrics/v3/distributions',
        statusCode: 503,
        count: 1
      })
    });

    // 3. Close Case: triggers both Zwiz Bot sync AND Qualtrics survey
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    // 4. Verify Zwiz bot state update SUCCEEDED
    const zwizSync = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?caseId=${caseId}`);
      const zData = await zRes.json();
      return zData.updates?.[0] || null;
    });
    assert.equal(zwizSync.botState, 'ACTIVE');

    // 5. Verify Qualtrics survey marked FAILED_RETRY
    const cRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const cData = await cRes.json();
    assert.equal(cData.surveyStatus, 'FAILED_RETRY');

    // 6. Simulate background retry worker re-triggering Qualtrics dispatch
    // The Qualtrics mock error count (1) has now expired, so the retry will succeed
    const retryDistributionRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/v3/distributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surveyId: 'SV_qualtrics_central',
        caseId,
        caseNumber: cData.caseNumber,
        businessUnit: cData.businessUnit,
        queueId: cData.queueId,
        channel: cData.channel,
        recipient: { customerId: cData.customerId, name: cData.customer.name, channelUserId: cData.customer.channelUserId },
        embeddedData: { agentId: 'agent_01', closureTimestamp: cData.closedAt }
      })
    });
    assert.equal(retryDistributionRes.status, 201);
    const retryData = await retryDistributionRes.json();

    // 7. Verify Qualtrics captured distribution on retry
    const qCaptured = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });
    assert.equal(qCaptured.caseId, caseId);
    assert.equal(qCaptured.distributionId, retryData.result.id);

    // 8. Confirm Zwiz state sync was NOT called again (remains exactly 1 update)
    const zCheck = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?caseId=${caseId}`).then(r => r.json());
    assert.equal(zCheck.updates.length, 1);
  });
});
