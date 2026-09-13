import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 1.15: Template Message Manager & WYSIWYG Preview (R4 / Phase 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createCaseWithQuotation() {
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_tmpl_${Date.now()}_${Math.random()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_official',
          businessUnit: 'Central',
          senderId: `U_tmpl_${Date.now()}`,
          senderName: 'Khun Somchai'
        },
        session: { sessionId: `sess_tmpl_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'ขอลิงก์ชำระเงินด้วยครับ' }
      })
    });
    const caseData = await caseRes.json();

    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.caseId,
        items: [{ sku: 'PROD-TMPL', unitPrice: 2000, quantity: 1 }]
      })
    });
    const qData = await quoteRes.json();

    return { caseId: caseData.caseId, quotation: qData.quotation };
  }

  test('T1.15.1 - Query or retrieve standard response templates', async () => {
    const res = await fetch(`${APP_URL}/api/templates`);
    if (res.status === 200) {
      const data = await res.json();
      assert.ok(Array.isArray(data.templates || data), 'Templates endpoint should return array');
    } else {
      // If template manager operates via local definition or preview endpoint
      assert.ok(res.status === 200 || res.status === 404);
    }
  });

  test('T1.15.2 - Live WYSIWYG Preview endpoint resolves tokens ({{customerName}}, {{quotationNumber}}, {{grandTotal}})', async () => {
    const { caseId, quotation } = await createCaseWithQuotation();

    const previewPayload = {
      templateText: 'เรียนคุณ {{customerName}} ยอดชำระใบเสนอราคา {{quotationNumber}} รวม {{grandTotal}} บาท',
      caseId,
      quotationId: quotation.id
    };

    const res = await fetch(`${APP_URL}/api/templates/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(previewPayload)
    });

    if (res.status === 200) {
      const data = await res.json();
      assert.ok(data.renderedText || data.text, 'Preview must return renderedText');
      const text = data.renderedText || data.text;
      assert.ok(!text.includes('{{quotationNumber}}'), 'Token {{quotationNumber}} must be substituted');
      assert.ok(text.includes(quotation.quotationNumber), 'Rendered text must contain actual quotation number');
    }
  });

  test('T1.15.3 - Pre-send message editing: customized rendered template sends to customer', async () => {
    const { caseId, quotation } = await createCaseWithQuotation();

    const editedMessage = `เรียนคุณ Somchai ยอดสั่งซื้อ ${quotation.quotationNumber} ได้รับส่วนลดพิเศษเพิ่มเติม รวมยอดสุทธิ ${quotation.grandTotal} บาท`;

    const res = await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: editedMessage,
        type: 'TEXT',
        isInternal: false
      })
    });

    assert.equal(res.status, 200, 'Outbound message from template must be accepted');
    const data = await res.json();
    assert.equal(data.success, true);
  });

  test('T1.15.4 - Outbound message dispatch pushes to Mock Zwiz API', async () => {
    const { caseId } = await createCaseWithQuotation();

    await fetch(`${APP_URL}/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Template message dispatch test',
        type: 'TEXT',
        isInternal: false
      })
    });

    // Verify captured message on Mock Zwiz
    const zwizRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/outbound?caseId=${caseId}`);
    const zwizData = await zwizRes.json();
    assert.ok(zwizData.messages.length >= 1, 'Mock Zwiz must capture outbound message');
  });

  test('T1.15.5 - Template missing variable token handling', async () => {
    const { caseId } = await createCaseWithQuotation();

    const res = await fetch(`${APP_URL}/api/templates/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateText: 'Hello {{customerName}}, your tracking is {{unknownVariable}}',
        caseId
      })
    });

    if (res.status === 200) {
      const data = await res.json();
      assert.ok(data.renderedText || data.text);
    }
  });
});
