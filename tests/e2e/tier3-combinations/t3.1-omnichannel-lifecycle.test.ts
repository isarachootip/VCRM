import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 3.1: Full Omnichannel Lifecycle Flow (Pairwise Integration Flow 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('Flow 1: Complete end-to-end lifecycle from LINE inbound to CSAT survey ingestion', async () => {
    const senderId = 'U_vip_somchai_full';
    const sessionId = `sess_full_${Date.now()}`;

    // Step 1: Inbound Customer Message (LINE OA)
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_line_full_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store (Official)',
          businessUnit: 'Central',
          senderId,
          senderName: 'Somchai Jaidee'
        },
        session: { sessionId, sessionStart: new Date().toISOString(), botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_in_${Date.now()}`,
          type: 'TEXT',
          text: 'สวัสดีครับ สนใจสั่งซื้อกระเป๋ารุ่นใหม่ที่สาขาชิดลม มีของพร้อมส่งไหมครับ'
        },
        queueId: 'queue_central_luxury_vip'
      })
    });
    assert.equal(inboundRes.status, 200);
    const { caseId } = await inboundRes.json();

    // Step 2: Verify Auto Case Creation & Queue Routing
    const c1 = await fetch(`${APP_URL}/api/cases/${caseId}`).then(r => r.json());
    assert.equal(c1.status, 'OPEN');
    assert.equal(c1.businessUnit, 'Central');
    assert.equal(c1.queueId, 'queue_central_luxury_vip');

    // Step 3: Agent Sarah accepts case
    const assignRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'agent_sarah_01' })
    });
    assert.equal(assignRes.status, 200);

    // Step 4: Agent posts internal whisper note (warehouse check)
    const noteRes = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'ตรวจสอบกับคลังชิดลมแล้ว สินค้าเหลือ 2 ใบใน VIP vault',
        agentId: 'agent_sarah_01'
      })
    });
    assert.equal(noteRes.status, 201);

    // Confirm whisper note was NOT sent to customer via Zwiz
    const zwizCheck1 = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`).then(r => r.json());
    assert.equal(zwizCheck1.messages.length, 0);

    // Step 5: Agent posts outbound text + image reply to customer
    const replyRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'สวัสดีครับคุณ Somchai สินค้ามีพร้อมจำหน่ายที่ชิดลม 2 ชิ้นครับ จองให้เรียบร้อยแล้วครับ',
        type: 'IMAGE',
        mediaUrl: 'https://storage.mock.local/uploads/bag_chidlom.jpg',
        isInternal: false,
        agentId: 'agent_sarah_01'
      })
    });
    assert.equal(replyRes.status, 201);

    // Confirm Zwiz mock received customer outbound message
    const zwizCaptured = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
      const zData = await zRes.json();
      return zData.messages?.length > 0 ? zData.messages[0] : null;
    });
    assert.equal(zwizCaptured.recipientId, senderId);
    assert.equal(zwizCaptured.message.content.mediaUrl, 'https://storage.mock.local/uploads/bag_chidlom.jpg');

    // Step 6: Customer replies confirming visit
    await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_cust_reply_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_department_store', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_confirm_${Date.now()}`, type: 'TEXT', text: 'ขอบคุณมากครับ เดี๋ยวบ่ายนี้เข้าไปรับของครับ' }
      })
    });

    // Step 7: Transition Case: Open -> In Progress -> Resolved -> Closed
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'ORDER_COMPLETED' })
    });
    assert.equal(closeRes.status, 200);

    // Step 8: Zwiz Bot State Reset Webhook Dispatched (Zwiz Mock Verified)
    const stateUpdate = await waitFor(async () => {
      const sRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?caseId=${caseId}`);
      const sData = await sRes.json();
      return sData.updates?.length > 0 ? sData.updates[0] : null;
    });
    assert.equal(stateUpdate.botState, 'ACTIVE');
    assert.equal(stateUpdate.action, 'RESET_TO_MAIN_MENU');

    // Step 9: Qualtrics CSAT Survey Dispatched (Qualtrics Mock Verified)
    const distribution = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.length > 0 ? qData.distributions[0] : null;
    });
    assert.equal(distribution.businessUnit, 'Central');

    // Step 10: Qualtrics Customer Responds with CSAT 5/5
    const csatRes = await fetch(`${APP_URL}/api/webhooks/qualtrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId: `R_final_${Date.now()}`,
        distributionId: distribution.distributionId,
        caseId,
        metrics: { csatScore: 5, npsScore: 10, cesScore: 1 },
        feedback: { comment: 'บริการดีเยี่ยม พนักงานดูแลดีมากครับ' }
      })
    });
    assert.equal(csatRes.status, 200);

    // Step 11: Case final verification
    const finalCase = await fetch(`${APP_URL}/api/cases/${caseId}`).then(r => r.json());
    assert.equal(finalCase.status, 'CLOSED');
    assert.equal(finalCase.csatScore, 5);
    assert.equal(finalCase.surveyStatus, 'RESPONDED');
    assert.equal(finalCase.feedbackComment, 'บริการดีเยี่ยม พนักงานดูแลดีมากครับ');
  });
});
