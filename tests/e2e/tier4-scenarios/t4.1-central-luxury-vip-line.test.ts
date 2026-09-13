import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 4.1: Central Department Store VIP Luxury Purchase Journey (Scenario 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('Real-World Scenario 1: Khun Somchai VIP luxury watch purchase on LINE OA', async () => {
    const senderId = 'U_somchai_vip_platinum';
    const sessionId = `sess_vip_${Date.now()}`;

    // 1. Khun Somchai sends LINE message asking about luxury watch availability at Chidlom
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_line_somchai_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store (Official)',
          businessUnit: 'Central',
          senderId,
          senderName: 'Somchai Jaidee',
          senderProfileUrl: 'https://profile.line-scdn.net/somchai.jpg'
        },
        session: { sessionId, sessionStart: new Date().toISOString(), botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_somchai_${Date.now()}`,
          type: 'TEXT',
          text: 'สวัสดีครับ สอบถามสินค้าเรือนเวลาหรู Patek Philippe รุ่นพิเศษ ที่สาขาชิดลม มีของไหมครับ'
        },
        queueId: 'queue_central_luxury_vip'
      })
    });
    assert.equal(inboundRes.status, 200);
    const { caseId } = await inboundRes.json();

    // 2. Inbound webhook created Case assigned to VIP queue
    const initialCase = await fetch(`${APP_URL}/api/cases/${caseId}`).then(r => r.json());
    assert.equal(initialCase.businessUnit, 'Central');
    assert.equal(initialCase.queueId, 'queue_central_luxury_vip');

    // 3. Concierge Agent Sarah Connor accepts the case
    await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'agent_sarah_connor' })
    });

    // 4. Sarah pastes inventory screenshot via clipboard paste endpoint
    const uploadRes = await fetch(`${APP_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'vault_watch_stock_verification.png',
        mimeType: 'image/png',
        fileSize: 845000,
        width: 1920,
        height: 1080
      })
    });
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.url);

    // 5. Sarah adds internal whisper note: item reserved in VIP vault
    await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'ตรวจสอบกับคุณ Anand ที่สาขาชิดลมแล้ว ล็อคสินค้า 1 เรือนไว้ใน VIP Vault เรียบร้อยค่ะ',
        agentId: 'agent_sarah_connor'
      })
    });

    // Verify zero outbound messages to customer for whisper note
    const zwizCheck = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`).then(r => r.json());
    assert.equal(zwizCheck.messages.length, 0);

    // 6. Sarah sends outbound message with reservation confirmation and appointment
    await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'เรียนคุณ Somchai สินค้ามีพร้อมจำหน่าย 1 เรือน ทางเราล็อคสินค้าไว้ใน VIP Lounge สาขาชิดลมให้เรียบร้อยแล้วครับ เรียนเชิญเวลา 14:00 น. ครับ',
        type: 'IMAGE',
        mediaUrl: uploadData.url,
        isInternal: false,
        agentId: 'agent_sarah_connor'
      })
    });

    // 7. Khun Somchai confirms appointment
    await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_somchai_ack_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_department_store', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_ack_${Date.now()}`, type: 'TEXT', text: 'ยอดเยี่ยมครับ เดี๋ยวบ่ายสองเข้าไปรับของครับ' }
      })
    });

    // 8. Sarah marks Case as Resolved, then Closed
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

    // 9. Verifications:
    // a. Zwiz bot state reset to ACTIVE
    const zwizSync = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?caseId=${caseId}`);
      const zData = await zRes.json();
      return zData.updates?.[0] || null;
    });
    assert.equal(zwizSync.userId, senderId);
    assert.equal(zwizSync.botState, 'ACTIVE');

    // b. Qualtrics survey dispatched with VIP parameters
    const distribution = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });
    assert.equal(distribution.businessUnit, 'Central');
    assert.equal(distribution.queueId, 'queue_central_luxury_vip');

    // c. Simulated customer submits CSAT response: 5/5
    const simRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/simulate/response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        distributionId: distribution.distributionId,
        csatScore: 5,
        npsScore: 10,
        cesScore: 1,
        comment: 'คุณ Sarah บริการดีเยี่ยมมากครับ ประทับใจการดูแลระดับ VIP'
      })
    });
    assert.equal(simRes.status, 200);

    // d. Verify Case reflects CSAT 5/5
    const finalCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
      const c = await cRes.json();
      return c.csatScore === 5 ? c : null;
    });
    assert.equal(finalCase.status, 'CLOSED');
    assert.equal(finalCase.feedbackComment, 'คุณ Sarah บริการดีเยี่ยมมากครับ ประทับใจการดูแลระดับ VIP');
  });
});
