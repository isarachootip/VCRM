import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';
const QUALTRICS_MOCK_URL = 'http://127.0.0.1:4020';

describe('Tier 5.2: Adversarial Resilience, Limits & Isolation Suite (M6 Challenger 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createCase(bu = 'Central', channel = 'LINE') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: {
          channel,
          pageId: `page_${bu.toLowerCase().replace(/\s+/g, '_')}`,
          businessUnit: bu,
          senderId: `U_adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        },
        session: { sessionId: `sess_adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, type: 'TEXT', text: 'Adversarial resilience test case' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  // =========================================================================
  // Challenge 1: Terminal State Lock Integrity
  // =========================================================================
  describe('Challenge 1: Terminal Lock Enforcement on CLOSED Cases', () => {
    test('CH1.1 - Status transition: Reopening a CLOSED case via status endpoint is strictly rejected (HTTP 400)', async () => {
      const caseId = await createCase();

      // Close case
      const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED', closureReason: 'RESOLVED_BY_AGENT' })
      });
      assert.equal(closeRes.status, 200);

      // Attempt to reopen to IN_PROGRESS
      const reopenRes1 = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' })
      });
      assert.equal(reopenRes1.status, 400, 'Reopening CLOSED case to IN_PROGRESS must return HTTP 400');

      // Attempt to reopen to OPEN
      const reopenRes2 = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OPEN' })
      });
      assert.equal(reopenRes2.status, 400, 'Reopening CLOSED case to OPEN must return HTTP 400');
    });

    test('CH1.2 - Messaging lock: Outbound customer messages to CLOSED case are rejected (HTTP 400)', async () => {
      const caseId = await createCase();

      await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' })
      });

      const msgRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Post-close message attempt', type: 'TEXT', isInternal: false })
      });

      assert.equal(msgRes.status, 400, 'Outbound message on closed case must return HTTP 400');
      const err = await msgRes.json();
      assert.ok(err.error?.includes('closed case'), 'Error message must specify closed case restriction');
    });

    test('CH1.3 - Internal note lock: Internal whisper notes to CLOSED case are rejected (HTTP 400)', async () => {
      const caseId = await createCase();

      await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' })
      });

      const noteRes = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Post-close internal note attempt', isInternal: true })
      });

      assert.equal(noteRes.status, 400, 'Adding note on closed case must return HTTP 400');
      const err = await noteRes.json();
      assert.ok(err.error?.includes('closed case'), 'Error message must specify closed case restriction');
    });

    test('CH1.4 - Mutation bypass challenge: Direct PATCH /api/cases/:id on CLOSED case must be blocked', async () => {
      const caseId = await createCase();

      await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' })
      });

      // Adversarial attempt: Mutate title, priority, or businessUnit of a CLOSED case
      const patchRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Illegally Mutated Title Post-Closure',
          priority: 'CRITICAL',
          businessUnit: 'Muji'
        })
      });

      // Adversarial Assertion: A CLOSED case is in immutable terminal lock and must reject any modifications
      // Expected behavior: HTTP 400 or HTTP 423 Locked.
      // If the system returns HTTP 200, it violates the terminal lock invariant.
      assert.ok(
        patchRes.status >= 400,
        `Terminal Lock Violation: Direct PATCH /api/cases/${caseId} on CLOSED case returned HTTP ${patchRes.status} instead of rejecting modification!`
      );
    });
  });

  // =========================================================================
  // Challenge 2: Downstream Outage Handling & Graceful Fallback
  // =========================================================================
  describe('Challenge 2: Downstream Outage Handling (Zwiz & Qualtrics)', () => {
    test('CH2.1 - Zwiz Mock HTTP 500 on outbound message push marks DELIVERY_FAILED and returns HTTP 502', async () => {
      const caseId = await createCase();

      // Inject 500 error on Zwiz outbound endpoint
      await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/control/inject-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/mock/zwiz/v1/messages',
          statusCode: 500,
          count: 1
        })
      });

      const res = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test message during Zwiz 500 error', type: 'TEXT', isInternal: false })
      });

      assert.equal(res.status, 502, 'Downstream Zwiz 500 error must map to HTTP 502 Bad Gateway');

      // Verify message state in CRM
      const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
      const caseData = await caseRes.json();
      const lastMsg = caseData.messages[caseData.messages.length - 1];
      assert.equal(lastMsg.deliveryStatus, 'DELIVERY_FAILED', 'Delivery status must be marked DELIVERY_FAILED');
    });

    test('CH2.2 - Zwiz Mock HTTP 502 on bot state update logs BOT_STATE_SYNC_FAILED and allows closure to complete', async () => {
      const caseId = await createCase();

      // Fetch case to get channelUserId
      const initCase = await (await fetch(`${APP_URL}/api/cases/${caseId}`)).json();
      const channelUserId = initCase.customer.channelUserId;

      // Inject 502 error on Zwiz user state endpoint
      await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/control/inject-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/mock/zwiz/v1/users/${channelUserId}/state`,
          statusCode: 502,
          count: 1
        })
      });

      const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED', closureReason: 'RESOLVED_BY_AGENT' })
      });

      // Case closure must succeed gracefully despite downstream Zwiz error
      assert.equal(closeRes.status, 200, 'Case closure must complete gracefully even if downstream bot sync fails');

      const updatedCase = await (await fetch(`${APP_URL}/api/cases/${caseId}`)).json();
      assert.equal(updatedCase.status, 'CLOSED');
      assert.ok(
        updatedCase.auditLogs.some((a: any) => a.action === 'BOT_STATE_SYNC_FAILED'),
        'Audit log must record BOT_STATE_SYNC_FAILED'
      );
    });

    test('CH2.3 - Qualtrics Mock HTTP 503 on survey distribution marks surveyStatus FAILED_RETRY', async () => {
      const caseId = await createCase('Central Beauty Club', 'FB');

      // Inject 503 error on Qualtrics distributions endpoint
      await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/control/inject-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/mock/qualtrics/v3/distributions',
          statusCode: 503,
          count: 1
        })
      });

      const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED', closureReason: 'RESOLVED_BY_AGENT' })
      });

      assert.equal(closeRes.status, 200, 'Case closure must succeed with HTTP 200');

      const caseData = await (await fetch(`${APP_URL}/api/cases/${caseId}`)).json();
      assert.equal(caseData.status, 'CLOSED');
      assert.equal(caseData.surveyStatus, 'FAILED_RETRY', 'Survey status must transition to FAILED_RETRY on downstream 503');
    });

    test('CH2.4 - Simultaneous downstream outage (Zwiz 500 + Qualtrics 503) does not crash and logs failures', async () => {
      const caseId = await createCase('Muji', 'IG');
      const initCase = await (await fetch(`${APP_URL}/api/cases/${caseId}`)).json();
      const channelUserId = initCase.customer.channelUserId;

      // Inject 500 on Zwiz state update
      await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/control/inject-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/mock/zwiz/v1/users/${channelUserId}/state`,
          statusCode: 500,
          count: 1
        })
      });

      // Inject 503 on Qualtrics survey trigger
      await fetch(`${QUALTRICS_MOCK_URL}/mock/qualtrics/control/inject-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/mock/qualtrics/v3/distributions',
          statusCode: 503,
          count: 1
        })
      });

      // Close case during simultaneous outage
      const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED', closureReason: 'RESOLVED_BY_AGENT' })
      });

      assert.equal(closeRes.status, 200, 'System must withstand dual simultaneous downstream failure');

      const finalCase = await (await fetch(`${APP_URL}/api/cases/${caseId}`)).json();
      assert.equal(finalCase.status, 'CLOSED');
      assert.equal(finalCase.surveyStatus, 'FAILED_RETRY');
      assert.ok(finalCase.auditLogs.some((a: any) => a.action === 'BOT_STATE_SYNC_FAILED'));
    });
  });

  // =========================================================================
  // Challenge 3: Payload Limits & Whisper Note Isolation
  // =========================================================================
  describe('Challenge 3: Payload Limits & Whisper Isolation', () => {
    test('CH3.1 - Media upload limit: Exactly 150MB is accepted (HTTP 200), 150MB + 1 byte rejected (HTTP 413)', async () => {
      const MAX_SIZE = 150 * 1024 * 1024; // 157,286,400 bytes

      // Exactly 150MB
      const exactRes = await fetch(`${APP_URL}/api/media/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'exact_150mb.mp4',
          mimeType: 'video/mp4',
          fileSize: MAX_SIZE
        })
      });
      assert.equal(exactRes.status, 200, 'Media at exactly 150MB boundary must be accepted with HTTP 200');

      // 150MB + 1 byte
      const overRes = await fetch(`${APP_URL}/api/media/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'oversized_150mb_plus_one.mp4',
          mimeType: 'video/mp4',
          fileSize: MAX_SIZE + 1
        })
      });
      assert.equal(overRes.status, 413, 'Media exceeding 150MB limit by 1 byte must be rejected with HTTP 413');
      const overData = await overRes.json();
      assert.ok(overData.error?.includes('Payload Too Large'), 'Error message must specify Payload Too Large');
    });

    test('CH3.2 - Note character limit: Exactly 50,000 characters is accepted (HTTP 201), 50,001 rejected (HTTP 413)', async () => {
      const caseId = await createCase();

      // Exactly 50,000 characters
      const exactNote = 'X'.repeat(50000);
      const exactRes = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: exactNote, isInternal: true })
      });
      assert.equal(exactRes.status, 201, 'Note with exactly 50,000 characters must be accepted with HTTP 201');

      // 50,001 characters
      const overNote = 'Y'.repeat(50001);
      const overRes = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: overNote, isInternal: true })
      });
      assert.equal(overRes.status, 413, 'Note exceeding 50,000 characters must be rejected with HTTP 413');
      const overData = await overRes.json();
      assert.ok(overData.error?.includes('exceeds maximum character limit'), 'Error message must indicate character limit exceeded');
    });

    test('CH3.3 - Whisper note complete customer isolation: Never dispatched to Zwiz mock outbound store', async () => {
      const caseId = await createCase('SSP', 'LINE');

      // Add 3 confidential internal whisper notes with sensitive information
      const secretNotes = [
        'Confidential: Customer has VIP credit line approved for 500,000 THB',
        '@supervisor_john Need immediate override for 15% discount voucher',
        'Internal memo: Do not disclose shipping tracking until batch clearance'
      ];

      for (const note of secretNotes) {
        const res = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: note, isInternal: true })
        });
        assert.equal(res.status, 201);
      }

      // Add 1 public reply to customer
      const pubRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'เรียนลูกค้า ทางเราได้ตรวจสอบรายการแล้วครับ', isInternal: false })
      });
      assert.equal(pubRes.status, 201);

      // Verify Zwiz mock outbound store
      const zwizOutbound = await (await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`)).json();

      // Strictly ONLY the public message must exist in Zwiz outbound
      assert.equal(zwizOutbound.messages.length, 1, 'Exactly 1 message must be dispatched to Zwiz');
      assert.equal(zwizOutbound.messages[0].message.content.text, 'เรียนลูกค้า ทางเราได้ตรวจสอบรายการแล้วครับ');

      // None of the internal confidential text must EVER appear in Zwiz outbound messages
      for (const note of secretNotes) {
        const leaked = zwizOutbound.messages.some((m: any) =>
          JSON.stringify(m).includes(note)
        );
        assert.equal(leaked, false, `Data Leakage Alert: Internal note leaked into customer outbound payload: ${note}`);
      }
    });

    test('CH3.4 - Inbound customer message cannot spoof isInternal: true flag', async () => {
      // Adversarial attempt: Inbound webhook tries to inject isInternal: true in customer message
      const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { channel: 'LINE', pageId: 'cds_main', businessUnit: 'Central', senderId: 'U_spoof_attacker' },
          session: { sessionId: `sess_spoof_${Date.now()}`, botState: 'AGENT_HANDOFF' },
          message: {
            messageId: `msg_spoof_${Date.now()}`,
            type: 'TEXT',
            text: 'Attempting to spoof internal whisper flag',
            isInternal: true
          }
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();

      const caseData = await (await fetch(`${APP_URL}/api/cases/${data.caseId}`)).json();
      const inboundMsg = caseData.messages.find((m: any) => m.content.text === 'Attempting to spoof internal whisper flag');
      assert.ok(inboundMsg);
      assert.equal(inboundMsg.isInternal, false, 'Inbound customer message MUST NOT be tagged isInternal: true');
    });
  });
});
