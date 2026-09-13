import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 2.4: Concurrency & Race Conditions Boundary (R6 / Tier 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T2.4.1 - Two sequential inbound messages for new customer session map to same Case ID', async () => {
    const sessionId = `sess_conc_${Date.now()}`;
    const senderId = 'U_conc_cust_01';

    const r1 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_c1_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_c1_${Date.now()}`, type: 'TEXT', text: 'Msg 1' }
      })
    });
    const d1 = await r1.json();

    const r2 = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_c2_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId },
        session: { sessionId, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_c2_${Date.now()}`, type: 'TEXT', text: 'Msg 2' }
      })
    });
    const d2 = await r2.json();

    assert.equal(d1.caseId, d2.caseId, 'Both messages must link to the exact same case');
  });

  test('T2.4.2 - Two simultaneous agent assignments resolve deterministically', async () => {
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_assign_test' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Assign test' }
      })
    });
    const { caseId } = await initRes.json();

    // Fire 2 assignment patches simultaneously
    const [res1, res2] = await Promise.all([
      fetch(`${APP_URL}/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: 'agent_sarah' })
      }),
      fetch(`${APP_URL}/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: 'agent_ken' })
      })
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.ok(['agent_sarah', 'agent_ken'].includes(caseData.ownerId));
  });

  test('T2.4.3 - Concurrent inbound webhook burst (10 events across 3 BUs) ingested without deadlocks', async () => {
    const bus = ['Central', 'Muji', 'SSP'];
    const promises = [];

    for (let i = 0; i < 10; i++) {
      const bu = bus[i % bus.length];
      promises.push(
        fetch(`${APP_URL}/api/webhooks/zwiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: `evt_burst_${i}_${Date.now()}`,
            source: { channel: 'LINE', pageId: `page_${bu.toLowerCase()}`, businessUnit: bu, senderId: `U_burst_${i}` },
            session: { sessionId: `sess_burst_${i}_${Date.now()}`, botState: 'AGENT_HANDOFF' },
            message: { messageId: `msg_burst_${i}_${Date.now()}`, type: 'TEXT', text: `Burst message ${i}` }
          })
        })
      );
    }

    const responses = await Promise.all(promises);
    assert.equal(responses.length, 10);
    assert.ok(responses.every(r => r.status === 200));

    // Verify all 10 cases were created
    const casesRes = await fetch(`${APP_URL}/api/cases`);
    const casesData = await casesRes.json();
    assert.equal(casesData.total, 10);
  });

  test('T2.4.4 - Concurrent case closure and message handling works gracefully', async () => {
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_close_race' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Race test' }
      })
    });
    const { caseId } = await initRes.json();

    // Close case
    const closeRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert.equal(closeRes.status, 200);

    // Now sending a message to closed case must be blocked
    const msgRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Late message', type: 'TEXT', isInternal: false })
    });
    assert.equal(msgRes.status, 400);
  });

  test('T2.4.5 - Concurrent CSAT response submission and case query remain consistent', async () => {
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_csat_race' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'CSAT race' }
      })
    });
    const { caseId } = await initRes.json();
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const [csatRes, queryRes] = await Promise.all([
      fetch(`${APP_URL}/api/webhooks/qualtrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId: `R_race_${Date.now()}`, caseId, metrics: { csatScore: 5 } })
      }),
      fetch(`${APP_URL}/api/cases/${caseId}`)
    ]);

    assert.equal(csatRes.status, 200);
    assert.equal(queryRes.status, 200);
  });
});
