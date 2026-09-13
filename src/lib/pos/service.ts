/**
 * Store POS Ticket Reconciliation Service Layer
 * Path: src/lib/pos/service.ts
 *
 * Implements:
 * - Single POS ticket reconciliation (reconcileSingleTicket)
 *   * Compound unique check: @@unique([storeBranchId, registerId, ticketNumber]) -> 409 Conflict
 *   * Quotation lookup by quotationNumber or quotationId
 *   * Matching against quotation.grandTotal with 0.01 tolerance
 *   * Exact match -> RECONCILED, link quotation, advance PRINTED quotation to COMPLETED, log AuditLog
 *   * Discrepancy -> DISCREPANCY, record difference and discrepancyReason, quotation uncompleted, log AuditLog
 *   * Not found -> UNMATCHED, discrepancyReason: 'QUOTATION_NOT_FOUND'
 * - Batch upload reconciliation (processBatchUpload)
 *   * Accepts CSV string, Buffer, or JSON array / object
 *   * Processes each ticket through reconciliation engine
 *   * Aggregates totalRows, matchedRows, discrepancyRows, unmatchedRows, errorRows
 *   * Saves POSBatchUpload entity with summary JSON
 * - Query and retrieval:
 *   * listTickets, getTicketById, listBatches, getBatchById
 */

import { prisma } from '@/lib/db';
import { POSTicketStatus, QuotationStatus } from '@prisma/client';
import { createAuditLog } from '@/lib/audit/logger';
import {
  PosTicketPayload,
  ReconcileSingleTicketInput,
  FormattedPOSTicket,
  ReconcileResult,
  BatchUploadInput,
  BatchUploadResult,
  BatchUploadRowResult,
  BatchUploadSummary,
  FormattedPOSBatchUpload,
  TicketFilterParams,
  BatchFilterParams,
  PaginatedResult,
} from './types';

// ==========================================
// CUSTOM ERROR CLASSES
// ==========================================

export class PosError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 400, code = 'POS_ERROR', details?: any) {
    super(message);
    this.name = 'PosError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class DuplicateTicketError extends PosError {
  constructor(message = 'Duplicate POS ticket for this store branch, register, and ticket number') {
    super(message, 409, 'DUPLICATE_TICKET');
    this.name = 'DuplicateTicketError';
  }
}

export class PosValidationError extends PosError {
  constructor(message: string, details?: any) {
    super(message, 400, 'POS_VALIDATION_ERROR', details);
    this.name = 'PosValidationError';
  }
}

export class PosNotFoundError extends PosError {
  constructor(identifier: string) {
    super(`POS ticket not found: ${identifier}`, 404, 'POS_NOT_FOUND');
    this.name = 'PosNotFoundError';
  }
}

// ==========================================
// FORMATTING HELPERS
// ==========================================

export function formatTicket(ticket: any): FormattedPOSTicket {
  if (!ticket) return null as any;

  const amount = Number(ticket.amount);
  const expectedAmount = ticket.expectedAmount !== null && ticket.expectedAmount !== undefined
    ? Number(ticket.expectedAmount)
    : null;
  const amountDiff = ticket.amountDiff !== null && ticket.amountDiff !== undefined
    ? Number(ticket.amountDiff)
    : null;

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    storeBranchId: ticket.storeBranchId ?? null,
    registerId: ticket.registerId ?? null,
    posTerminalId: ticket.posTerminalId ?? null,
    cashierId: ticket.cashierId ?? null,
    amount,
    expectedAmount,
    amountDiff,
    discrepancyReason: ticket.discrepancyReason ?? null,
    status: ticket.status,
    saleDateTime: ticket.saleDateTime instanceof Date
      ? ticket.saleDateTime.toISOString()
      : (ticket.saleDateTime ?? null),
    reconciledAt: ticket.reconciledAt instanceof Date
      ? ticket.reconciledAt.toISOString()
      : (ticket.reconciledAt ?? null),
    reconciledById: ticket.reconciledById ?? null,
    quotationId: ticket.quotationId ?? null,
    matchedQuotationId: ticket.matchedQuotationId ?? null,
    batchUploadId: ticket.batchUploadId ?? null,
    createdAt: ticket.createdAt instanceof Date ? ticket.createdAt.toISOString() : String(ticket.createdAt),
    updatedAt: ticket.updatedAt instanceof Date ? ticket.updatedAt.toISOString() : String(ticket.updatedAt),
    quotation: ticket.quotation ? {
      id: ticket.quotation.id,
      quotationNumber: ticket.quotation.quotationNumber,
      status: ticket.quotation.status,
      grandTotal: Number(ticket.quotation.grandTotal),
      isReconciled: ticket.quotation.isReconciled,
    } : undefined,
    matchedQuotation: ticket.matchedQuotation ? {
      id: ticket.matchedQuotation.id,
      quotationNumber: ticket.matchedQuotation.quotationNumber,
      status: ticket.matchedQuotation.status,
      grandTotal: Number(ticket.matchedQuotation.grandTotal),
      isReconciled: ticket.matchedQuotation.isReconciled,
    } : undefined,
  };
}

