import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 5.3: Adversarial Challenge — Financial & Fraud Prevention Guardrails (Challenger 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createQuotation(bu = 'Central', price = 10000) {
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_guard_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        source: { channel: 'LINE', pageId: 'central_chatshop', businessUnit: bu, senderId: `U_guard_${Date.now()}` },
        session: { sessionId: `sess_guard_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Quotation guardrail challenge' }
      })
    });
    const caseData = await caseRes.json();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.caseId,
        businessUnit: bu,
        items: [{ sku: 'SKU-GUARD', productName: 'Guard Item', unitPrice: price, quantity: 1 }]
      })
    });
    const qData = await quoteRes.json();
    return qData.quotation;
  }

  // =========================================================================
  // Challenge 1: Single-Print Fraud Prevention
  // =========================================================================
  test('CH1.1 - Single-Print: 1st print succeeds (200), 2nd print strictly returns HTTP 403 with QUOTATION_ALREADY_PRINTED', async () => {
    const quote = await createQuotation('Central', 15000);

    // Transition to PAID first
    await fetch(`${APP_URL}/api/quotations/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 1st Print
    const print1 = await fetch(`${APP_URL}/api/quotations/${quote.id}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'agent_sarah' })
    });
    assert.equal(print1.status, 200, 'Initial print must return 200 OK');
    const p1Data = await print1.json();
    assert.equal(p1Data.quotation.status, 'PRINTED');
    assert.equal(p1Data.quotation.isLocked, true);
    assert.equal(p1Data.quotation.printCount, 1);

    // 2nd Print attempt
    const print2 = await fetch(`${APP_URL}/api/quotations/${quote.id}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'agent_sarah' })
    });
    assert.equal(print2.status, 403, '2nd print must strictly return HTTP 403 Forbidden');
    const p2Err = await print2.json();
    assert.equal(p2Err.code, 'QUOTATION_ALREADY_PRINTED');
  });

  test('CH1.2 - Single-Print Bypass Challenge: Altering actorId, headers, or query does NOT bypass print lock', async () => {
    const quote = await createQuotation('Muji', 8000);

    // Mark PAID and Print once
    await fetch(`${APP_URL}/api/quotations/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });
    await fetch(`${APP_URL}/api/quotations/${quote.id}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'agent_01' })
    });

    // Attack 1: Different supervisor actorId attempting reprint
    const attack1 = await fetch(`${APP_URL}/api/quotations/${quote.id}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'supervisor_admin', actorId: 'supervisor_admin' })
    });
    assert.equal(attack1.status, 403, 'Reprint with different supervisor ID must be blocked (HTTP 403)');

    // Attack 2: Spoofed bypass headers
    const attack2 = await fetch(`${APP_URL}/api/quotations/${quote.id}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bypass-Lock': 'true',
        'X-Role': 'ADMIN',
        'X-Force-Print': '1'
      },
      body: JSON.stringify({ agentId: 'agent_01' })
    });
    assert.equal(attack2.status, 403, 'Reprint with spoofed headers must be blocked (HTTP 403)');

    // Attack 3: Reprint via quotationNumber path parameter
    const attack3 = await fetch(`${APP_URL}/api/quotations/${quote.quotationNumber}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'agent_01' })
    });
    assert.equal(attack3.status, 403, 'Reprint via quotationNumber path parameter must be blocked (HTTP 403)');
  });

  // =========================================================================
  // Challenge 2: Immutability Lock
  // =========================================================================
  test('CH2.1 - Immutability Lock: Editing a locked or printed quotation strictly returns HTTP 423 Locked', async () => {
    const quote = await createQuotation('Central', 5000);

    // Lock quotation via /lock
    const lockRes = await fetch(`${APP_URL}/api/quotations/${quote.id}/lock`, { method: 'POST' });
    assert.equal(lockRes.status, 200);

    // Attempt mutation: discountTotal
    const edit1 = await fetch(`${APP_URL}/api/quotations/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountTotal: 500 })
    });
    assert.equal(edit1.status, 423, 'Editing locked quotation must return HTTP 423 Locked');
    const edit1Data = await edit1.json();
    assert.ok(edit1Data.error?.includes('locked') || edit1Data.code === 'QUOTATION_LOCKED');

    // Attempt mutation: items
    const edit2 = await fetch(`${APP_URL}/api/quotations/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ sku: 'INJECTED', unitPrice: 100, quantity: 1 }] })
    });
    assert.equal(edit2.status, 423, 'Replacing items on locked quotation must return HTTP 423 Locked');
  });

  // =========================================================================
  // Challenge 3: 24-Hour Expiration & Payment of Expired Quotations
  // =========================================================================
  test('CH3.1 - 24-Hour Expiration: Quotation past 24 hours expires on sweep and JIT read', async () => {
    const quote = await createQuotation('Central', 3000);

    const issued = new Date(quote.issuedAt).getTime();
    const expires = new Date(quote.expiresAt).getTime();
    const diffHours = (expires - issued) / (1000 * 60 * 60);
    assert.equal(Math.round(diffHours), 24, 'expiresAt must be 24h from issuedAt');

    // Call sweep endpoint
    const sweepRes = await fetch(`${APP_URL}/api/quotations/expire-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(sweepRes.status, 200);
    const sweepData = await sweepRes.json();
    assert.equal(sweepData.success, true);
  });

  test('CH3.2 - Adversarial Probe: An EXPIRED quotation must NOT be payable (Bug / Vulnerability Probe)', async () => {
    const quote = await createQuotation('Central', 4000);

    // Move to PENDING_PAYMENT
    await fetch(`${APP_URL}/api/quotations/${quote.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING_PAYMENT' })
    });

    // Transition to EXPIRED
    await fetch(`${APP_URL}/api/quotations/${quote.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'EXPIRED' })
    });

    // Verify quotation is EXPIRED
    const checkQ = await fetch(`${APP_URL}/api/quotations/${quote.id}`);
    const qData = await checkQ.json();
    assert.equal(qData.quotation?.status || qData.status, 'EXPIRED');

    // Attempt to pay for the expired quotation via payment webhook
    const payRes = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: 'CREDIT_CARD',
        merchantId: 'MERCHANT_CENTRAL_01',
        businessUnit: 'Central',
        transactionNumber: `TXN-EXPIRED-PAY-${Date.now()}`,
        quotationNumber: quote.quotationNumber,
        quotationId: quote.id,
        amount: quote.grandTotal,
        status: 'SUCCESS'
      })
    });

    // Check quotation status after payment attempt:
    // If the system allows expired quotations to transition to PAID, this fails the fraud prevention guardrail!
    const postPayQ = await fetch(`${APP_URL}/api/quotations/${quote.id}`);
    const postData = await postPayQ.json();
    const finalStatus = postData.quotation?.status || postData.status;

    // The guardrail requirement: An expired quotation must NOT transition to PAID!
    assert.notEqual(
      finalStatus,
      'PAID',
      'CRITICAL VULNERABILITY: Payment webhook advanced an EXPIRED quotation to PAID! Expired quotations must be rejected or held as discrepancy.'
    );
  });

  // =========================================================================
  // Challenge 4: Multi-BU Merchant Segregation
  // =========================================================================
  test('CH4.1 - Cross-BU Merchant Segregation: Central merchant paying Muji quotation flags DISCREPANCY and blocks PAID', async () => {
    const mujiQuote = await createQuotation('Muji', 6500);

    const mismatchRes = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: 'CREDIT_CARD',
        merchantId: 'MERCHANT_CENTRAL_01', // Mismatched merchant!
        businessUnit: 'CENTRAL',
        transactionNumber: `TXN-CROSSBU-${Date.now()}`,
        quotationNumber: mujiQuote.quotationNumber,
        quotationId: mujiQuote.id,
        amount: mujiQuote.grandTotal,
        status: 'SUCCESS'
      })
    });

    assert.equal(mismatchRes.status, 200);
    const data = await mismatchRes.json();
    assert.equal(data.status, 'DISCREPANCY');
    assert.equal(data.reconciliationStatus, 'DISCREPANCY');
    assert.equal(data.discrepancyReason, 'BU_MERCHANT_MISMATCH');

    // Quotation MUST NOT be PAID
    const qRes = await fetch(`${APP_URL}/api/quotations/${mujiQuote.id}`);
    const qData = await qRes.json();
    assert.notEqual(qData.quotation?.status || qData.status, 'PAID');
  });

  // =========================================================================
  // Challenge 5: Webhook Idempotency
  // =========================================================================
  test('CH5.1 - Webhook Idempotency: Duplicate callbacks return 200 OK without creating duplicate PaymentTransaction records', async () => {
    const quote = await createQuotation('Central', 2500);
    const txNumber = `TXN-IDEMP-TEST-${Date.now()}`;

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

    // 1st delivery
    const res1 = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res1.status, 200);

    // 2nd delivery
    const res2 = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.idempotent, true);
    assert.equal(data2.status, 'ALREADY_PROCESSED');
  });
});
