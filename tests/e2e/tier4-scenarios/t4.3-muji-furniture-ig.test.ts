import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 4.3: MUJI Home Furniture Assembly Journey (Scenario 3)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('Real-World Scenario 3: Khun Arak Muji furniture consultation on Instagram Direct', async () => {
    const senderId = 'ig_user_arak_muji';
    const sessionId = `sess_muji_${Date.now()}`;

    // 1. Inbound IG direct message asking for PDF assembly manual
    const inRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_ig_arak_${Date.now()}`,
        source: {
          channel: 'IG',
          pageId: 'muji_thailand',
          pageName: 'MUJI Thailand Official',
          businessUnit: 'Muji',
          senderId,
          senderName: 'Arak Tanaka'
        },
        session: { sessionId, sessionStart: new Date().toISOString(), botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_arak_${Date.now()}`,
          type: 'TEXT',
          text: 'รบกวนขอคู่มือประกอบโต๊ะ Oak Dining Table และขนาดอย่างละเอียดด้วยครับ'
        },
        queueId: 'queue_muji_furniture'
      })
    });
    assert.equal(inRes.status, 200);
    const { caseId } = await inRes.json();

    // 2. Agent Ken accepts case
    await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'agent_ken_muji' })
    });

    // 3. Ken uploads PDF manual via media endpoint
    const uploadRes = await fetch(`${APP_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'muji_oak_dining_table_manual.pdf',
        mimeType: 'application/pdf',
        fileSize: 1540000
      })
    });
    const uploadData = await uploadRes.json();

    // 4. Ken sends outbound PDF file message to customer
    await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'สวัสดีครับคุณ Arak แนบไฟล์คู่มือการประกอบและขนาดโต๊ะ Oak Dining Table ครับ หากต้องการนัดวันติดตั้งแจ้งได้ครับ',
        type: 'FILE',
        mediaUrl: uploadData.url,
        fileName: uploadData.fileName,
        isInternal: false,
        agentId: 'agent_ken_muji'
      })
    });

    // Verify Zwiz mock received PDF message
    const zwizOut = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
      const zData = await zRes.json();
      return zData.messages?.[0] || null;
    });
    assert.equal(zwizOut.channel, 'IG');
    assert.equal(zwizOut.message.messageType, 'FILE');
    assert.equal(zwizOut.message.content.fileName, 'muji_oak_dining_table_manual.pdf');

    // 5. Customer replies thanking agent
    await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_arak_thanks_${Date.now()}`,
        source: { channel: 'IG', pageId: 'muji_thailand', businessUnit: 'Muji', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_thanks_${Date.now()}`, type: 'TEXT', text: 'ขอบคุณมากครับ คู่มือชัดเจนมากครับ' }
      })
    });

    // 6. Ken resolves and closes case
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'RESOLVED_BY_AGENT' })
    });

    // 7. Verifications
    // a. Bot state update in Zwiz
    const zwizSync = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?caseId=${caseId}`);
      const zData = await zRes.json();
      return zData.updates?.[0] || null;
    });
    assert.equal(zwizSync.userId, senderId);
    assert.equal(zwizSync.botState, 'ACTIVE');

    // b. Muji Qualtrics survey trigger
    const distribution = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });
    assert.equal(distribution.businessUnit, 'Muji');
    assert.equal(distribution.surveyId, 'SV_qualtrics_muji');

    // c. Customer submits 5-star CSAT
    await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/simulate/response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        distributionId: distribution.distributionId,
        csatScore: 5,
        npsScore: 10,
        comment: 'Fast response and clear PDF guide'
      })
    });

    const finalCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
      const c = await cRes.json();
      return c.csatScore === 5 ? c : null;
    });
    assert.equal(finalCase.status, 'CLOSED');
    assert.equal(finalCase.feedbackComment, 'Fast response and clear PDF guide');
  });
});
