import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 1.2: Outbound Message Dispatcher (R1 / F2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  // Helper to create an open case
  async function createTestOpenCase(channel = 'LINE', bu = 'Central') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_setup_${Date.now()}`,
        source: {
          channel,
          pageId: 'central_official',
          pageName: 'Central Official',
          businessUnit: bu,
          senderId: 'U_test_cust_001',
          senderName: 'Test Customer'
        },
        session: { sessionId: `sess_setup_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_setup_${Date.now()}`, type: 'TEXT', text: 'Hello CRM' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.2.1 - Agent posts text response to open Case; Zwiz Mock receives message', async () => {
    const caseId = await createTestOpenCase();

    const sendRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'สวัสดีครับ ยินดีให้บริการครับ สินค้ามีพร้อมจำหน่ายครับ',
        type: 'TEXT',
        isInternal: false,
        agentId: 'agent_sarah_01'
      })
    });

    assert.equal(sendRes.status, 201);
    const sendData = await sendRes.json();
    assert.equal(sendData.message.deliveryStatus, 'DELIVERED');

    // Verify Zwiz mock captured the outbound message
    const captured = await waitFor(async () => {
      const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
      const zData = await zwizRes.json();
      return zData.messages?.length > 0 ? zData.messages[0] : null;
    }, { description: 'Zwiz mock captured message' });

    assert.equal(captured.caseId, caseId);
    assert.equal(captured.recipientId, 'U_test_cust_001');
    assert.equal(captured.channel, 'LINE');
    assert.equal(captured.message.content.text, 'สวัสดีครับ ยินดีให้บริการครับ สินค้ามีพร้อมจำหน่ายครับ');
  });

  test('T1.2.2 - Agent sends image attachment; Zwiz Mock captures image payload', async () => {
    const caseId = await createTestOpenCase('FB', 'Central Beauty Club');

    const sendRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'ภาพสินค้าโปรโมชั่นประจำสัปดาห์ค่ะ',
        type: 'IMAGE',
        mediaUrl: 'https://storage.mock.local/uploads/promo_skincare.jpg',
        fileName: 'promo_skincare.jpg',
        mimeType: 'image/jpeg',
        fileSize: 450000,
        isInternal: false
      })
    });

    assert.equal(sendRes.status, 201);

    const captured = await waitFor(async () => {
      const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
      const zData = await zwizRes.json();
      return zData.messages?.length > 0 ? zData.messages[0] : null;
    });

    assert.equal(captured.message.messageType, 'IMAGE');
    assert.equal(captured.message.content.mediaUrl, 'https://storage.mock.local/uploads/promo_skincare.jpg');
    assert.equal(captured.channel, 'FB');
  });

  test('T1.2.3 - Agent sends PDF quotation document; Zwiz Mock captures document payload', async () => {
    const caseId = await createTestOpenCase('IG', 'Muji');

    const sendRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'แนบเอกสารใบเสนอราคาสำหรับโต๊ะอาหารครับ',
        type: 'FILE',
        mediaUrl: 'https://storage.mock.local/uploads/quotation_muji_101.pdf',
        fileName: 'quotation_muji_101.pdf',
        mimeType: 'application/pdf',
        fileSize: 1048576,
        isInternal: false
      })
    });

    assert.equal(sendRes.status, 201);

    const captured = await waitFor(async () => {
      const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
      const zData = await zwizRes.json();
      return zData.messages?.length > 0 ? zData.messages[0] : null;
    });

    assert.equal(captured.message.messageType, 'FILE');
    assert.equal(captured.message.content.fileName, 'quotation_muji_101.pdf');
    assert.equal(captured.channel, 'IG');
  });

  test('T1.2.4 - Agent sends video reply; Zwiz Mock captures video payload', async () => {
    const caseId = await createTestOpenCase('LINE', 'Central');

    const sendRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'วิดีโอสาธิตการใช้งานเครื่องดูดฝุ่น Dyson ครับ',
        type: 'VIDEO',
        mediaUrl: 'https://storage.mock.local/uploads/dyson_demo.mp4',
        fileName: 'dyson_demo.mp4',
        mimeType: 'video/mp4',
        isInternal: false
      })
    });

    assert.equal(sendRes.status, 201);

    const captured = await waitFor(async () => {
      const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
      const zData = await zwizRes.json();
      return zData.messages?.length > 0 ? zData.messages[0] : null;
    });

    assert.equal(captured.message.messageType, 'VIDEO');
    assert.equal(captured.message.content.mediaUrl, 'https://storage.mock.local/uploads/dyson_demo.mp4');
  });

  test('T1.2.5 - Case message status updated to DELIVERED with deliveredAt timestamp', async () => {
    const caseId = await createTestOpenCase();

    const sendRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'ทดสอบการอัปเดตสถานะการส่งข้อความ',
        type: 'TEXT',
        isInternal: false
      })
    });

    const sendData = await sendRes.json();
    assert.equal(sendData.message.deliveryStatus, 'DELIVERED');
    assert.ok(sendData.message.deliveredAt, 'Delivered timestamp must be recorded');

    // Fetch case and inspect message in array
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    const sentMsg = caseData.messages.find((m: any) => m.id === sendData.message.id);
    assert.ok(sentMsg);
    assert.equal(sentMsg.deliveryStatus, 'DELIVERED');
    assert.ok(sentMsg.deliveredAt);
  });
});
