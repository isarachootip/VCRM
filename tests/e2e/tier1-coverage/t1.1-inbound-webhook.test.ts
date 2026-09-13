import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 1.1: Inbound Webhook Ingestion & Case Creation (R1 / F1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T1.1.1 - Ingest LINE OA text message and auto-create Central BU Case', async () => {
    const payload = {
      eventId: `evt_line_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: {
        channel: 'LINE',
        pageId: 'central_department_store',
        pageName: 'Central Department Store',
        businessUnit: 'Central',
        senderId: 'U_line_test_user_001',
        senderName: 'Khun Somchai',
        senderProfileUrl: 'https://profile.line-scdn.net/mock-profile.jpg'
      },
      session: {
        sessionId: `sess_line_${Date.now()}`,
        sessionStart: new Date().toISOString(),
        botState: 'AGENT_HANDOFF'
      },
      message: {
        messageId: `msg_line_${Date.now()}`,
        type: 'TEXT',
        text: 'สวัสดีครับ สอบถามสินค้ากระเป๋า Central Chidlom ครับ'
      }
    };

    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zwiz-Signature': 'mock-valid-signature'
      },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200, 'Webhook response status must be 200 OK');
    const data = await res.json();
    assert.ok(data.caseId, 'Response must return created caseId');
    assert.ok(data.caseNumber, 'Response must return caseNumber');

    const createdCase = await waitFor(async () => {
      const caseRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
      if (caseRes.status === 200) return await caseRes.json();
      return null;
    }, { description: 'Case retrieval in CRM' });

    assert.equal(createdCase.businessUnit, 'Central');
    assert.equal(createdCase.channel, 'LINE');
    assert.equal(createdCase.status, 'OPEN');
    assert.equal(createdCase.customer.channelUserId, 'U_line_test_user_001');
    assert.equal(createdCase.messages.length, 1);
    assert.equal(createdCase.messages[0].content.text, payload.message.text);
  });

  test('T1.1.2 - Ingest FB Messenger image attachment and create Central Beauty Club Case', async () => {
    const payload = {
      eventId: `evt_fb_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: {
        channel: 'FB',
        pageId: 'central_beauty_club',
        pageName: 'Central Beauty Club',
        businessUnit: 'Central Beauty Club',
        senderId: 'fb_psid_kanya_002',
        senderName: 'Kanya Wattana'
      },
      session: {
        sessionId: `sess_fb_${Date.now()}`,
        sessionStart: new Date().toISOString(),
        botState: 'AGENT_HANDOFF'
      },
      message: {
        messageId: `msg_fb_${Date.now()}`,
        type: 'IMAGE',
        text: 'ส่งรูปผิวหน้า แนะนำโทนเนอร์สูตรอ่อนโยนค่ะ',
        media: {
          url: 'https://storage.mock.local/uploads/skin_sample.jpg',
          fileName: 'skin_sample.jpg',
          mimeType: 'image/jpeg',
          fileSize: 345000,
          width: 1080,
          height: 1080
        }
      }
    };

    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.caseId);

    const createdCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
      return cRes.status === 200 ? await cRes.json() : null;
    });

    assert.equal(createdCase.businessUnit, 'Central Beauty Club');
    assert.equal(createdCase.channel, 'FB');
    assert.equal(createdCase.messages[0].type, 'IMAGE');
    assert.equal(createdCase.messages[0].content.mediaUrl, payload.message.media.url);
  });

  test('T1.1.3 - Ingest IG Direct document attachment and create Muji BU Case', async () => {
    const payload = {
      eventId: `evt_ig_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: {
        channel: 'IG',
        pageId: 'muji_thailand',
        pageName: 'MUJI Thailand Official',
        businessUnit: 'Muji',
        senderId: 'ig_user_arak_003',
        senderName: 'Arak Tanaka'
      },
      session: {
        sessionId: `sess_ig_${Date.now()}`,
        sessionStart: new Date().toISOString(),
        botState: 'AGENT_HANDOFF'
      },
      message: {
        messageId: `msg_ig_${Date.now()}`,
        type: 'FILE',
        text: 'รบกวนขอคู่มือประกอบโต๊ะ Oak Dining Table ครับ',
        media: {
          url: 'https://storage.mock.local/uploads/manual.pdf',
          fileName: 'manual.pdf',
          mimeType: 'application/pdf',
          fileSize: 1048576
        }
      }
    };

    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    const createdCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
      return cRes.status === 200 ? await cRes.json() : null;
    });

    assert.equal(createdCase.businessUnit, 'Muji');
    assert.equal(createdCase.channel, 'IG');
    assert.equal(createdCase.messages[0].content.fileName, 'manual.pdf');
  });

  test('T1.1.4 - Active Session Reuse appends message to existing Case without duplicating', async () => {
    const sessionId = `sess_reuse_${Date.now()}`;
    const senderId = 'U_line_reuse_user_004';

    // Message 1
    const res1 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_m1_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Somchai' },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_1_${Date.now()}`, type: 'TEXT', text: 'ข้อความแรก สอบถามสินค้า' }
      })
    });
    const data1 = await res1.json();

    // Message 2 with same session and sender
    const res2 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_m2_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId, senderName: 'Somchai' },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_2_${Date.now()}`, type: 'TEXT', text: 'ข้อความที่สอง เพิ่มเติมรายละเอียด' }
      })
    });
    const data2 = await res2.json();

    assert.equal(data1.caseId, data2.caseId, 'Subsequent message in same active session must map to same Case ID');

    const updatedCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${data1.caseId}`);
      const c = await cRes.json();
      return c.messages.length === 2 ? c : null;
    }, { description: 'Case messages length === 2' });

    assert.equal(updatedCase.messages.length, 2);
    assert.equal(updatedCase.messages[0].content.text, 'ข้อความแรก สอบถามสินค้า');
    assert.equal(updatedCase.messages[1].content.text, 'ข้อความที่สอง เพิ่มเติมรายละเอียด');
  });

  test('T1.1.5 - Session metadata stamping (sessionStart, inboundSource, sessionId)', async () => {
    const sessionStart = '2026-09-12T14:40:00.000Z';
    const sessionId = `sess_stamp_${Date.now()}`;

    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_stamp_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: 'U_stamp_user' },
        session: { sessionId, sessionStart, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_stamp_${Date.now()}`, type: 'TEXT', text: 'เช็ค metadata' }
      })
    });

    const data = await res.json();
    const createdCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
      return cRes.status === 200 ? await cRes.json() : null;
    });

    assert.equal(createdCase.session.sessionId, sessionId);
    assert.equal(createdCase.session.sessionStart, sessionStart);
    assert.equal(createdCase.session.inboundSource, 'ORGANIC_CHAT');
    assert.equal(createdCase.session.botState, 'AGENT_HANDOFF');
  });
});
