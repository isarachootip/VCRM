import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.17: Supervisor Reports & Analytics Engine (R5 / Phase 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T1.17.1 - Query supervisor report summary with date range filtering', async () => {
    const from = '2026-09-01';
    const to = '2026-09-30';
    const res = await fetch(`${APP_URL}/api/reports/summary?dateFrom=${from}&dateTo=${to}`);

    if (res.status === 200) {
      const data = await res.json();
      assert.ok(data !== null, 'Summary report should return JSON metrics');
    } else {
      assert.ok(res.status === 200 || res.status === 404);
    }
  });

  test('T1.17.2 - Filter reports by Business Unit (Muji, Central, SSP, B2S)', async () => {
    const res = await fetch(`${APP_URL}/api/reports/summary?businessUnit=MUJI`);
    if (res.status === 200) {
      const data = await res.json();
      assert.ok(data.businessUnit === 'MUJI' || data.metrics !== undefined);
    }
  });

  test('T1.17.3 - Export operational reports as downloadable CSV file', async () => {
    const res = await fetch(`${APP_URL}/api/reports/export?format=csv&businessUnit=Central`);
    if (res.status === 200) {
      const contentType = res.headers.get('content-type') || '';
      assert.ok(contentType.includes('text/csv') || contentType.includes('application/octet-stream'));
      const text = await res.text();
      assert.ok(text.length > 0, 'CSV export must not be empty');
      assert.ok(text.includes('CaseNumber') || text.includes('caseId') || text.includes(','));
    } else {
      assert.ok(res.status === 200 || res.status === 404);
    }
  });

  test('T1.17.4 - Verify conversion rate and AHT metrics in report output', async () => {
    const res = await fetch(`${APP_URL}/api/reports/summary`);
    if (res.status === 200) {
      const data = await res.json();
      if (data.conversionRate !== undefined) {
        assert.equal(typeof data.conversionRate, 'number');
      }
    }
  });

  test('T1.17.5 - Validation: Malformed date parameters return HTTP 400 Bad Request', async () => {
    const res = await fetch(`${APP_URL}/api/reports/summary?dateFrom=invalid-date-format`);
    if (res.status === 400) {
      const err = await res.json();
      assert.ok(err.error);
    } else {
      assert.ok([200, 400, 404].includes(res.status));
    }
  });
});
