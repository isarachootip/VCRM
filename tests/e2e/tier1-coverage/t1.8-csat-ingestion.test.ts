import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 1.8: Inbound Qualtrics CSAT Response Ingestion (R4 / F8)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createClosedCase() {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_csat_setup_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_official', businessUnit: 'Central', senderId: `U_csat_${Date.now()}` },
        session: { sessionId: `sess_csat_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_csat_${Date.now()}`, type: 'TEXT', text: 'Pre-CSAT setup' }
      })
    });
    const data = await res.json();
    await fetch(`${APP_URL}/api/cases/${data.caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    return data.caseId;
  }

  test('T1.8.1 - Inbound Qualtrics webhook updates case with csatScore and csatSubmittedAt', async () => {
    const caseId = await createClosedCase();

    const csatPayload = {
      eventId: `evt_csat_${Date.now()}`,
      surveyId: 'SV_qualtrics_central',
      responseId: `R_resp_${Date.now()}`,
      distributionId: 'EMD_123',
      caseId,
      submittedAt: '2026-09-12T15:30:00.000Z',
      metrics: { csatScore: 5, npsScore: 10, cesScore: 1 },
      feedback: { comment: 'บริการดีมากครับ' }
    };

    const webhookRes = await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(csatPayload)
    });

    assert.equal(webhookRes.status, 200);
    const resData = await webhookRes.json();
    assert.equal(resData.success, true);

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.csatScore, 5);
    assert.equal(caseData.csatSubmittedAt, '2026-09-12T15:30:00.000Z');
    assert.equal(caseData.surveyStatus, 'RESPONDED');
  });

  test('T1.8.2 - Multi-metric recording: CSAT (1-5), NPS (0-10), CES (1-5) stored', async () => {
    const caseId = await createClosedCase();

    await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId: `R_multi_${Date.now()}`,
        caseId,
        metrics: { csatScore: 4, npsScore: 8, cesScore: 2 }
      })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();

    assert.equal(caseData.csatScore, 4);
    assert.equal(caseData.npsScore, 8);
    assert.equal(caseData.cesScore, 2);
  });

  test('T1.8.3 - Feedback comments in Thai and English stored and attached to case', async () => {
    const caseId = await createClosedCase();
    const comment = 'Excellent and rapid consultation from Central team. ขอบคุณมากครับ';

    await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId: `R_comment_${Date.now()}`,
        caseId,
        metrics: { csatScore: 5 },
        feedback: { comment }
      })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.feedbackComment, comment);
  });

  test('T1.8.4 - Low score alert flagging: CSAT score <= 2 triggers supervisorAlert: true', async () => {
    const caseId = await createClosedCase();

    await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId: `R_low_${Date.now()}`,
        caseId,
        metrics: { csatScore: 1, npsScore: 2, cesScore: 5 },
        feedback: { comment: 'ส่งสินค้าล่าช้ากว่ากำหนด 3 วัน' }
      })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();

    assert.equal(caseData.csatScore, 1);
    assert.equal(caseData.supervisorAlert, true, 'Low CSAT score (<=2) must flag supervisorAlert: true');

    const auditEntry = caseData.auditLogs.find((a: any) => a.action === 'CSAT_RECORDED');
    assert.ok(auditEntry);
    assert.equal(auditEntry.supervisorAlert, true);
  });

  test('T1.8.5 - Duplicate webhook guard: identical responseId processed idempotently', async () => {
    const caseId = await createClosedCase();
    const responseId = `R_dedup_${Date.now()}`;

    const payload = {
      responseId,
      caseId,
      metrics: { csatScore: 5, npsScore: 10, cesScore: 1 }
    };

    // First delivery
    const r1 = await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(r1.status, 200);

    // Second duplicate delivery
    const r2 = await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(r2.status, 200);
    const d2 = await r2.json();
    assert.equal(d2.idempotent, true);
  });
});
