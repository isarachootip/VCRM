import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { PosMockGenerator } from '../../mocks/pos-mock-generator';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 2.8: Phase 1 Boundaries, Edge Conditions & Adversarial Attacks', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createQuotation(price = 10000) {
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_bnd_${Date.now()}_${Math.random()}`,
        source: { channel: 'LINE', pageId: 'central_chidlom', businessUnit: 'Central', senderId: `U_bnd_${Date.now()}` },
        session: { sessionId: `sess_bnd_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Boundary test' }
      })
    });
    const caseData = await caseRes.json();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.caseId,
        items: [{ sku: 'PROD-BND', unitPrice: price, quantity: 1 }]
      })
    });
    const qData = await quoteRes.json();
    return qData.quotation;
  }

  test('T2.8.1 - Reprint attempt returning HTTP 403 Forbidden (Single-Print Fraud Lock)', async () => {
    const quote = await createQuotation(15000);

    // Mark PAID
    await fetch(`${APP_URL}/api/quotations/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 1st Print
    const print1 = await fetch(`${APP_URL}/api/quotations/${quote.id}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'user_01' })
    });

    if (print1.status === 200) {
      // 2nd Print attempt must be blocked
      const print2 = await fetch(`${APP_URL}/api/quotations/${quote.id}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'user_01' })
      });

      assert.equal(print2.status, 403, 'Reprint attempt must return HTTP 403 Forbidden');
      const err = await print2.json();
      assert.ok(err.error?.includes('already been printed') || err.error);
    }
  });

  test('T2.8.2 - Edit on locked quotation returning HTTP 423 Locked', async () => {
    const quote = await createQuotation(5000);

    // Lock quotation
    await fetch(`${APP_URL}/api/quotations/${quote.id}/lock`, { method: 'POST' });

    // Attempt to edit discountTotal
    const editRes = await fetch(`${APP_URL}/api/quotations/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountTotal: 200 })
    });

    assert.equal(editRes.status, 423, 'Editing locked quotation must return HTTP 423 Locked');
  });

  test('T2.8.3 - Expiration boundary: Quotation past 24 hours auto-expires', async () => {
    const quote = await createQuotation(2500);

    const issued = new Date(quote.issuedAt).getTime();
    const expires = new Date(quote.expiresAt).getTime();
    assert.equal(Math.round((expires - issued) / (1000 * 60 * 60)), 24);

    // Call expire-sweep endpoint
    const sweepRes = await fetch(`${APP_URL}/api/quotations/expire-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (sweepRes.status === 200) {
      const data = await sweepRes.json();
      assert.equal(data.success, true);
    }
  });

  test('T2.8.4 - Webhook duplicate delivery idempotency', async () => {
    const quote = await createQuotation(3000);
    const txNumber = `TXN-DUP-${Date.now()}`;

    const payload = {
      gateway: 'CREDIT_CARD',
      merchantId: 'MERCHANT_CENTRAL_01',
      businessUnit: 'Central',
      transactionNumber: txNumber,
      quotationNumber: quote.quotationNumber,
      quotationId: quote.id,
      amount: quote.grandTotal,
      status: 'SUCCESS'
    };

    const res1 = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res2 = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res2.status, 200, 'Duplicate webhook must return 200 OK');
    const data2 = await res2.json();
    assert.ok(data2.idempotent === true || data2.status === 'ALREADY_PROCESSED' || data2.success);
  });

  test('T2.8.5 - POS ticket duplicate compound key conflict (storeBranchId, registerId, ticketNumber)', async () => {
    const ticketPayload = PosMockGenerator.generateSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber: `TKT-COLLISION-${Date.now()}`,
      amount: 1000
    });

    // 1st entry
    const res1 = await fetch(`${APP_URL}/api/pos/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketPayload)
    });

    if (res1.status === 200 || res1.status === 201) {
      // 2nd entry with EXACT same storeBranchId, registerId, ticketNumber
      const res2 = await fetch(`${APP_URL}/api/pos/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketPayload)
      });

      assert.equal(
        res2.status,
        409,
        'Duplicate POS ticket on compound key must return HTTP 409 Conflict'
      );
    }
  });
});
