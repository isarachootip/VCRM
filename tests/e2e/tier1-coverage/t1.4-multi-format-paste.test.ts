import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 1.4: Multi-Format Messaging & Composer Clipboard Paste (R2 / F4)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T1.4.1 - Thai Unicode characters preserved verbatim without corruption or Mojibake', async () => {
    const thaiText = 'สวัสดีครับ ขอสอบถามสินค้าคอลเลกชันฤดูใบไม้ร่วง ๒๕๖๙ มีส่วนลดพิเศษไหมครับ 🛍️✨';

    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_thai_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_thai_001', senderName: 'สมชาย ใจดี' },
        session: { sessionId: `sess_thai_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_thai_${Date.now()}`, type: 'TEXT', text: thaiText }
      })
    });

    const data = await res.json();
    const caseRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
    const caseData = await caseRes.json();

    assert.equal(caseData.customer.name, 'สมชาย ใจดี');
    assert.equal(caseData.messages[0].content.text, thaiText);

    // Also verify agent outbound Thai text
    const outboundThai = 'ยินดีต้อนรับคุณสมชายครับ สินค้ามีพร้อมจำหน่ายที่เซ็นทรัลชิดลมครับ';
    await fetch(`${APP_URL}/api/cases/${data.caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: outboundThai, type: 'TEXT', isInternal: false })
    });

    const captured = await waitFor(async () => {
      const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${data.caseId}`);
      const zData = await zwizRes.json();
      return zData.messages?.[0] || null;
    });

    assert.equal(captured.message.content.text, outboundThai);
  });

  test('T1.4.2 - Clipboard paste binary upload endpoint returns URL and media metadata', async () => {
    const pastePayload = {
      fileName: 'screenshot_paste_2026.png',
      mimeType: 'image/png',
      fileSize: 524288,
      width: 1920,
      height: 1080
    };

    const res = await fetch(`${APP_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pastePayload)
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.url);
    assert.equal(data.mimeType, 'image/png');
    assert.equal(data.width, 1920);
    assert.equal(data.height, 1080);
  });

  test('T1.4.3 - High-resolution media upload (4K dimensions and metadata preserved)', async () => {
    const res = await fetch(`${APP_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'luxury_watch_4k.jpg',
        mimeType: 'image/jpeg',
        fileSize: 4194304,
        width: 3840,
        height: 2160
      })
    });

    const data = await res.json();
    assert.equal(data.width, 3840);
    assert.equal(data.height, 2160);
    assert.equal(data.fileSize, 4194304);
  });

  test('T1.4.4 - Inbound message with text caption and media attachment links correctly', async () => {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_cap_${Date.now()}`,
        source: { channel: 'FB', pageId: 'cbc', businessUnit: 'Central Beauty Club', senderId: 'U_fb_cap' },
        session: { sessionId: `sess_cap_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_cap_${Date.now()}`,
          type: 'IMAGE',
          text: 'นี่คือรูปสินค้าที่สนใจ',
          media: {
            url: 'https://storage.mock.local/uploads/product_photo.jpg',
            fileName: 'product_photo.jpg',
            mimeType: 'image/jpeg',
            fileSize: 654321
          }
        }
      })
    });

    const data = await res.json();
    const caseRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
    const caseData = await caseRes.json();
    const msg = caseData.messages[0];

    assert.equal(msg.content.text, 'นี่คือรูปสินค้าที่สนใจ');
    assert.equal(msg.content.mediaUrl, 'https://storage.mock.local/uploads/product_photo.jpg');
    assert.equal(msg.content.fileSize, 654321);
  });

  test('T1.4.5 - Voice memo / audio note ingestion with playback URL', async () => {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_voice_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_line_voice' },
        session: { sessionId: `sess_voice_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_voice_${Date.now()}`,
          type: 'AUDIO',
          text: 'เสียงบันทึกสอบถามสต็อก',
          media: {
            url: 'https://storage.mock.local/uploads/audio_memo.m4a',
            fileName: 'audio_memo.m4a',
            mimeType: 'audio/mp4',
            fileSize: 128000,
            duration: 15
          }
        }
      })
    });

    const data = await res.json();
    const caseRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
    const caseData = await caseRes.json();
    const msg = caseData.messages[0];

    assert.equal(msg.type, 'AUDIO');
    assert.equal(msg.content.mediaUrl, 'https://storage.mock.local/uploads/audio_memo.m4a');
    assert.equal(msg.content.duration, 15);
  });
});
