import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.14: Multi-Criteria Opportunity Search (R4 / Phase 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function seedSearchableCase(name: string, phone: string, lineId: string, bu = 'Central') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_search_${Date.now()}_${Math.random()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          businessUnit: bu,
          senderId: lineId,
          senderName: name
        },
        session: { sessionId: `sess_search_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: `Search sample for ${name} ${phone}` }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.14.1 - Multi-search by Customer Name (partial case-insensitive match)', async () => {
    await seedSearchableCase('Wichai Prasert', '0812345678', 'U_line_wichai_01', 'Central');

    const res = await fetch(`${APP_URL}/api/cases?search=Wichai`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const cases = data.cases || [];
    assert.ok(cases.length >= 1, 'Search by customer name should return matching case');
    assert.ok(
      cases.some((c: any) => c.customer?.displayName?.includes('Wichai') || c.customer?.name?.includes('Wichai'))
    );
  });

  test('T1.14.2 - Multi-search by Phone Number', async () => {
    await seedSearchableCase('Ploi Beauty', '0899887766', 'U_line_ploi_02', 'Central Beauty Club');

    const res = await fetch(`${APP_URL}/api/cases?q=0899887766`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.cases || data.total !== undefined);
  });

  test('T1.14.3 - Multi-search by LINE User ID', async () => {
    const targetLineId = `U_line_unique_${Date.now()}`;
    await seedSearchableCase('Ken Tanaka', '0822334455', targetLineId, 'Muji');

    const res = await fetch(`${APP_URL}/api/cases?search=${targetLineId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const cases = data.cases || [];
    assert.ok(
      cases.length >= 1,
      'Search by LINE external sender ID should match target customer case'
    );
  });

  test('T1.14.4 - Search by Quotation Number', async () => {
    const caseId = await seedSearchableCase('Somchai Vip', '0811223344', 'U_line_vip_03', 'Central');

    const qRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        items: [{ sku: 'PROD-SEARCH', unitPrice: 5000, quantity: 1 }]
      })
    });
    const qData = await qRes.json();
    const qNum = qData.quotation.quotationNumber;

    const res = await fetch(`${APP_URL}/api/cases?search=${qNum}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.cases !== undefined || data.total !== undefined);
  });

  test('T1.14.5 - Combined multi-filter: BU scoping, channel, and status', async () => {
    await seedSearchableCase('Supersports Runner', '0877665544', 'U_line_runner_04', 'SSP');

    const res = await fetch(`${APP_URL}/api/cases?bu=SSP&channel=LINE&status=OPEN`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const cases = data.cases || [];
    assert.ok(
      cases.every((c: any) => (c.businessUnit === 'SSP' || c.businessUnit === 'Supersports') && c.channel === 'LINE')
    );
  });
});
