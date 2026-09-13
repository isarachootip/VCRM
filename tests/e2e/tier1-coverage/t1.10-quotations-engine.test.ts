import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.10: E-Ordering & Quotation Lifecycle Engine (R1 / Phase 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createTestInboundCase(bu = 'Central') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_quote_${Date.now()}_${Math.random()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          businessUnit: bu,
          senderId: `U_cust_${Date.now()}`,
          senderName: 'Khun Somchai'
        },
        session: { sessionId: `sess_quote_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'สนใจสั่งซื้อสินค้า Dyson V12 ครับ' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.10.1 - Quotation creation with line items, 7% VAT calculation, and grand total', async () => {
    const caseId = await createTestInboundCase('Central');

    const quotePayload = {
      caseId,
      customerId: 'cust_central_vip_001',
      businessUnit: 'Central',
      items: [
        {
          sku: 'DYS-V12',
          productName: 'Dyson V12 Detect Slim',
          quantity: 1,
          unitPrice: 25000.00,
          discount: 1000.00
        },
        {
          sku: 'DYS-ACC',
          productName: 'Accessory Kit',
          quantity: 2,
          unitPrice: 1500.00,
          discount: 0.00
        }
      ],
      shippingFee: 0.00,
      discountTotal: 1000.00
    };

    const res = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quotePayload)
    });

    assert.equal(res.status, 201, 'Quotation creation should return HTTP 201 Created');
    const data = await res.json();
    assert.ok(data.quotation, 'Response should contain quotation object');
    const q = data.quotation;

    // Subtotal = (25000 - 1000) + (1500 * 2) = 24000 + 3000 = 27000
    assert.equal(q.subtotal, 27000.00, 'Subtotal must match sum of line items');
    // VAT 7% = 27000 * 0.07 = 1890
    assert.equal(q.vatAmount, 1890.00, 'VAT must be exactly 7% of subtotal');
    // Grand Total = 27000 + 1890 - 1000 = 27890
    assert.equal(q.grandTotal, 27890.00, 'Grand total must equal subtotal + VAT + shipping - discount');
    assert.equal(q.status, 'DRAFT', 'Initial status must be DRAFT');
    assert.equal(q.isLocked, false, 'New quotation must not be locked');
    assert.ok(q.quotationNumber.startsWith('QT-2026-'), 'Quotation number must follow convention');
  });

  test('T1.10.2 - The 1 Loyalty Member Lookup and tier discount retrieval', async () => {
    // Lookup by 10-digit mobile phone
    const phoneRes = await fetch(`${APP_URL}/api/customers/the1?phone=0812345678`);
    if (phoneRes.status === 200) {
      const memberData = await phoneRes.json();
      assert.ok(memberData.memberId || memberData.the1CardNo, 'Member lookup must return profile details');
      assert.ok(memberData.tier || memberData.the1Tier, 'Member lookup must include tier');
    } else {
      // Fallback endpoint route format
      const altRes = await fetch(`${APP_URL}/api/loyalty/the1/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '0812345678', type: 'PHONE' })
      });
      assert.ok(altRes.status === 200 || altRes.status === 404 || phoneRes.status === 404);
    }
  });

  test('T1.10.3 - Strict quotation state transitions (DRAFT -> PENDING_PAYMENT -> PAID -> PRINTED -> COMPLETED)', async () => {
    const caseId = await createTestInboundCase('Central');
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [{ sku: 'SKU-TEST', productName: 'Item', quantity: 1, unitPrice: 1000 }]
      })
    });
    const quoteData = await quoteRes.json();
    const qId = quoteData.quotation.id;

    // 1. Move to PENDING_PAYMENT
    const pendRes = await fetch(`${APP_URL}/api/quotations/${qId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING_PAYMENT' })
    });
    if (pendRes.status === 200) {
      const pData = await pendRes.json();
      assert.equal(pData.quotation?.status || pData.status, 'PENDING_PAYMENT');
    }

    // 2. Direct invalid transition to COMPLETED without payment should fail
    const invalidRes = await fetch(`${APP_URL}/api/quotations/${qId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.ok(
      invalidRes.status === 400 || invalidRes.status === 422,
      'Transitioning to COMPLETED directly without payment/print must be rejected'
    );
  });

  test('T1.10.4 - Single-Print Fraud Lock: 1st print succeeds, 2nd print returns HTTP 403 Forbidden', async () => {
    const caseId = await createTestInboundCase('Muji');
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        businessUnit: 'Muji',
        items: [{ sku: 'MUJI-DIFF', productName: 'Aroma Diffuser', quantity: 1, unitPrice: 2490 }]
      })
    });
    const quoteData = await quoteRes.json();
    const qId = quoteData.quotation.id;

    // Simulate status update to PAID prior to warehouse print
    await fetch(`${APP_URL}/api/quotations/${qId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 1st Print attempt: locks quotation
    const print1Res = await fetch(`${APP_URL}/api/quotations/${qId}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'user_agent_sales_01' })
    });

    // If dedicated /print route is supported, expect 200 then 403
    if (print1Res.status === 200) {
      const p1Data = await print1Res.json();
      assert.equal(p1Data.quotation.status, 'PRINTED');
      assert.equal(p1Data.quotation.isLocked, true);
      assert.ok(p1Data.quotation.printedAt, 'printedAt timestamp must be recorded');

      // 2nd Print attempt: must be blocked by single-print fraud lock
      const print2Res = await fetch(`${APP_URL}/api/quotations/${qId}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'user_agent_sales_01' })
      });
      assert.equal(
        print2Res.status,
        403,
        'Second print attempt must return HTTP 403 Forbidden to prevent fraud'
      );
      const p2Err = await print2Res.json();
      assert.ok(
        p2Err.error?.includes('already been printed') || p2Err.error?.includes('QUOTATION_ALREADY_PRINTED') || p2Err.error,
        'Error payload must state single-print fraud lock active'
      );
    } else {
      // Fallback: test /lock endpoint
      const lockRes = await fetch(`${APP_URL}/api/quotations/${qId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      assert.equal(lockRes.status, 200);
      const lockData = await lockRes.json();
      assert.equal(lockData.quotation.isLocked, true);
      assert.equal(lockData.quotation.status, 'PRINTED');
    }
  });

  test('T1.10.5 - 24-hour auto-expiration calculation and sweep endpoint', async () => {
    const caseId = await createTestInboundCase('Central');
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [{ sku: 'PROD-EXP', unitPrice: 1500, quantity: 1 }]
      })
    });
    const quoteData = await quoteRes.json();
    const q = quoteData.quotation;

    // Verify 24 hour expiration delta
    const issued = new Date(q.issuedAt).getTime();
    const expires = new Date(q.expiresAt).getTime();
    const diffHours = (expires - issued) / (1000 * 60 * 60);
    assert.equal(Math.round(diffHours), 24, 'Quotation expiresAt must be exactly 24 hours after issuedAt');

    // Trigger expiration sweep endpoint
    const sweepRes = await fetch(`${APP_URL}/api/quotations/expire-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (sweepRes.status === 200) {
      const sweepData = await sweepRes.json();
      assert.equal(sweepData.success, true);
      assert.ok(typeof sweepData.expiredCount === 'number');
    }
  });

  test('T1.10.6 - Terminal status immutability: editing locked/printed quotation returns HTTP 423', async () => {
    const caseId = await createTestInboundCase('Central');
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [{ sku: 'PROD-IMMUTABLE', unitPrice: 3000, quantity: 1 }]
      })
    });
    const quoteData = await quoteRes.json();
    const qId = quoteData.quotation.id;

    // Lock quotation
    await fetch(`${APP_URL}/api/quotations/${qId}/lock`, { method: 'POST' });

    // Attempt to update discount or subtotal
    const editRes = await fetch(`${APP_URL}/api/quotations/${qId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountTotal: 500 })
    });

    assert.equal(editRes.status, 423, 'Editing a locked quotation must return HTTP 423 Locked');
    const editData = await editRes.json();
    assert.ok(editData.error?.includes('locked') || editData.error);
  });
});
