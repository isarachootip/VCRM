import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateParam,
  normalizeBusinessUnit,
  getReportMetrics,
  generateReportRows,
  exportReportCsv,
  exportReportXlsx,
  InvalidDateError,
} from './index';
import { BusinessUnit } from '@prisma/client';

describe('Supervisor Reporting & Export Service Tests (M11 / Phase 1)', () => {
  test('parseDateParam parses valid ISO date strings correctly', () => {
    const d = parseDateParam('2026-09-01');
    assert.ok(d instanceof Date);
    assert.equal(d?.getUTCFullYear(), 2026);
    assert.equal(d?.getUTCMonth(), 8); // 0-indexed: September
  });

  test('parseDateParam throws InvalidDateError on malformed date string', () => {
    assert.throws(
      () => parseDateParam('invalid-date-format', 'dateFrom'),
      (err: any) => err instanceof InvalidDateError
    );

    assert.throws(
      () => parseDateParam('not-a-date', 'endDate'),
      (err: any) => err instanceof InvalidDateError
    );
  });

  test('normalizeBusinessUnit properly normalizes string inputs to enum values', () => {
    assert.equal(normalizeBusinessUnit('Central'), BusinessUnit.CENTRAL);
    assert.equal(normalizeBusinessUnit('central'), BusinessUnit.CENTRAL);
    assert.equal(normalizeBusinessUnit('CDS'), BusinessUnit.CENTRAL);
    assert.equal(normalizeBusinessUnit('Muji'), BusinessUnit.MUJI);
    assert.equal(normalizeBusinessUnit('muji'), BusinessUnit.MUJI);
    assert.equal(normalizeBusinessUnit('SSP'), BusinessUnit.SSP);
    assert.equal(normalizeBusinessUnit('supersports'), BusinessUnit.SSP);
    assert.equal(normalizeBusinessUnit('B2S'), BusinessUnit.B2S);
    assert.equal(normalizeBusinessUnit('central beauty club'), BusinessUnit.CENTRAL_BEAUTY_CLUB);
  });

  test('getReportMetrics aggregates report metrics with date range filtering', async () => {
    const report = await getReportMetrics({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    assert.ok(report, 'Report must be non-null');
    assert.equal(typeof report.totalCases, 'number');
    assert.equal(typeof report.resolvedCases, 'number');
    assert.equal(typeof report.totalQuotations, 'number');
    assert.equal(typeof report.paidQuotations, 'number');
    assert.equal(typeof report.conversionRate, 'number');
    assert.equal(typeof report.salesVolumeThb, 'number');
    assert.equal(typeof report.avgHandlingTimeSec, 'number');
    assert.equal(typeof report.csatAvgScore, 'number');

    // BU Breakdown
    assert.ok(report.breakdownByBU);
    assert.ok(report.breakdownByBU[BusinessUnit.CENTRAL]);
    assert.ok(report.breakdownByBU[BusinessUnit.MUJI]);

    // Summary & metrics compatibility aliases
    assert.ok(report.summary);
    assert.ok(report.metrics);
  });

  test('getReportMetrics filters by Business Unit', async () => {
    const report = await getReportMetrics({
      businessUnit: 'MUJI',
    });

    assert.ok(report);
    assert.equal(report.businessUnit, BusinessUnit.MUJI);
  });

  test('generateReportRows returns row records and exports valid CSV & Excel', async () => {
    const rows = await generateReportRows({});
    assert.ok(Array.isArray(rows));

    const csv = exportReportCsv(rows);
    assert.ok(typeof csv === 'string');
    assert.ok(csv.includes('CaseNumber'));
    assert.ok(csv.includes('BusinessUnit'));
    assert.ok(csv.includes('QuotationNumber'));

    const xlsxBuffer = exportReportXlsx(rows);
    assert.ok(Buffer.isBuffer(xlsxBuffer));
    assert.ok(xlsxBuffer.length > 0);
  });
});
