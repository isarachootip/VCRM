import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = 'http://127.0.0.1:3001';

describe('Tier 2.3: Max Length & Oversized Payloads Boundary (R6 / Tier 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T2.3.1 - Inbound message text exceeding 8,000 chars rejected with HTTP 413', async () => {
    const hugeText = 'A'.repeat(10000);

    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_huge_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_huge' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: hugeText }
      })
    });

    assert.equal(res.status, 413);
    const data = await res.json();
    assert.ok(data.error.includes('exceeds maximum length'));
  });

  test('T2.3.2 - Media attachment exceeding 150MB rejected with HTTP 413 Payload Too Large', async () => {
    const res = await fetch(`${APP_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'massive_video.mp4',
        mimeType: 'video/mp4',
        fileSize: 200 * 1024 * 1024 // 200MB > 150MB limit
      })
    });

    assert.equal(res.status, 413);
    const data = await res.json();
    assert.ok(data.error.includes('Payload Too Large'));
  });

  test('T2.3.3 - Internal whisper note exceeding 50,000 characters rejected with HTTP 413', async () => {
    const initRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_note_limit' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'Hello' }
      })
    });
    const { caseId } = await initRes.json();

    const hugeNote = 'B'.repeat(60000);
    const noteRes = await fetch(`${APP_URL}/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: hugeNote, isInternal: true })
    });

    assert.equal(noteRes.status, 413);
    const data = await noteRes.json();
    assert.ok(data.error.includes('exceeds maximum character limit'));
  });

  test('T2.3.4 - Message with 4,000 Unicode Thai characters accepted cleanly', async () => {
    // 100 repetitions of 40-char Thai phrase = 4,000 chars
    const thaiChunk = 'ข้อความทดสอบความยาวภาษาไทยอย่างต่อเนื่อง';
    const thai4k = thaiChunk.repeat(100);

    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_thai4k_${Date.now()}`,
        source: { channel: 'LINE', pageId: 'cds', businessUnit: 'Central', senderId: 'U_thai_4k' },
        session: { sessionId: `sess_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: thai4k }
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    const caseRes = await fetch(`${APP_URL}/api/cases/${data.caseId}`);
    const caseData = await caseRes.json();
    assert.equal(caseData.messages[0].content.text.length, 4000);
  });

  test('T2.3.5 - Quotation with 50 line items calculates correct totals without error', async () => {
    const items = [];
    for (let i = 1; i <= 50; i++) {
      items.push({
        sku: `SKU-${i}`,
        productName: `Item #${i}`,
        quantity: 2,
        unitPrice: 100,
        discount: 10
      });
    }

    const res = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, shippingFee: 50, discountTotal: 0 })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    const q = data.quotation;

    // Per item: 100 * 2 - 10 = 190. 50 items * 190 = 9,500 subtotal
    assert.equal(q.subtotal, 9500);
    // VAT = 9500 * 0.07 = 665
    assert.equal(q.vatAmount, 665);
    // Grand Total = 9500 + 665 + 50 = 10215
    assert.equal(q.grandTotal, 10215);
  });
});