export function formatBatch(batch: any): FormattedPOSBatchUpload {
  if (!batch) return null as any;

  let summaryObj: BatchUploadSummary | null = null;
  if (batch.summary) {
    try {
      summaryObj = typeof batch.summary === 'string' ? JSON.parse(batch.summary) : batch.summary;
    } catch {
      summaryObj = null;
    }
  }

  return {
    id: batch.id,
    fileName: batch.fileName,
    uploadedBy: batch.uploadedBy,
    businessUnit: batch.businessUnit,
    status: batch.status,
    totalRows: batch.totalRows,
    matchedRows: batch.matchedRows,
    discrepancyRows: batch.discrepancyRows,
    errorRows: batch.errorRows,
    summary: summaryObj,
    createdAt: batch.createdAt instanceof Date ? batch.createdAt.toISOString() : String(batch.createdAt),
    tickets: Array.isArray(batch.tickets) ? batch.tickets.map(formatTicket) : undefined,
  };
}

// ==========================================
// CSV PARSER HELPER
// ==========================================

export function parseCsvContent(csvString: string): PosTicketPayload[] {
  if (!csvString || !csvString.trim()) {
    return [];
  }

  const lines = csvString.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return [];
  }

  // Parse header
  const headerTokens = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const headerMap: { [key: string]: number } = {};
  headerTokens.forEach((header, index) => {
    headerMap[header.toLowerCase()] = index;
  });

  const getCol = (tokens: string[], colName: string): string => {
    const idx = headerMap[colName.toLowerCase()];
    if (idx !== undefined && idx < tokens.length) {
      return tokens[idx].trim().replace(/^["']|["']$/g, '');
    }
    return '';
  };

  const tickets: PosTicketPayload[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple comma split handling quotes
    const tokens: string[] = [];
    let insideQuote = false;
    let currentToken = '';

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        tokens.push(currentToken);
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    tokens.push(currentToken);

    const storeBranchId = getCol(tokens, 'storeBranchId') || 'BRANCH-CHIDLOM-01';
    const registerId = getCol(tokens, 'registerId') || 'REG-01';
    const posTerminalId = getCol(tokens, 'posTerminalId') || 'POS-TERM-01';
    const ticketNumber = getCol(tokens, 'ticketNumber');
    const amountStr = getCol(tokens, 'amount');
    const saleDateTime = getCol(tokens, 'saleDateTime') || getCol(tokens, 'transactionDate') || new Date().toISOString();
    const transactionDate = getCol(tokens, 'transactionDate') || saleDateTime;
    const quotationNumber = getCol(tokens, 'quotationNumber');
    const cashierId = getCol(tokens, 'cashierId') || 'CASHIER-101';

    if (ticketNumber && amountStr) {
      const cleanAmountStr = amountStr.replace(/,/g, '').trim();
      const parsedAmount = parseFloat(cleanAmountStr);
      tickets.push({
        storeBranchId,
        registerId,
        posTerminalId,
        ticketNumber,
        amount: isNaN(parsedAmount) ? 0 : parsedAmount,
        saleDateTime,
        transactionDate,
        quotationNumber,
        cashierId,
      });
    }
  }

  return tickets;
}

// ==========================================
// CORE RECONCILIATION ENGINE
// ==========================================

/**
 * Reconciles a single POS ticket against CRM quotations.
 * - Enforces compound unique key @@unique([storeBranchId, registerId, ticketNumber]) -> 409 Conflict
 * - Matches quotation by quotationNumber or quotationId
 * - Exact match (0.01 tolerance) -> RECONCILED, links quotation, advances PRINTED -> COMPLETED, logs AuditLog
 * - Mismatch -> DISCREPANCY, records expectedAmount, amountDiff, discrepancyReason: 'AMOUNT_MISMATCH'
 * - Quotation not found -> UNMATCHED, discrepancyReason: 'QUOTATION_NOT_FOUND'
 */
export async function reconcileSingleTicket(
  input: ReconcileSingleTicketInput,
  options: { batchUploadId?: string; actorId?: string } = {}
): Promise<ReconcileResult> {
  // 1. Validation
  if (!input) {
    throw new PosValidationError('Ticket payload is required');
  }

  const ticketNumber = input.ticketNumber?.trim();
  if (!ticketNumber) {
    throw new PosValidationError('ticketNumber is required');
  }

  if (input.amount === undefined || input.amount === null || isNaN(Number(input.amount)) || Number(input.amount) < 0) {
    throw new PosValidationError('amount must be a valid non-negative number');
  }

  const storeBranchId = input.storeBranchId?.trim() || 'BRANCH-CHIDLOM-01';
  const registerId = input.registerId?.trim() || 'REG-01';
  const posTerminalId = input.posTerminalId?.trim() || null;
  const cashierId = input.cashierId?.trim() || null;
  const amount = Number(Number(input.amount).toFixed(2));
  const saleDateTime = input.saleDateTime
    ? new Date(input.saleDateTime)
    : (input.transactionDate ? new Date(input.transactionDate) : new Date());

  // 2. Duplicate Check
  const existingTicket = await prisma.pOSTicket.findFirst({
    where: {
      storeBranchId,
      registerId,
      ticketNumber,
    },
  });

  if (existingTicket) {
    throw new DuplicateTicketError(
      `Duplicate POS ticket detected for branch: '${storeBranchId}', register: '${registerId}', ticket: '${ticketNumber}'`
    );
  }

  // 3. Quotation Lookup
  const qNum = input.quotationNumber?.trim();
  const qId = input.quotationId?.trim();
  let quotation: any = null;

  if (qId) {
    quotation = await prisma.quotation.findUnique({
      where: { id: qId },
      include: { case: true },
    });
  }

  if (!quotation && qNum) {
    quotation = await prisma.quotation.findFirst({
      where: {
        OR: [
          { quotationNumber: qNum },
          { id: qNum },
        ],
      },
      include: { case: true },
    });
  }

  // 4. Quotation Not Found -> UNMATCHED
  if (!quotation) {
    const ticket = await prisma.pOSTicket.create({
      data: {
        ticketNumber,
        storeBranchId,
        registerId,
        posTerminalId,
        cashierId,
        amount,
        expectedAmount: null,
        amountDiff: null,
        discrepancyReason: 'QUOTATION_NOT_FOUND',
        saleDateTime,
        status: POSTicketStatus.UNMATCHED,
        batchUploadId: options.batchUploadId || null,
        reconciledAt: null,
        reconciledById: null,
      },
    });

    return {
      success: true,
      status: POSTicketStatus.UNMATCHED,
      ticket: formatTicket(ticket),
      matchedQuotationId: null,
      expectedAmount: null,
      amountDiff: null,
      discrepancyReason: 'QUOTATION_NOT_FOUND',
    };
  }

  // 5. Quotation Found -> Amount Comparison (0.01 tolerance)
  const expectedAmount = Number(Number(quotation.grandTotal).toFixed(2));
  const amountDiff = Number((amount - expectedAmount).toFixed(2));
  const isMatch = Math.abs(amountDiff) <= 0.01;

  if (isMatch) {
    // Exact match -> RECONCILED
    const ticket = await prisma.pOSTicket.create({
      data: {
        ticketNumber,
        storeBranchId,
        registerId,
        posTerminalId,
        cashierId,
        amount,
        expectedAmount,
        amountDiff: 0,
        discrepancyReason: null,
        saleDateTime,
        reconciledAt: new Date(),
        reconciledById: options.actorId || cashierId || 'SYSTEM',
        status: POSTicketStatus.RECONCILED,
        quotationId: quotation.id,
        matchedQuotationId: quotation.id,
        batchUploadId: options.batchUploadId || null,
      },
    });

    // Advance quotation status: if PRINTED -> COMPLETED
    const shouldAdvance = quotation.status === QuotationStatus.PRINTED;
    const nextQuotationStatus = shouldAdvance ? QuotationStatus.COMPLETED : quotation.status;

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        isReconciled: true,
        posTicketNumber: ticketNumber,
        ...(shouldAdvance ? { status: QuotationStatus.COMPLETED } : {}),
      },
    });

    // Create AuditLog
    await createAuditLog({
      caseId: quotation.caseId || null,
      actorId: options.actorId || null,
      actorName: cashierId || 'POS_SYSTEM',
      action: 'POS_TICKET_RECONCILED',
      actionType: 'POS_TICKET_RECONCILED',
      entityType: 'POSTicket',
      entityId: ticket.id,
      field: 'status',
      oldValue: 'UNRECONCILED',
      newValue: 'RECONCILED',
      details: JSON.stringify({
        ticketNumber,
        storeBranchId,
        registerId,
        amount,
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        cashierId,
        quotationStatusBefore: quotation.status,
        quotationStatusAfter: nextQuotationStatus,
      }),
    });

    return {
      success: true,
      status: POSTicketStatus.RECONCILED,
      ticket: formatTicket(ticket),
      quotationStatus: nextQuotationStatus,
      matchedQuotationId: quotation.id,
      expectedAmount,
      amountDiff: 0,
      discrepancyReason: null,
    };
  } else {
    // Mismatched amount -> DISCREPANCY
    const ticket = await prisma.pOSTicket.create({
      data: {
        ticketNumber,
        storeBranchId,
        registerId,
        posTerminalId,
        cashierId,
        amount,
        expectedAmount,
        amountDiff,
        discrepancyReason: 'AMOUNT_MISMATCH',
        saleDateTime,
        reconciledAt: null,
        reconciledById: null,
        status: POSTicketStatus.DISCREPANCY,
        quotationId: quotation.id,
        matchedQuotationId: null,
        batchUploadId: options.batchUploadId || null,
      },
    });

    // Quotation remains uncompleted

    // Create AuditLog
    await createAuditLog({
      caseId: quotation.caseId || null,
      actorId: options.actorId || null,
      actorName: cashierId || 'POS_SYSTEM',
      action: 'POS_TICKET_DISCREPANCY',
      actionType: 'POS_TICKET_DISCREPANCY',
      entityType: 'POSTicket',
      entityId: ticket.id,
      field: 'status',
      oldValue: 'UNRECONCILED',
      newValue: 'DISCREPANCY',
      details: JSON.stringify({
        ticketNumber,
        storeBranchId,
        registerId,
        amount,
        expectedAmount,
        amountDiff,
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        cashierId,
        discrepancyReason: 'AMOUNT_MISMATCH',
      }),
    });

    return {
      success: true,
      status: POSTicketStatus.DISCREPANCY,
      ticket: formatTicket(ticket),
      quotationStatus: quotation.status,
      matchedQuotationId: null,
      expectedAmount,
      amountDiff,
      discrepancyReason: 'AMOUNT_MISMATCH',
    };
  }
}

