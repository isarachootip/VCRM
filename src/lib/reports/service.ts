/**
 * Supervisor Reporting Engine & Analytics Service (R5 / Phase 1)
 * Path: src/lib/reports/service.ts
 */

import { prisma } from '@/lib/db';
import * as XLSX from 'xlsx';
import {
  ReportFilterParams,
  ReportMetrics,
  ReportRow,
  BUReportBreakdown,
  QueueReportBreakdown,
  DiscrepancyMetrics,
} from './types';
import { BusinessUnit, CaseStatus } from '@prisma/client';

export class InvalidDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDateError';
  }
}

/**
 * Validates and parses an input date string.
 * Throws InvalidDateError if format is not a valid parseable date.
 */
export function parseDateParam(dateStr?: string | null, paramName = 'date'): Date | null {
  if (!dateStr || !dateStr.trim()) return null;

  const trimmed = dateStr.trim();
  const parsed = new Date(trimmed);

  if (isNaN(parsed.getTime())) {
    throw new InvalidDateError(`Invalid date format for parameter '${paramName}': "${dateStr}"`);
  }

  // Check for common malformed patterns like "invalid-date-format" or letters without valid ISO
  if (/^[a-zA-Z_-]+$/.test(trimmed) && trimmed.toLowerCase() !== 'today' && trimmed.toLowerCase() !== 'now') {
    throw new InvalidDateError(`Invalid date format for parameter '${paramName}': "${dateStr}"`);
  }

  return parsed;
}

/**
 * Normalizes input BU string to authoritative BusinessUnit enum
 */
export function normalizeBusinessUnit(buInput?: string | null): BusinessUnit | undefined {
  if (!buInput || !buInput.trim()) return undefined;
  const clean = buInput.trim().toUpperCase().replace(/[\s-]+/g, '_');

  switch (clean) {
    case 'CENTRAL':
    case 'CDS':
      return BusinessUnit.CENTRAL;
    case 'MUJI':
      return BusinessUnit.MUJI;
    case 'SSP':
    case 'SUPERSPORTS':
      return BusinessUnit.SSP;
    case 'B2S':
      return BusinessUnit.B2S;
    case 'CENTRAL_BEAUTY_CLUB':
    case 'BEAUTY_CLUB':
    case 'BEAUTY':
      return BusinessUnit.CENTRAL_BEAUTY_CLUB;
    default:
      // Check if matches any enum value
      if (Object.values(BusinessUnit).includes(clean as BusinessUnit)) {
        return clean as BusinessUnit;
      }
      return undefined;
  }
}

/**
 * Aggregates supervisor reporting metrics for a specified filter window
 */
