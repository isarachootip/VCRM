import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 5.1: Adversarial Stress & Multi-BU Isolation Challenge (M6 Challenger 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  // =========================================================================
  // Challenge 1: Concurrency Races and Active Session Reuse
  // =========================================================================
  test('CH1.1 - Simultaneous inbound messages for identical session should map to single Case ID without race condition', async () => {
    const sessionId = `sess_simultaneous_${Date.now()}`;
    const senderId = 'U_simul_cust_01';

    // Fire two messages simultaneously via Promise.all
    const [r1, r2] = await Promise.all([
      fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: `evt_simul_1_${Date.now()}`,
          source: { channel: 'LINE', pageId: 'cds_main', businessUnit: 'Central', senderId },
          session: { sessionId, botState: 'AGENT_HANDOFF' },
          message: { messageId: `msg_s1_${Date.now()}`, type: 'TEXT', text: 'Simultaneous message 1' }
        })
      }),
      fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: `evt_simul_2_${Date.now()}`,
          source: { channel: 'LINE', pageId: 'cds_main', businessUnit: 'Central', senderId },
          session: { sessionId, botState: 'AGENT_HANDOFF' },
          message: { messageId: `msg_s2_${Date.now()}`, type: 'TEXT', text: 'Simultaneous message 2' }
        })
      })
    ]);

    assert.equal(r1.status, 200, 'First concurrent message must succeed with HTTP 200');
    assert.equal(r2.status, 200, 'Second concurrent message must succeed with HTTP 200');

    const d1 = await r1.json();
    const d2 = await r2.json();

    // Adversarial Assertion: Both simultaneous messages MUST resolve to the exact same case
    assert.equal(d1.caseId, d2.caseId, 'Concurrency race: Simultaneous inbound requests created two distinct cases instead of reusing active session!');
  });

  test('CH1.2 - Active session reuse across LINE, FB, and IG under simultaneous inbound traffic', async () => {
    const senderIdLine = `U_omni_line_${Date.now()}`;
    const senderIdFb = `U_omni_fb_${Date.now()}`;
    const senderIdIg = `U_omni_ig_${Date.now()}`;

    // Simultaneous traffic across 3 channels for different BUs
    const results = await Promise.all([
      fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { channel: 'LINE', pageId: 'central_line', businessUnit: 'Central', senderId: senderIdLine },
          session: { sessionId: `sess_line_${Date.now()}`, botState: 'AGENT_HANDOFF' },
          message: { messageId: `msg_line_${Date.now()}`, type: 'TEXT', text: 'Central LINE inquiry' }
        })
      }),
      fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { channel: 'FB', pageId: 'beauty_club_fb', businessUnit: 'Central Beauty Club', senderId: senderIdFb },
          session: { sessionId: `sess_fb_${Date.now()}`, botState: 'AGENT_HANDOFF' },
          message: { messageId: `msg_fb_${Date.now()}`, type: 'TEXT', text: 'Beauty Club FB inquiry' }
        })
      }),
      fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { channel: 'IG', pageId: 'muji_ig', businessUnit: 'Muji', senderId: senderIdIg },
          session: { sessionId: `sess_ig_${Date.now()}`, botState: 'AGENT_HANDOFF' },
          message: { messageId: `msg_ig_${Date.now()}`, type: 'TEXT', text: 'Muji IG inquiry' }
        })
      })
    ]);

    for (const res of results) {
      assert.equal(res.status, 200, 'Cross-channel simultaneous traffic must succeed');
    }

    const [dLine, dFb, dIg] = await Promise.all(results.map(r => r.json()));
    assert.notEqual(dLine.caseId, dFb.caseId);
    assert.notEqual(dFb.caseId, dIg.caseId);
  });

  // =========================================================================
  // Challenge 2: Out-of-Order Delivery & Case Resolution
  // =========================================================================
  test('CH2.1 - Inbound customer message arriving while Case is in RESOLVED status should reopen case or attach without creating duplicate orphan case', async () => {
    const sessionId = `sess_resolved_test_${Date.now()}`;
    const senderId = 'U_resolved_cust_01';

    // 1. Initial Inbound Message
    const inRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds_main', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_init_${Date.now()}`, type: 'TEXT', text: 'สอบถามสินค้าพร้อมส่ง' }
      })
    });
    const { caseId: originalCaseId } = await inRes.json();

    // 2. Agent changes status to RESOLVED
    const resolveRes = await fetch(`${APP_URL}/api/cases/${originalCaseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED', resolutionCategory: 'INQUIRY_ANSWERED' })
    });
    assert.equal(resolveRes.status, 200);

    // 3. Customer sends a follow-up message while case is RESOLVED
    const followUpRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds_main', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_followup_${Date.now()}`, type: 'TEXT', text: 'ขอบคุณครับ แต่มีคำถามเพิ่มเติมเรื่องการจัดส่งครับ' }
      })
    });
    assert.equal(followUpRes.status, 200);
    const followUpData = await followUpRes.json();

    // Adversarial Assertion: Follow-up message MUST attach to the existing case or reopen it,
    // NOT create an orphaned second case for the exact same active customer session!
    assert.equal(
      followUpData.caseId,
      originalCaseId,
      `State machine defect: Follow-up message created new case ${followUpData.caseId} instead of reusing resolved case ${originalCaseId}!`
    );
  });

  test('CH2.2 - Out-of-order duplicate event replay after case closure must return duplicate: true and not spawn new case', async () => {
    const sessionId = `sess_close_replay_${Date.now()}`;
    const senderId = 'U_replay_cust_01';
    const msgId = `msg_replayed_${Date.now()}`;

    // 1. Initial message
    const inRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds_main', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: msgId, type: 'TEXT', text: 'Original message' }
      })
    });
    const { caseId } = await inRes.json();

    // 2. Close case
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    // 3. Replay exact same event payload (network duplicate delivery post-closure)
    const replayRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds_main', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: msgId, type: 'TEXT', text: 'Original message' }
      })
    });

    assert.equal(replayRes.status, 200);
    const replayData = await replayRes.json();
    assert.equal(replayData.duplicate, true, 'Replayed event must be flagged as duplicate');
    assert.equal(replayData.caseId, caseId, 'Replayed event must map to original case');
  });

  // =========================================================================
  // Challenge 3: Multi-BU Data Isolation & Partitioning
  // =========================================================================
  test('CH3.1 - Case query strictly enforces BU filtering across Central, Beauty Club, Muji, SSP, and B2S', async () => {
    const bus = ['Central', 'Central Beauty Club', 'Muji', 'SSP', 'B2S'];
    const createdMap: Record<string, string> = {};

    for (const bu of bus) {
      const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { channel: 'LINE', pageId: `page_${bu.toLowerCase().replace(/\s+/g, '_')}`, businessUnit: bu, senderId: `U_${bu}_cust` },
          session: { sessionId: `sess_${bu}_${Date.now()}`, botState: 'AGENT_HANDOFF' },
          message: { messageId: `msg_${bu}_${Date.now()}`, type: 'TEXT', text: `Inquiry for ${bu}` }
        })
      });
      const data = await res.json();
      createdMap[bu] = data.caseId;
    }

    // Verify filtered query for each BU contains ONLY cases for that BU
    for (const bu of bus) {
      const res = await fetch(`${APP_URL}/api/cases?bu=${encodeURIComponent(bu)}`);
      assert.equal(res.status, 200);
      const data = await res.json();

      // Check all returned cases belong to this BU
      for (const c of data.cases) {
        assert.equal(
          c.businessUnit.toLowerCase(),
          bu.toLowerCase(),
          `Data Leakage: Case ${c.id} from BU ${c.businessUnit} returned in query for BU ${bu}!`
        );
      }
    }
  });

  test('CH3.2 - Transferring case across BUs correctly synchronizes queue and survey configuration', async () => {
    // 1. Create B2S Case
    const inRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'b2s_page', businessUnit: 'B2S', senderId: 'U_b2s_trans' },
        session: { sessionId: `sess_b2s_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_b2s_${Date.now()}`, type: 'TEXT', text: 'B2S inquiry to transfer' },
        queueId: 'queue_b2s_stationery'
      })
    });
    const { caseId } = await inRes.json();

    // 2. Transfer to Muji queue
    const transferRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessUnit: 'Muji',
        queueId: 'queue_muji_stationery'
      })
    });
    assert.equal(transferRes.status, 200);

    // 3. Close case and verify Qualtrics survey matches Muji template
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const distribution = await waitFor(async () => {
      const qRes = await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/inspect/distributions?caseId=${caseId}`);
      const qData = await qRes.json();
      return qData.distributions?.[0] || null;
    });

    assert.ok(distribution, 'Qualtrics distribution should be dispatched');
    assert.equal(distribution.businessUnit, 'Muji', 'Survey businessUnit must reflect transferred BU');
    assert.equal(distribution.queueId, 'queue_muji_stationery', 'Survey queueId must reflect transferred queue');
  });
});
