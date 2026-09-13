import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 2.6: State Machine Violations Boundary (R6 / Tier 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createCase() {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: `U_${Date.now()}` },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'State violation test' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T2.6.1 - Direct transition from OPEN to CLOSED is valid with proper audit stamping', async () => {
    const caseId = await createCase();

    const res = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'DIRECT_CLOSURE' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.case.status, 'CLOSED');
    assert.ok(data.case.auditLogs.some((a: any) => a.action === 'STATUS_CHANGED' && a.newStatus === 'CLOSED'));
  });

  test('T2.6.2 - Agent sending outbound message to a CLOSED case returns HTTP 400', async () => {
    const caseId = await createCase();

    // Close case
    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    // Try to send message
    const sendRes = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Message after close', type: 'TEXT', isInternal: false })
    });

    assert.equal(sendRes.status, 400);
    const data = await sendRes.json();
    assert.ok(data.error.includes('closed case'));
  });

  test('T2.6.3 - Transitioning from CLOSED back to IN_PROGRESS is blocked with HTTP 400', async () => {
    const caseId = await createCase();

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const reopenRes = await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });

    assert.equal(reopenRes.status, 400);
    const data = await reopenRes.json();
    assert.ok(data.error.includes('Invalid status transition'));
  });

  test('T2.6.4 - Adding internal note to a CLOSED case returns HTTP 400', async () => {
    const caseId = await createCase();

    await fetch(`${APP_URL}/api/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });

    const noteRes = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Note after closure', isInternal: true })
    });

    assert.equal(noteRes.status, 400);
    const data = await noteRes.json();
    assert.ok(data.error.includes('closed case'));
  });

  test('T2.6.5 - Modifying quotation items after quotation is Printed/Paid returns HTTP 423 Locked', async () => {
    const caseId = await createCase();

    const qRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, items: [{ sku: 'X1', unitPrice: 100 }] })
    });
    const { quotation } = await qRes.json();

    // Lock quotation
    await fetch(`${APP_URL}/api/quotations/${quotation.id}/lock`, { method: 'POST' });

    // Try modifying
    const editRes = await fetch(`${APP_URL}/api/quotations/${quotation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shippingFee: 99 })
    });

    assert.equal(editRes.status, 423);
    const data = await editRes.json();
    assert.ok(data.error.includes('immutable'));
  });
});
