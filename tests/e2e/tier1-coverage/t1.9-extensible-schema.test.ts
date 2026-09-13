import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 1.9: Extensible Relational Schema Models (R5 / F9)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createCase(bu = 'Central') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_schema_${Date.now()}_${Math.random()}`,
        source: { channel: 'LINE', pageId: 'central_official', businessUnit: bu, senderId: `U_schema_${Date.now()}` },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Schema testing case' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.9.1 - Case-Message foreign key integrity: multiple messages attached to case', async () => {
    const caseId = await createCase();

    // Attach 3 messages
    for (let i = 1; i <= 3; i++) {
      await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `Reply #${i}`, type: 'TEXT', isInternal: false })
      });
    }

    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();

    // 1 initial inbound + 3 outbound = 4
    assert.equal(caseData.messages.length, 4);
    assert.ok(caseData.messages.every((m: any) => m.caseId === caseId));
  });

  test('T1.9.2 - Quotation model relations: quotation linked to case with line items & 7% VAT', async () => {
    const caseId = await createCase();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [
          { sku: 'DYS-V12', productName: 'Dyson V12 Detect Slim', quantity: 1, unitPrice: 25000, discount: 1000 },
          { sku: 'DYS-ACC', productName: 'Accessory Kit', quantity: 2, unitPrice: 1500, discount: 0 }
        ],
        shippingFee: 0,
        discountTotal: 1000
      })
    });

    assert.equal(quoteRes.status, 201);
    const data = await quoteRes.json();
    const q = data.quotation;

    // Subtotal = (25000 - 1000) + (1500 * 2) = 24000 + 3000 = 27000
    assert.equal(q.subtotal, 27000);
    // VAT 7% = 1890
    assert.equal(q.vatAmount, 1890);
    // Grand Total = 27000 + 1890 - 1000 = 27890
    assert.equal(q.grandTotal, 27890);
    assert.equal(q.status, 'DRAFT');
    assert.equal(q.caseId, caseId);

    // Verify quotation is linked on the Case record
    const caseRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.quotations.length, 1);
    assert.equal(caseData.quotations[0].id, q.id);
  });

  test('T1.9.3 - Quotation 24h expiration timestamp and validation', async () => {
    const caseId = await createCase();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [{ sku: 'PROD-01', unitPrice: 500, quantity: 1 }]
      })
    });

    const data = await quoteRes.json();
    const q = data.quotation;

    assert.ok(q.issuedAt);
    assert.ok(q.expiresAt);

    const issued = new Date(q.issuedAt).getTime();
    const expires = new Date(q.expiresAt).getTime();
    const diffHours = (expires - issued) / (1000 * 60 * 60);

    // Exactly 24 hours difference
    assert.equal(Math.round(diffHours), 24, 'Quotation expiresAt must be exactly 24 hours after issuedAt');
  });

  test('T1.9.4 - Printed lock protection: once printed/locked, modifications are blocked', async () => {
    const caseId = await createCase();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [{ sku: 'PROD-02', unitPrice: 1200, quantity: 1 }]
      })
    });
    const qData = await quoteRes.json();
    const quoteId = qData.quotation.id;

    // Lock quotation (simulating warehouse print)
    const lockRes = await fetch(`${APP_URL}/api/quotations/${quoteId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(lockRes.status, 200);
    const lockData = await lockRes.json();
    assert.equal(lockData.quotation.isLocked, true);
    assert.equal(lockData.quotation.status, 'PRINTED');

    // Attempt to modify locked quotation
    const editRes = await fetch(`${APP_URL}/api/quotations/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountTotal: 500 })
    });

    assert.equal(editRes.status, 423, 'Editing a locked/printed quotation must return HTTP 423 Locked');
  });

  test('T1.9.5 - Multi-BU scoping on cases, quotations, and queues', async () => {
    const cCentral = await createCase('Central');
    const cMuji = await createCase('Muji');

    const [rCentral, rMuji] = await Promise.all([
      fetch(`${APP_URL}/api/cases/${cCentral}`).then(r => r.json()),
      fetch(`${APP_URL}/api/cases/${cMuji}`).then(r => r.json())
    ]);

    assert.equal(rCentral.businessUnit, 'Central');
    assert.equal(rMuji.businessUnit, 'Muji');
    assert.notEqual(rCentral.queueId, rMuji.queueId);
  });
});
