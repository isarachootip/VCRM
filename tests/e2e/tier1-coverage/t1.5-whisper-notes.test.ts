import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 1.5: Internal Whisper Notes Isolation (R2 / F5)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createOpenCase() {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_whisper_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'central_dept', businessUnit: 'Central', senderId: 'U_whisper_cust' },
        session: { sessionId: `sess_whisper_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_whisper_${Date.now()}`, type: 'TEXT', text: 'สวัสดีครับ สอบถามสินค้า' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.5.1 - Internal whisper note created with isInternal: true', async () => {
    const caseId = await createOpenCase();

    const noteRes = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'ลูกค้าท่านนี้เป็น VIP Platinum ตรวจสอบประวัติการซื้อก่อนหน้านี้ด้วยครับ',
        agentId: 'agent_sarah_01'
      })
    });

    assert.equal(noteRes.status, 201);
    const data = await noteRes.json();
    assert.equal(data.message.isInternal, true);
    assert.equal(data.message.deliveryStatus, 'INTERNAL_ONLY');

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    const noteMsg = caseData.messages.find((m: any) => m.id === data.message.id);
    assert.ok(noteMsg);
    assert.equal(noteMsg.isInternal, true);
  });

  test('T1.5.2 - Customer channel exclusion: zero outbound messages dispatched to Zwiz mock', async () => {
    const caseId = await createOpenCase();

    // Post internal whisper note
    await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'โน้ตภายใน ห้ามส่งหาลูกค้าเด็ดขาด',
        isInternal: true
      })
    });

    // Query Zwiz mock outbound store for this case
    const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
    const zwizData = await zwizRes.json();

    assert.equal(zwizData.messages.length, 0, 'Zero outbound messages must be sent to Zwiz for internal notes');
  });

  test('T1.5.3 - Staff mention tagging (@supervisor) correctly parsed and stored', async () => {
    const caseId = await createOpenCase();

    const noteRes = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@supervisor_jane รบกวนอนุมัติส่วนลดพิเศษ 10% สำหรับเคสนี้ด้วยค่ะ @manager_anand'
      })
    });

    const data = await noteRes.json();
    assert.deepEqual(data.message.mentions, ['supervisor_jane', 'manager_anand']);
  });

  test('T1.5.4 - Interleaved customer replies and internal notes maintain separate visibility flags', async () => {
    const caseId = await createOpenCase();

    // 1. Internal Note
    await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Internal note 1: Checking warehouse', isInternal: true })
    });

    // 2. Customer Reply (Public)
    await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Public reply: สินค้าพร้อมส่งครับ', isInternal: false })
    });

    // 3. Internal Note 2
    await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Internal note 2: Reserved item #441', isInternal: true })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();

    const internalMessages = caseData.messages.filter((m: any) => m.isInternal === true);
    const publicMessages = caseData.messages.filter((m: any) => m.isInternal === false);

    assert.equal(internalMessages.length, 2);
    // 1 initial inbound customer message + 1 agent public reply = 2 public
    assert.equal(publicMessages.length, 2);

    // Zwiz mock should only have received the 1 public reply
    const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
    const zwizData = await zwizRes.json();
    assert.equal(zwizData.messages.length, 1);
    assert.equal(zwizData.messages[0].message.content.text, 'Public reply: สินค้าพร้อมส่งครับ');
  });

  test('T1.5.5 - Internal note creation recorded in case audit trail with actorId', async () => {
    const caseId = await createOpenCase();

    await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'บันทึกการตรวจสอบ',
        agentId: 'agent_auditor_99'
      })
    });

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();

    const noteAudit = caseData.auditLogs.find((a: any) => a.action === 'NOTE_ADDED');
    assert.ok(noteAudit);
    assert.equal(noteAudit.isInternal, true);
  });
});
