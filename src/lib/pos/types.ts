/**
 * POS Ticket Reconciliation Types & Interfaces
 * Path: src/lib/pos/types.ts
 */

import { POSTicketStatus, BusinessUnit, QuotationStatus } from '@prisma/client';

export { POSTicketStatus };

export interface PosTicketPayload {
  storeBranchId: string;
  registerId: string;
  ticketNumber: string;
  amount: number;
  quotationNumber?: string;
  quotationId?: string;
  cashierId?: string;
  posTerminalId?: string;
  saleDateTime?: string | Date;
  transactionDate?: string | Date;
}

export type ReconcileSingleTicketInput = PosTicketPayload;

export interface FormattedPOSTicket {
  id: string;
  ticketNumber: string;
  storeBranchId: string | null;
  registerId: string | null;
  posTerminalId: string | null;
  cashierId: string | null;
  amount: number;
  expectedAmount: number | null;
  amountDiff: number | null;
  discrepancyReason: string | null;
  status: POSTicketStatus;
  saleDateTime: string | null;
  reconciledAt: string | null;
  reconciledById: string | null;
  quotationId: string | null;
  matchedQuotationId: string | null;
  batchUploadId: string | null;
  createdAt: string;
  updatedAt: string;
  quotation?: any;
  matchedQuotation?: any;
}

export interface ReconcileResult {
  success: boolean;
  status: POSTicketStatus;
  ticket: FormattedPOSTicket;
  quotationStatus?: QuotationStatus | string;
  matchedQuotationId?: string | null;
  expectedAmount?: number | null;
  amountDiff?: number | null;
  discrepancyReason?: string | null;
  isDuplicate?: boolean;
}

export interface BatchUploadInput {
  fileName?: string;
  uploadedBy?: string;
  businessUnit?: string;
  totalRows?: number;
  tickets: PosTicketPayload[];
}

export interface BatchUploadRowResult {
  ticketNumber: string;
  storeBranchId?: string;
  registerId?: string;
  status: POSTicketStatus | string;
  matchedQuotation?: string | null;
  matchedQuotationId?: string | null;
  amount?: number;
  expectedAmount?: number | null;
  variance?: number | null;
  amountDiff?: number | null;
  note?: string | null;
  reason?: string | null;
  error?: string | null;
}

export interface BatchUploadSummary {
  totalRows: number;
  matchedRows: number;
  discrepancyRows: number;
  unmatchedRows: number;
  errorRows: number;
  processedAt?: string;
}

export interface BatchUploadResult {
  success: boolean;
  batchId: string;
  fileName: string;
  uploadedBy: string;
  businessUnit: string;
  totalRows: number;
  matchedRows: number;
  discrepancyRows: number;
  unmatchedRows: number;
  errorRows: number;
  summary: BatchUploadSummary;
  results: BatchUploadRowResult[];
}

export interface FormattedPOSBatchUpload {
  id: string;
  fileName: string;
  uploadedBy: string;
  businessUnit: string;
  status: string;
  totalRows: number;
  matchedRows: number;
  discrepancyRows: number;
  errorRows: number;
  summary: BatchUploadSummary | null;
  createdAt: string;
  tickets?: FormattedPOSTicket[];
}

export interface TicketFilterParams {
  status?: POSTicketStatus | string;
  storeBranchId?: string;
  registerId?: string;
  ticketNumber?: string;
  quotationId?: string;
  quotationNumber?: string;
  batchUploadId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface BatchFilterParams {
  businessUnit?: string;
  status?: string;
  uploadedBy?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  page?: number | string;
  limit?: number | string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
