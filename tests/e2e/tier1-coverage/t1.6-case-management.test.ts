import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 1.6: Case Management & Multi-BU Scoping (R3 / F6)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createCase(bu = 'Central', channel = 'LINE', queueId = 'queue_central_sales') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_case_${Date.now()}_${Math.random()}`,
        source: { channel, pageId: `page_${bu.toLowerCase()}`, businessUnit: bu, senderId: `U_${Date.now()}` },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: `Inquiry for ${bu}` },
        queueId
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.6.1 - Full status progression: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED', async () => {
    const caseId = await createCase();

    // 1. OPEN -> IN_PROGRESS
    const p1 = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    assert.equal(p1.status, 200);
    const d1 = await p1.json();
    assert.equal(d1.case.status, 'IN_PROGRESS');

    // 2. IN_PROGRESS -> RESOLVED
    const p2 = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    assert.equal(p2.status, 200);
    const d2 = await p2.json();
    assert.equal(d2.case.status, 'RESOLVED');
    assert.ok(d2.case.resolvedAt);

    // 3. RESOLVED -> CLOSED
    const p3 = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert.equal(p3.status, 200);
    const d3 = await p3.json();
    assert.equal(d3.case.status, 'CLOSED');
    assert.ok(d3.case.closedAt);
  });

  test('T1.6.2 - Multi-BU data scoping filter (Central vs Muji vs SSP vs B2S)', async () => {
    await createCase('Central');
    await createCase('Central');
    await createCase('Muji');
    await createCase('SSP');
    await createCase('B2S');

    // Filter by Central
    const cRes = await fetch(`${APP_URL}/api/cases?bu=Central`);
    const cData = await cRes.json();
    assert.equal(cData.cases.length, 2);
    assert.ok(cData.cases.every((c: any) => c.businessUnit === 'Central'));

    // Filter by Muji
    const mRes = await fetch(`${APP_URL}/api/cases?bu=Muji`);
    const mData = await mRes.json();
    assert.equal(mData.cases.length, 1);
    assert.equal(mData.cases[0].businessUnit, 'Muji');

    // Filter by SSP
    const sRes = await fetch(`${APP_URL}/api/cases?bu=SSP`);
    const sData = await sRes.json();
    assert.equal(sData.cases.length, 1);
    assert.equal(sData.cases[0].businessUnit, 'SSP');
  });

  test('T1.6.3 - Queue assignment routing based on BU and channel', async () => {
    const caseId = await createCase('Muji', 'IG', 'queue_muji_furniture');

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();

    assert.equal(caseData.businessUnit, 'Muji');
    assert.equal(caseData.channel, 'IG');
    assert.equal(caseData.queueId, 'queue_muji_furniture');
  });

  test('T1.6.4 - Case ownership assignment updates ownerId and logs audit event', async () => {
    const caseId = await createCase();

    const assignRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'agent_sarah_01' })
    });

    assert.equal(assignRes.status, 200);
    const data = await assignRes.json();
    assert.equal(data.case.ownerId, 'agent_sarah_01');

    const auditEntry = data.case.auditLogs.find((a: any) => a.action === 'OWNER_ASSIGNED');
    assert.ok(auditEntry);
    assert.equal(auditEntry.ownerId, 'agent_sarah_01');
  });

  test('T1.6.5 - Priority re-ranking (Medium to Critical) updates priority field', async () => {
    const caseId = await createCase();

    const rankRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: 'CRITICAL' })
    });

    assert.equal(rankRes.status, 200);
    const data = await rankRes.json();
    assert.equal(data.case.priority, 'CRITICAL');
  });
});