export async function getReportMetrics(params: ReportFilterParams): Promise<ReportMetrics> {
  const fromStr = params.startDate || params.dateFrom;
  const toStr = params.endDate || params.dateTo;

  const fromDate = parseDateParam(fromStr, 'startDate');
  const toDate = parseDateParam(toStr, 'endDate');

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new InvalidDateError(`startDate (${fromStr}) cannot be after endDate (${toStr})`);
  }

  // Adjust toDate to end of day if only date is specified (e.g. YYYY-MM-DD)
  let adjustedToDate = toDate;
  if (toDate && toStr && !toStr.includes('T') && !toStr.includes(':')) {
    adjustedToDate = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const rawBu = params.businessUnit || params.bu;
  const buEnum = normalizeBusinessUnit(rawBu);
  const queueId = params.queueId || undefined;

  // Build Case filter
  const caseWhere: any = {};
  if (fromDate || adjustedToDate) {
    caseWhere.createdAt = {};
    if (fromDate) caseWhere.createdAt.gte = fromDate;
    if (adjustedToDate) caseWhere.createdAt.lte = adjustedToDate;
  }
  if (buEnum) {
    caseWhere.businessUnit = buEnum;
  }
  if (queueId) {
    caseWhere.queueId = queueId;
  }

  // Build Quotation filter
  const quotationWhere: any = {};
  if (fromDate || adjustedToDate) {
    quotationWhere.createdAt = {};
    if (fromDate) quotationWhere.createdAt.gte = fromDate;
    if (adjustedToDate) quotationWhere.createdAt.lte = adjustedToDate;
  }
  if (buEnum) {
    quotationWhere.businessUnit = buEnum;
  }
  if (queueId) {
    quotationWhere.case = { queueId };
  }

  // Build CSAT filter
  const csatWhere: any = {};
  if (fromDate || adjustedToDate) {
    csatWhere.createdAt = {};
    if (fromDate) csatWhere.createdAt.gte = fromDate;
    if (adjustedToDate) csatWhere.createdAt.lte = adjustedToDate;
  }
  if (buEnum) {
    csatWhere.businessUnit = buEnum;
  }
  if (queueId) {
    csatWhere.case = { queueId };
  }

  // Fetch Cases and Quotations in parallel
  const [cases, quotations, csatResponses, paymentDiscrepancies, posDiscrepancies, queues] =
    await Promise.all([
      prisma.case.findMany({
        where: caseWhere,
        include: {
          queue: true,
          csatResponse: true,
        },
      }),
      prisma.quotation.findMany({
        where: quotationWhere,
      }),
      prisma.cSATResponse.findMany({
        where: csatWhere,
      }),
      prisma.paymentTransaction.count({
        where: {
          status: 'DISCREPANCY',
          createdAt: caseWhere.createdAt,
          ...(buEnum ? { businessUnit: buEnum } : {}),
        },
      }),
      prisma.pOSTicket.count({
        where: {
          status: 'DISCREPANCY',
          createdAt: caseWhere.createdAt,
        },
      }),
      prisma.queue.findMany(),
    ]);

  // Aggregate Cases
  const totalCases = cases.length;
  let resolvedCases = 0;
  let openCases = 0;
  let inProgressCases = 0;

  let totalHandlingSec = 0;
  let handlingCount = 0;

  let totalFrtSec = 0;
  let frtCount = 0;

  for (const c of cases) {
    if (c.status === CaseStatus.RESOLVED || c.status === CaseStatus.CLOSED) {
      resolvedCases++;
      const end = c.closedAt || c.resolvedAt;
      if (end) {
        const durMs = Math.max(0, new Date(end).getTime() - new Date(c.createdAt).getTime());
        totalHandlingSec += Math.round(durMs / 1000);
        handlingCount++;
      }
    } else if (c.status === CaseStatus.OPEN) {
      openCases++;
    } else if (c.status === CaseStatus.IN_PROGRESS) {
      inProgressCases++;
    }

    if (c.firstResponseAt) {
      const frtMs = Math.max(0, new Date(c.firstResponseAt).getTime() - new Date(c.createdAt).getTime());
      totalFrtSec += Math.round(frtMs / 1000);
      frtCount++;
    }
  }

  const avgHandlingTimeSec = handlingCount > 0 ? Math.round(totalHandlingSec / handlingCount) : 0;
  const avgFirstResponseTimeSec = frtCount > 0 ? Math.round(totalFrtSec / frtCount) : 0;
  const resolutionRate = totalCases > 0 ? Math.round((resolvedCases / totalCases) * 10000) / 100 : 0;

  // Aggregate Quotations
  const totalQuotations = quotations.length;
  const paidStatuses = ['PAID', 'PRINTED', 'COMPLETED'];
  const paidQuotes = quotations.filter((q) => paidStatuses.includes(q.status));
  const paidQuotations = paidQuotes.length;
  const pendingQuotations = quotations.filter((q) => q.status === 'PENDING_PAYMENT').length;

  const salesVolumeThb = paidQuotes.reduce((sum, q) => sum + Number(q.grandTotal), 0);
  const conversionRate = totalQuotations > 0 ? Math.round((paidQuotations / totalQuotations) * 10000) / 100 : 0;

  // Aggregate CSAT
  let csatSum = 0;
  for (const csat of csatResponses) {
    csatSum += csat.csatScore;
  }
  const csatResponseCount = csatResponses.length;
  const csatAvgScore = csatResponseCount > 0 ? Math.round((csatSum / csatResponseCount) * 10) / 10 : 0;

  // Discrepancies
  const discrepancies: DiscrepancyMetrics = {
    paymentDiscrepancies,
    posDiscrepancies,
    totalDiscrepancies: paymentDiscrepancies + posDiscrepancies,
  };

  // Group by Business Unit
  const buList: BusinessUnit[] = [
    BusinessUnit.CENTRAL,
    BusinessUnit.MUJI,
    BusinessUnit.SSP,
    BusinessUnit.B2S,
    BusinessUnit.CENTRAL_BEAUTY_CLUB,
  ];

  const breakdownByBU: Record<string, BUReportBreakdown> = {};

  for (const bu of buList) {
    const buCases = cases.filter((c) => c.businessUnit === bu);
    const buResolved = buCases.filter((c) => c.status === CaseStatus.RESOLVED || c.status === CaseStatus.CLOSED).length;
    const buQuotes = quotations.filter((q) => q.businessUnit === bu);
    const buPaidQuotes = buQuotes.filter((q) => paidStatuses.includes(q.status));
    const buSalesVol = buPaidQuotes.reduce((sum, q) => sum + Number(q.grandTotal), 0);
    const buConvRate = buQuotes.length > 0 ? Math.round((buPaidQuotes.length / buQuotes.length) * 10000) / 100 : 0;

    const buCsat = csatResponses.filter((r) => r.businessUnit === bu);
    const buAvgCsat = buCsat.length > 0 ? Math.round((buCsat.reduce((sum, r) => sum + r.csatScore, 0) / buCsat.length) * 10) / 10 : 0;

    breakdownByBU[bu] = {
      businessUnit: bu,
      totalCases: buCases.length,
      resolvedCases: buResolved,
      totalQuotations: buQuotes.length,
      paidQuotations: buPaidQuotes.length,
      conversionRate: buConvRate,
      salesVolumeThb: buSalesVol,
      avgCsat: buAvgCsat,
    };
  }

  // Group by Queue
  const breakdownByQueue: Record<string, QueueReportBreakdown> = {};

  for (const q of queues) {
    const qCases = cases.filter((c) => c.queueId === q.id);
    const qResolved = qCases.filter((c) => c.status === CaseStatus.RESOLVED || c.status === CaseStatus.CLOSED);

    let qHandlingSec = 0;
    let qHandlingCount = 0;
    for (const c of qResolved) {
      const end = c.closedAt || c.resolvedAt;
      if (end) {
        qHandlingSec += Math.max(0, Math.round((new Date(end).getTime() - new Date(c.createdAt).getTime()) / 1000));
        qHandlingCount++;
      }
    }

    const qAvgAht = qHandlingCount > 0 ? Math.round(qHandlingSec / qHandlingCount) : 0;

    breakdownByQueue[q.id] = {
      queueId: q.id,
      queueName: q.name,
      queueCode: q.code,
      businessUnit: q.businessUnit,
      totalCases: qCases.length,
      resolvedCases: qResolved.length,
      avgHandlingTimeSec: qAvgAht,
    };
  }

  const result: ReportMetrics = {
    totalCases,
    resolvedCases,
    openCases,
    inProgressCases,
    resolutionRate,
    avgHandlingTimeSec,
    avgFirstResponseTimeSec,
    totalQuotations,
    paidQuotations,
    pendingQuotations,
    conversionRate,
    salesVolumeThb,
    csatAvgScore,
    csatResponseCount,
    discrepancies,
    breakdownByBU,
    breakdownByQueue,
    dateRange: {
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null,
    },
    businessUnit: buEnum || rawBu || undefined,
    salesMetrics: {
      totalQuotations,
      paidQuotations,
      conversionRate,
      salesVolumeThb,
    },
    summary: {
      totalCases,
      resolvedCases,
      conversionRate,
      salesVolumeThb,
      avgHandlingTimeSec,
      csatAvgScore,
    },
    metrics: {
      totalCases,
      resolvedCases,
      conversionRate,
      salesVolumeThb,
      avgHandlingTimeSec,
      csatAvgScore,
      discrepancies,
      breakdownByBU,
    },
  };

  return result;
}

