import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 4.2: Central Beauty Club Skin Consultation Journey (Scenario 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('Real-World Scenario 2: Khun Kanya Beauty Club consultation on Facebook Messenger', async () => {
    const senderId = 'fb_psid_kanya_beauty';
    const sessionId = `sess_beauty_${Date.now()}`;

    // 1. Inbound FB photo of skin redness
    const inRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_fb_kanya_${Date.now()}`,
        source: {
          channel: 'FB',
          pageId: 'central_beauty_club',
          pageName: 'Central Beauty Club',
          businessUnit: 'Central Beauty Club',
          senderId,
          senderName: 'Kanya Wattana'
        },
        session: { sessionId, sessionStart: new Date().toISOString(), botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_kanya_${Date.now()}`,
          type: 'IMAGE',
          text: 'ส่งรูปผิวหน้าที่มีรอยแดงค่ะ สนใจโทนเนอร์สูตรอ่อนโยน แนะนำตัวไหนดีคะ',
          media: {
            url: 'https://storage.mock.local/uploads/skin_redness.jpg',
            fileName: 'skin_redness.jpg',
            mimeType: 'image/jpeg',
            fileSize: 245800
          }
        },
        queueId: 'queue_beauty_advisory'
      })
    });
    assert.equal(inRes.status, 200);
    const { caseId } = await inRes.json();

    // 2. Beauty Advisor Ploi accepts case
    await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'agent_ploi_beauty' })
    });

    // 3. Ploi submits whisper note
    await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'แนะนำโทนเนอร์สูตร Calendula ปราศจากแอลกอฮอล์ ลูกค้าใหม่มอบคูปองส่วนลด 10%',
        agentId: 'agent_ploi_beauty'
      })
    });

    // 4. Ploi sends recommendation text and image of skincare set
    await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'สวัสดีค่ะคุณ Kanya แนะนำ Kiehls Calendula Herbal-Extract Toner สูตรอ่อนโยนสำหรับผิวแดงระคายเคืองค่ะ',
        type: 'IMAGE',
        mediaUrl: 'https://storage.mock.local/uploads/calendula_toner.jpg',
        isInternal: false,
        agentId: 'agent_ploi_beauty'
      })
    });

    // 5. Ploi creates Quotation draft linked to case
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [
          { sku: 'KHL-CAL-250', productName: 'Calendula Toner 250ml', quantity: 1, unitPrice: 1650, discount: 165 }
        ],
        shippingFee: 0,
        discountTotal: 165
      })
    });
    assert.equal(quoteRes.status, 201);

    // 6. Case resolved & closed
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'QUOTATION_ISSUED' })
    });

    // 7. Verifications
    // a. Zwiz mock receives botState reset
    const zwizSync = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?caseId=${caseId}`);
      const zData = await zRes.json();
      return zData.updates?.[0] || null;
    });
    assert.equal(zwizSync.userId, senderId);
    assert.equal(zwizSync.botState, 'ACTIVE');

    // b. Qualtrics mock receives Beauty Club survey dispatch
    const distribution = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });
    assert.equal(distribution.businessUnit, 'Central Beauty Club');

    // c. Customer submits CSAT = 4, NPS = 9
    await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/simulate/response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        distributionId: distribution.distributionId,
        csatScore: 4,
        npsScore: 9,
        comment: 'คำแนะนำละเอียดมากค่ะ ได้รับคูปองส่วนลด 10% ด้วย'
      })
    });

    // d. Final case assertions
    const finalCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
      const c = await cRes.json();
      return c.csatScore === 4 ? c : null;
    });
    assert.equal(finalCase.status, 'CLOSED');
    assert.equal(finalCase.quotations.length, 1);
  });
});