/**
 * Processes a batch upload of POS tickets via CSV or JSON.
 * - Aggregates totalRows, matchedRows, discrepancyRows, unmatchedRows, errorRows
 * - Creates a POSBatchUpload entity with summary JSON
 * - Returns batch summary with itemized results breakdown
 */
export async function processBatchUpload(
  input: BatchUploadInput | PosTicketPayload[] | string | Buffer,
  meta: { fileName?: string; uploadedBy?: string; businessUnit?: string } = {}
): Promise<BatchUploadResult> {
  let tickets: PosTicketPayload[] = [];
  let fileName = meta.fileName || `pos_batch_${Date.now()}.csv`;
  let uploadedBy = meta.uploadedBy || 'supervisor';
  let businessUnit = meta.businessUnit || 'Central';

  // 1. Ingest input
  if (typeof input === 'string' || Buffer.isBuffer(input)) {
    const csvStr = input.toString();
    tickets = parseCsvContent(csvStr);
  } else if (Array.isArray(input)) {
    tickets = input;
  } else if (input && typeof input === 'object') {
    if (Array.isArray(input.tickets)) {
      tickets = input.tickets;
    }
    if (input.fileName) fileName = input.fileName;
    if (input.uploadedBy) uploadedBy = input.uploadedBy;
    if (input.businessUnit) businessUnit = input.businessUnit;
  }

  // 2. Create batch tracking record in DB
  const batch = await prisma.pOSBatchUpload.create({
    data: {
      fileName,
      uploadedBy,
      businessUnit,
      totalRows: tickets.length,
      matchedRows: 0,
      discrepancyRows: 0,
      errorRows: 0,
      status: 'PROCESSING',
    },
  });

  let matchedRows = 0;
  let discrepancyRows = 0;
  let unmatchedRows = 0;
  let errorRows = 0;
  const results: BatchUploadRowResult[] = [];

  // 3. Process tickets sequentially
  for (const ticketInput of tickets) {
    try {
      const res = await reconcileSingleTicket(ticketInput, {
        batchUploadId: batch.id,
        actorId: uploadedBy,
      });

      if (res.status === POSTicketStatus.RECONCILED) {
        matchedRows++;
        results.push({
          ticketNumber: ticketInput.ticketNumber,
          storeBranchId: ticketInput.storeBranchId,
          registerId: ticketInput.registerId,
          status: POSTicketStatus.RECONCILED,
          matchedQuotation: ticketInput.quotationNumber || res.matchedQuotationId,
          matchedQuotationId: res.matchedQuotationId,
          amount: ticketInput.amount,
          expectedAmount: res.expectedAmount,
          variance: 0,
          amountDiff: 0,
        });
      } else if (res.status === POSTicketStatus.DISCREPANCY) {
        discrepancyRows++;
        results.push({
          ticketNumber: ticketInput.ticketNumber,
          storeBranchId: ticketInput.storeBranchId,
          registerId: ticketInput.registerId,
          status: POSTicketStatus.DISCREPANCY,
          matchedQuotation: ticketInput.quotationNumber,
          amount: ticketInput.amount,
          expectedAmount: res.expectedAmount,
          variance: res.amountDiff,
          amountDiff: res.amountDiff,
          note: `Amount mismatch: POS ${ticketInput.amount} vs Quotation ${res.expectedAmount}`,
          reason: res.discrepancyReason,
        });
      } else {
        unmatchedRows++;
        results.push({
          ticketNumber: ticketInput.ticketNumber,
          storeBranchId: ticketInput.storeBranchId,
          registerId: ticketInput.registerId,
          status: POSTicketStatus.UNMATCHED,
          matchedQuotation: ticketInput.quotationNumber,
          amount: ticketInput.amount,
          reason: res.discrepancyReason || 'Quotation not found in database',
        });
      }
    } catch (err: any) {
      errorRows++;
      results.push({
        ticketNumber: ticketInput?.ticketNumber || 'UNKNOWN',
        storeBranchId: ticketInput?.storeBranchId,
        registerId: ticketInput?.registerId,
        status: 'ERROR',
        error: err.message || 'Reconciliation failed',
      });
    }
  }

  // 4. Update POSBatchUpload summary in DB
  const summary: BatchUploadSummary = {
    totalRows: tickets.length,
    matchedRows,
    discrepancyRows,
    unmatchedRows,
    errorRows,
    processedAt: new Date().toISOString(),
  };

  await prisma.pOSBatchUpload.update({
    where: { id: batch.id },
    data: {
      matchedRows,
      discrepancyRows,
      errorRows: errorRows + unmatchedRows,
      status: 'COMPLETED',
      summary: JSON.stringify(summary),
    },
  });

  return {
    success: true,
    batchId: batch.id,
    fileName,
    uploadedBy,
    businessUnit,
    totalRows: tickets.length,
    matchedRows,
    discrepancyRows,
    unmatchedRows,
    errorRows,
    summary,
    results,
  };
}

