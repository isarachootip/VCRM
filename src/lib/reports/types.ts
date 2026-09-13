/**
 * Supervisor Reporting Engine Type Definitions (R5 / Phase 1)
 * Path: src/lib/reports/types.ts
 */

export interface ReportFilterParams {
  startDate?: string | null;
  endDate?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  businessUnit?: string | null;
  bu?: string | null;
  queueId?: string | null;
  format?: 'csv' | 'xlsx' | 'json' | string;
}

export interface BUReportBreakdown {
  businessUnit: string;
  totalCases: number;
  resolvedCases: number;
  totalQuotations: number;
  paidQuotations: number;
  conversionRate: number;
  salesVolumeThb: number;
  avgCsat: number;
}

export interface QueueReportBreakdown {
  queueId: string;
  queueName: string;
  queueCode: string;
  businessUnit: string;
  totalCases: number;
  resolvedCases: number;
  avgHandlingTimeSec: number;
}

export interface DiscrepancyMetrics {
  paymentDiscrepancies: number;
  posDiscrepancies: number;
  totalDiscrepancies: number;
}

export interface ReportMetrics {
  totalCases: number;
  resolvedCases: number;
  openCases: number;
  inProgressCases: number;
  resolutionRate: number;
  avgHandlingTimeSec: number;
  avgFirstResponseTimeSec: number;
  totalQuotations: number;
  paidQuotations: number;
  pendingQuotations: number;
  conversionRate: number;
  salesVolumeThb: number;
  csatAvgScore: number;
  csatResponseCount: number;
  discrepancies: DiscrepancyMetrics;
  breakdownByBU: Record<string, BUReportBreakdown>;
  breakdownByQueue: Record<string, QueueReportBreakdown>;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  businessUnit?: string;
  salesMetrics: {
    totalQuotations: number;
    paidQuotations: number;
    conversionRate: number;
    salesVolumeThb: number;
  };
  summary: {
    totalCases: number;
    resolvedCases: number;
    conversionRate: number;
    salesVolumeThb: number;
    avgHandlingTimeSec: number;
    csatAvgScore: number;
  };
  metrics: Record<string, any>;
}

export interface ReportRow {
  CaseNumber: string;
  BusinessUnit: string;
  Channel: string;
  QueueCode: string;
  OwnerName: string;
  CustomerName: string;
  Phone: string;
  CreatedAt: string;
  ClosedAt: string;
  HandlingTimeSec: number | string;
  QuotationNumber: string;
  QuotationStatus: string;
  GrandTotal: number | string;
  PaymentMethod: string;
  PaymentStatus: string;
  POSTicketNumber: string;
  POSStatus: string;
  CSATScore: number | string;
  [key: string]: any;
}
