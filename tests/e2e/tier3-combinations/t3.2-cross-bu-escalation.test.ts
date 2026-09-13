import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 3.2: Cross-BU Escalation & Transfer Flow (Pairwise Integration Flow 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('Flow 2: Central Beauty Club FB inquiry transferred to Muji with whisper note and Muji CSAT', async () => {
    const senderId = 'fb_user_kanya_transfer';
    const sessionId = `sess_transfer_${Date.now()}`;

    // 1. Inbound FB message for Beauty Club
    const inRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_fb_trans_${Date.now()}`,
        source: {
          channel: 'FB',
          pageId: 'central_beauty_club',
          pageName: 'Central Beauty Club',
          businessUnit: 'Central Beauty Club',
          senderId,
          senderName: 'Kanya Wattana'
        },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_trans_${Date.now()}`,
          type: 'TEXT',
          text: 'สนใจชุดบำรุงผิวแพ้ง่ายของ Muji Sensitive Skin มีขายที่ไหนบ้างคะ'
        },
        queueId: 'queue_beauty_advisory'
      })
    });
    const { caseId } = await inRes.json();

    // 2. Beauty Advisor Ploi inspects case, realizes it belongs to Muji
    const c1 = await fetch(`${APP_URL}/api/cases/${caseId}`).then(r => r.json());
    assert.equal(c1.businessUnit, 'Central Beauty Club');

    // 3. Ploi adds whisper note
    await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'ลูกค้าสอบถามผลิตภัณฑ์ Muji Sensitive Skin ขอย้ายเคสไปยังทีม Muji Skincare ค่ะ',
        agentId: 'agent_ploi_02'
      })
    });

    // 4. Transfer Case: update BU to Muji, queue to queue_muji_skincare, owner to agent_ken_muji
    const transferRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessUnit: 'Muji',
        queueId: 'queue_muji_skincare',
        ownerId: 'agent_ken_muji'
      })
    });
    assert.equal(transferRes.status, 200);

    // 5. Muji Agent Ken sends PDF Skincare Catalog via FB
    const replyRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'สวัสดีครับคุณ Kanya ทาง Muji มีชุด Sensitive Skin พร้อมจำหน่าย แนบแคตตาล็อกและสาขาที่มีสต็อกครับ',
        type: 'FILE',
        mediaUrl: 'https://storage.mock.local/uploads/muji_sensitive_skin.pdf',
        fileName: 'muji_sensitive_skin.pdf',
        isInternal: false,
        agentId: 'agent_ken_muji'
      })
    });
    assert.equal(replyRes.status, 201);

    // Verify Zwiz mock received Muji outbound PDF
    const zwizOut = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
      const zData = await zRes.json();
      return zData.messages?.[0] || null;
    });
    assert.equal(zwizOut.channel, 'FB');
    assert.equal(zwizOut.message.content.fileName, 'muji_sensitive_skin.pdf');

    // 6. Close Case
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'CONSULTATION_COMPLETE' })
    });

    // 7. Qualtrics survey should be targeted to Muji
    const distribution = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });
    assert.equal(distribution.businessUnit, 'Muji');
    assert.equal(distribution.queueId, 'queue_muji_skincare');
  });
});