// ==========================================
// QUERY AND LISTING FUNCTIONS
// ==========================================

/**
 * Lists POS tickets with optional filtering and pagination.
 */
export async function listTickets(params: TicketFilterParams = {}): Promise<PaginatedResult<FormattedPOSTicket>> {
  const page = Math.max(1, parseInt(String(params.page || '1'), 10));
  const limit = Math.min(200, Math.max(1, parseInt(String(params.limit || '50'), 10)));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.status) {
    where.status = params.status as POSTicketStatus;
  }

  if (params.storeBranchId) {
    where.storeBranchId = { contains: params.storeBranchId, mode: 'insensitive' };
  }

  if (params.registerId) {
    where.registerId = params.registerId;
  }

  if (params.ticketNumber) {
    where.ticketNumber = { contains: params.ticketNumber, mode: 'insensitive' };
  }

  if (params.quotationId) {
    where.OR = [
      { quotationId: params.quotationId },
      { matchedQuotationId: params.quotationId },
    ];
  }

  if (params.quotationNumber) {
    where.quotation = {
      quotationNumber: { contains: params.quotationNumber, mode: 'insensitive' },
    };
  }

  if (params.batchUploadId) {
    where.batchUploadId = params.batchUploadId;
  }

  if (params.dateFrom || params.dateTo) {
    where.saleDateTime = {};
    if (params.dateFrom) {
      where.saleDateTime.gte = new Date(params.dateFrom);
    }
    if (params.dateTo) {
      where.saleDateTime.lte = new Date(params.dateTo);
    }
  }

  if (params.search) {
    where.OR = [
      { ticketNumber: { contains: params.search, mode: 'insensitive' } },
      { storeBranchId: { contains: params.search, mode: 'insensitive' } },
      { cashierId: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.pOSTicket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        quotation: true,
        matchedQuotation: true,
      },
    }),
    prisma.pOSTicket.count({ where }),
  ]);

  return {
    data: tickets.map(formatTicket),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Retrieves a single POS ticket by ID.
 */
export async function getTicketById(id: string): Promise<FormattedPOSTicket> {
  const ticket = await prisma.pOSTicket.findUnique({
    where: { id },
    include: {
      quotation: true,
      matchedQuotation: true,
      batchUpload: true,
    },
  });

  if (!ticket) {
    throw new PosNotFoundError(id);
  }

  return formatTicket(ticket);
}

/**
 * Lists POS batch upload jobs.
 */
export async function listBatches(params: BatchFilterParams = {}): Promise<PaginatedResult<FormattedPOSBatchUpload>> {
  const page = Math.max(1, parseInt(String(params.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(params.limit || '20'), 10)));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.businessUnit) {
    where.businessUnit = { contains: params.businessUnit, mode: 'insensitive' };
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.uploadedBy) {
    where.uploadedBy = { contains: params.uploadedBy, mode: 'insensitive' };
  }

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) {
      where.createdAt.gte = new Date(params.dateFrom);
    }
    if (params.dateTo) {
      where.createdAt.lte = new Date(params.dateTo);
    }
  }

  const [batches, total] = await Promise.all([
    prisma.pOSBatchUpload.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pOSBatchUpload.count({ where }),
  ]);

  return {
    data: batches.map(formatBatch),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Retrieves a POS batch upload record by ID with its tickets.
 */
export async function getBatchById(id: string): Promise<FormattedPOSBatchUpload> {
  const batch = await prisma.pOSBatchUpload.findUnique({
    where: { id },
    include: {
      tickets: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!batch) {
    throw new PosNotFoundError(`Batch ${id}`);
  }

  return formatBatch(batch);
}
