import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 3.5: Out-of-Order Inbound Events & Deduplication Flow (Pairwise Integration Flow 5)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('Flow 5: Ingest multiple messages in rapid succession with duplicate retry handling', async () => {
    const sessionId = `sess_ooo_${Date.now()}`;
    const senderId = 'U_ooo_cust_01';
    const msgId1 = `msg_ooo_1_${Date.now()}`;
    const msgId2 = `msg_ooo_2_${Date.now()}`;

    // 1. First message arrives
    const r1 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_1_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: msgId1, type: 'TEXT', text: 'สวัสดีครับ ข้อความที่ 1' }
      })
    });
    assert.equal(r1.status, 200);
    const d1 = await r1.json();
    const caseId = d1.caseId;

    // 2. Second message arrives for same session
    const r2 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_2_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: msgId2, type: 'TEXT', text: 'เพิ่มเติมรายละเอียด ข้อความที่ 2' }
      })
    });
    assert.equal(r2.status, 200);
    const d2 = await r2.json();
    assert.equal(d2.caseId, caseId);

    // 3. Network retry: Zwiz delivers msgId2 a second time (duplicate event)
    const r3 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_2_retry_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: msgId2, type: 'TEXT', text: 'เพิ่มเติมรายละเอียด ข้อความที่ 2' }
      })
    });
    assert.equal(r3.status, 200);
    const d3 = await r3.json();
    assert.equal(d3.duplicate, true);

    // 4. Verify thread contains exactly 2 messages in correct sequence
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.messages.length, 2);
    assert.equal(caseData.messages[0].id, msgId1);
    assert.equal(caseData.messages[1].id, msgId2);
  });
});
