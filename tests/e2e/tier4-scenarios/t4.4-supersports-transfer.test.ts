import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 4.4: Cross-BU Routing Misdirection & Supersports Transfer (Scenario 4)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('Real-World Scenario 4: LINE running shoes inquiry misdirected to Central, transferred to SSP', async () => {
    const senderId = 'U_thanaporn_runner';
    const sessionId = `sess_ssp_${Date.now()}`;

    // 1. Inbound inquiry about marathon shoes misdirected to Central general queue
    const inRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_line_ssp_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_general_line',
          pageName: 'Central General LINE',
          businessUnit: 'Central',
          senderId,
          senderName: 'Thanaporn Runner'
        },
        session: { sessionId, sessionStart: new Date().toISOString(), botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_ssp_${Date.now()}`,
          type: 'TEXT',
          text: 'อยากสอบถามรองเท้าวิ่งมาราธอน Nike Alphafly 3 มีไซส์ 9.5 US ไหมครับ'
        },
        queueId: 'queue_central_support'
      })
    });
    assert.equal(inRes.status, 200);
    const { caseId } = await inRes.json();

    // 2. Central Agent inspects case, notes that inquiry is for Supersports
    await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'ส่งต่อเคสให้ทีม Supersports ผู้เชี่ยวชาญด้านรองเท้าวิ่งมาราธอนค่ะ',
        agentId: 'agent_central_support'
      })
    });

    // 3. Re-assign BU to SSP and queue to queue_ssp_specialist
    const transRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessUnit: 'SSP',
        queueId: 'queue_ssp_specialist',
        ownerId: 'agent_boy_ssp'
      })
    });
    assert.equal(transRes.status, 200);

    // 4. Supersports Agent Boy sends shoe sizing guide
    await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'สวัสดีครับคุณ Thanaporn ทาง Supersports เช็คสต็อก Nike Alphafly 3 ไซส์ 9.5 US มีสินค้าพร้อมส่งครับ',
        type: 'TEXT',
        isInternal: false,
        agentId: 'agent_boy_ssp'
      })
    });

    // Verify outbound push to Zwiz
    const zwizOut = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
      const zData = await zRes.json();
      return zData.messages?.[0] || null;
    });
    assert.equal(zwizOut.message.content.text.includes('Supersports'), true);

    // 5. Close Case
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'SIZING_RECOMMENDED' })
    });

    // 6. Verifications:
    // a. Audit trail contains queue transfer history
    const caseAfterClose = await fetch(`${APP_URL}/api/cases/${caseId}`).then(r => r.json());
    const queueAudit = caseAfterClose.auditLogs.find((a: any) => a.action === 'QUEUE_TRANSFERRED');
    assert.ok(queueAudit);
    assert.equal(queueAudit.queueId, 'queue_ssp_specialist');

    // b. Qualtrics survey correctly targets Supersports survey template
    const distribution = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });
    assert.equal(distribution.businessUnit, 'SSP');
    assert.equal(distribution.queueId, 'queue_ssp_specialist');

    // c. CSAT response captured and attributed to Supersports BU
    await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/simulate/response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        distributionId: distribution.distributionId,
        csatScore: 5,
        npsScore: 10,
        comment: 'ทีม Supersports ให้คำแนะนำไซส์รองเท้าวิ่งได้แม่นยำมากครับ',
        embeddedData: { businessUnit: 'SSP', agentId: 'agent_boy_ssp' }
      })
    });

    const finalCase = await waitFor(async () => {
      const cRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
      const c = await cRes.json();
      return c.csatScore === 5 ? c : null;
    });
    assert.equal(finalCase.status, 'CLOSED');
    assert.equal(finalCase.businessUnit, 'SSP');
    assert.equal(finalCase.csatScore, 5);
  });
});