/**
 * Generates flattened report rows for CSV/Excel export
 */
export async function generateReportRows(params: ReportFilterParams): Promise<ReportRow[]> {
  const fromStr = params.startDate || params.dateFrom;
  const toStr = params.endDate || params.dateTo;

  const fromDate = parseDateParam(fromStr, 'startDate');
  const toDate = parseDateParam(toStr, 'endDate');

  let adjustedToDate = toDate;
  if (toDate && toStr && !toStr.includes('T') && !toStr.includes(':')) {
    adjustedToDate = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const rawBu = params.businessUnit || params.bu;
  const buEnum = normalizeBusinessUnit(rawBu);
  const queueId = params.queueId || undefined;

  const caseWhere: any = {};
  if (fromDate || adjustedToDate) {
    caseWhere.createdAt = {};
    if (fromDate) caseWhere.createdAt.gte = fromDate;
    if (adjustedToDate) caseWhere.createdAt.lte = adjustedToDate;
  }
  if (buEnum) {
    caseWhere.businessUnit = buEnum;
  }
  if (queueId) {
    caseWhere.queueId = queueId;
  }

  const cases = await prisma.case.findMany({
    where: caseWhere,
    include: {
      customer: true,
      queue: true,
      owner: true,
      quotations: {
        include: {
          payments: true,
          posTickets: true,
        },
      },
      csatResponse: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows: ReportRow[] = [];

  for (const c of cases) {
    const closedDate = c.closedAt || c.resolvedAt;
    const handlingSec = closedDate
      ? Math.round((new Date(closedDate).getTime() - new Date(c.createdAt).getTime()) / 1000)
      : '';

    // If case has quotations, list them; otherwise create one row for the case
    if (c.quotations && c.quotations.length > 0) {
      for (const q of c.quotations) {
        const latestPayment = q.payments && q.payments.length > 0 ? q.payments[q.payments.length - 1] : null;
        const latestPos = q.posTickets && q.posTickets.length > 0 ? q.posTickets[q.posTickets.length - 1] : null;

        rows.push({
          CaseNumber: c.caseNumber,
          BusinessUnit: c.businessUnit,
          Channel: c.channel,
          QueueCode: c.queue?.code || '',
          OwnerName: c.owner?.name || 'Unassigned',
          CustomerName: c.customer?.name || c.customer?.displayName || '',
          Phone: c.customer?.phone || '',
          CreatedAt: c.createdAt.toISOString(),
          ClosedAt: closedDate ? new Date(closedDate).toISOString() : '',
          HandlingTimeSec: handlingSec,
          QuotationNumber: q.quotationNumber,
          QuotationStatus: q.status,
          GrandTotal: Number(q.grandTotal).toFixed(2),
          PaymentMethod: latestPayment?.paymentMethod || '',
          PaymentStatus: latestPayment?.status || (q.status === 'PAID' ? 'PAID' : ''),
          POSTicketNumber: latestPos?.ticketNumber || q.posTicketNumber || '',
          POSStatus: latestPos?.status || '',
          CSATScore: c.csatResponse?.csatScore ?? '',
        });
      }
    } else {
      rows.push({
        CaseNumber: c.caseNumber,
        BusinessUnit: c.businessUnit,
        Channel: c.channel,
        QueueCode: c.queue?.code || '',
        OwnerName: c.owner?.name || 'Unassigned',
        CustomerName: c.customer?.name || c.customer?.displayName || '',
        Phone: c.customer?.phone || '',
        CreatedAt: c.createdAt.toISOString(),
        ClosedAt: closedDate ? new Date(closedDate).toISOString() : '',
        HandlingTimeSec: handlingSec,
        QuotationNumber: '',
        QuotationStatus: '',
        GrandTotal: '',
        PaymentMethod: '',
        PaymentStatus: '',
        POSTicketNumber: '',
        POSStatus: '',
        CSATScore: c.csatResponse?.csatScore ?? '',
      });
    }
  }

  return rows;
}

/**
 * Converts report rows to RFC 4180 CSV string with UTF-8 BOM
 */
export function exportReportCsv(rows: ReportRow[]): string {
  const headers = [
    'CaseNumber',
    'BusinessUnit',
    'Channel',
    'QueueCode',
    'OwnerName',
    'CustomerName',
    'Phone',
    'CreatedAt',
    'ClosedAt',
    'HandlingTimeSec',
    'QuotationNumber',
    'QuotationStatus',
    'GrandTotal',
    'PaymentMethod',
    'PaymentStatus',
    'POSTicketNumber',
    'POSStatus',
    'CSATScore',
  ];

  const escapeCsvCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  // UTF-8 BOM
  const bom = '\uFEFF';

  lines.push(headers.join(','));

  for (const row of rows) {
    const line = headers.map((h) => escapeCsvCell(row[h])).join(',');
    lines.push(line);
  }

  return bom + lines.join('\n');
}

/**
 * Converts report rows to Excel (XLSX) buffer
 */
export function exportReportXlsx(rows: ReportRow[]): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Supervisor CRM Report');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}
