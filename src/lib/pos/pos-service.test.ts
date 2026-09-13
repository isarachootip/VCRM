import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../db';
import {
  reconcileSingleTicket,
  processBatchUpload,
  listTickets,
  getTicketById,
  listBatches,
  getBatchById,
  parseCsvContent,
  DuplicateTicketError,
  PosValidationError,
  POSTicketStatus,
} from './index';
import { QuotationStatus, BusinessUnit } from '@prisma/client';

describe('Store POS Ticket Reconciliation Service Layer (M9 / Phase 1)', () => {
  let testCaseId: string;
  let testCustomerId: string;

  before(async () => {
    // Ensure test customer and case exist
    const existingCase = await prisma.case.findFirst();
    if (existingCase) {
      testCaseId = existingCase.id;
      testCustomerId = existingCase.customerId;
    } else {
      let cust = await prisma.customer.findFirst();
      if (!cust) {
        cust = await prisma.customer.create({
          data: {
            externalId: `cust_pos_${Date.now()}`,
            channel: 'LINE',
            displayName: 'Test POS Customer',
            name: 'Somchai Suksan',
            phone: '0812345678',
          },
        });
      }
      testCustomerId = cust.id;

      const queue = await prisma.queue.findFirst();
      const testCase = await prisma.case.create({
        data: {
          caseNumber: `CAS-POS-${Date.now()}`,
          title: 'Test POS Case',
          channel: 'LINE',
          pageId: 'central_chidlom',
          queueId: queue?.id || 'queue_central_sales',
          businessUnit: BusinessUnit.CENTRAL,
          customerId: testCustomerId,
          status: 'OPEN',
        },
      });
      testCaseId = testCase.id;
    }
  });

  after(async () => {
    // Clean up created test cases/quotations if desired
  });

  async function createTestQuotation(status: QuotationStatus = QuotationStatus.PRINTED, grandTotal = 15000) {
    const qNum = `QT-POS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: qNum,
        caseId: testCaseId,
        customerId: testCustomerId,
        businessUnit: BusinessUnit.CENTRAL,
        status,
        subtotal: grandTotal / 1.07,
        vatAmount: grandTotal - grandTotal / 1.07,
        grandTotal,
        totalAmount: grandTotal,
        isLocked: status === QuotationStatus.PRINTED,
        printedAt: status === QuotationStatus.PRINTED ? new Date() : null,
        printCount: status === QuotationStatus.PRINTED ? 1 : 0,
      },
    });
    return quotation;
  }

  test('POS-01: Single POS ticket exact match flags RECONCILED and advances PRINTED quotation to COMPLETED', async () => {
    const quote = await createTestQuotation(QuotationStatus.PRINTED, 12000.00);
    const ticketNumber = `TKT-${Date.now()}-01`;

    const res = await reconcileSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber,
      amount: 12000.00,
      quotationNumber: quote.quotationNumber,
      cashierId: 'CASHIER-101',
    });

    assert.equal(res.success, true);
    assert.equal(res.status, POSTicketStatus.RECONCILED);
    assert.equal(res.ticket.status, POSTicketStatus.RECONCILED);
    assert.equal(res.ticket.amount, 12000.00);
    assert.equal(res.ticket.amountDiff, 0);
    assert.equal(res.quotationStatus, QuotationStatus.COMPLETED);

    // Verify in database
    const updatedQuote = await prisma.quotation.findUnique({ where: { id: quote.id } });
    assert.equal(updatedQuote?.status, QuotationStatus.COMPLETED);
    assert.equal(updatedQuote?.isReconciled, true);
    assert.equal(updatedQuote?.posTicketNumber, ticketNumber);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: res.ticket.id,
        action: 'POS_TICKET_RECONCILED',
      },
    });
    assert.ok(audit, 'AuditLog for POS_TICKET_RECONCILED should exist');
  });

  test('POS-02: Single POS ticket exact match for non-PRINTED quotation reconciles but does not force COMPLETED', async () => {
    const quote = await createTestQuotation(QuotationStatus.PAID, 8500.00);
    const ticketNumber = `TKT-${Date.now()}-02`;

    const res = await reconcileSingleTicket({
      storeBranchId: 'BRANCH-MUJI-SAMYAN-01',
      registerId: 'REG-02',
      ticketNumber,
      amount: 8500.00,
      quotationNumber: quote.quotationNumber,
      cashierId: 'CASHIER-102',
    });

    assert.equal(res.status, POSTicketStatus.RECONCILED);
    assert.equal(res.quotationStatus, QuotationStatus.PAID);

    const updatedQuote = await prisma.quotation.findUnique({ where: { id: quote.id } });
    assert.equal(updatedQuote?.status, QuotationStatus.PAID);
    assert.equal(updatedQuote?.isReconciled, true);
  });

  test('POS-03: Single POS ticket amount discrepancy flags DISCREPANCY and keeps quotation uncompleted', async () => {
    const quote = await createTestQuotation(QuotationStatus.PRINTED, 20000.00);
    const ticketNumber = `TKT-${Date.now()}-03`;

    const res = await reconcileSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber,
      amount: 19500.00, // 500 under
      quotationNumber: quote.quotationNumber,
      cashierId: 'CASHIER-101',
    });

    assert.equal(res.status, POSTicketStatus.DISCREPANCY);
    assert.equal(res.ticket.status, POSTicketStatus.DISCREPANCY);
    assert.equal(res.ticket.expectedAmount, 20000.00);
    assert.equal(res.ticket.amountDiff, -500.00);
    assert.equal(res.ticket.discrepancyReason, 'AMOUNT_MISMATCH');

    // Verify quotation was NOT completed
    const checkQuote = await prisma.quotation.findUnique({ where: { id: quote.id } });
    assert.equal(checkQuote?.status, QuotationStatus.PRINTED);
    assert.equal(checkQuote?.isReconciled, false);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: res.ticket.id,
        action: 'POS_TICKET_DISCREPANCY',
      },
    });
    assert.ok(audit, 'AuditLog for POS_TICKET_DISCREPANCY should exist');
  });

  test('POS-04: Single POS ticket with unknown quotation flags UNMATCHED', async () => {
    const ticketNumber = `TKT-${Date.now()}-04`;

    const res = await reconcileSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber,
      amount: 4500.00,
      quotationNumber: 'QT-DOES-NOT-EXIST-999',
      cashierId: 'CASHIER-101',
    });

    assert.equal(res.status, POSTicketStatus.UNMATCHED);
    assert.equal(res.ticket.status, POSTicketStatus.UNMATCHED);
    assert.equal(res.discrepancyReason, 'QUOTATION_NOT_FOUND');
    assert.equal(res.matchedQuotationId, null);
  });

  test('POS-05: Duplicate POS ticket on compound key throws DuplicateTicketError (409)', async () => {
    const ticketNumber = `TKT-DUP-${Date.now()}`;
    const payload = {
      storeBranchId: 'BRANCH-SSP-CENTRALWORLD-01',
      registerId: 'REG-03',
      ticketNumber,
      amount: 3200.00,
      cashierId: 'CASHIER-103',
    };

    // First entry succeeds
    await reconcileSingleTicket(payload);

    // Second entry must fail with DuplicateTicketError (409)
    await assert.rejects(
      async () => {
        await reconcileSingleTicket(payload);
      },
      (err: any) => {
        assert.ok(err instanceof DuplicateTicketError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'DUPLICATE_TICKET');
        return true;
      }
    );
  });

  test('POS-06: Validation errors throw PosValidationError (400)', async () => {
    await assert.rejects(
      async () => {
        await reconcileSingleTicket({
          storeBranchId: 'BRANCH-01',
          registerId: 'REG-01',
          ticketNumber: '',
          amount: 100,
        });
      },
      (err: any) => {
        assert.ok(err instanceof PosValidationError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await reconcileSingleTicket({
          storeBranchId: 'BRANCH-01',
          registerId: 'REG-01',
          ticketNumber: 'TKT-VALID-1',
          amount: -50,
        });
      },
      (err: any) => {
        assert.ok(err instanceof PosValidationError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('POS-07: CSV parser correctly parses headers and ticket data', () => {
    const csvData = [
      'storeBranchId,registerId,posTerminalId,ticketNumber,amount,saleDateTime,transactionDate,quotationNumber,cashierId',
      'BRANCH-CHIDLOM-01,REG-01,POS-TERM-01,TKT-PARSER-01,1500.00,2026-09-13T03:30:00.000Z,2026-09-13T03:30:00.000Z,QT-1001,CASHIER-101',
      'BRANCH-MUJI-SAMYAN-01,REG-02,POS-TERM-04,TKT-PARSER-02,2490.50,2026-09-13T03:35:00.000Z,2026-09-13T03:35:00.000Z,QT-1002,CASHIER-102',
    ].join('\n');

    const parsed = parseCsvContent(csvData);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].ticketNumber, 'TKT-PARSER-01');
    assert.equal(parsed[0].amount, 1500.00);
    assert.equal(parsed[0].quotationNumber, 'QT-1001');
    assert.equal(parsed[1].ticketNumber, 'TKT-PARSER-02');
    assert.equal(parsed[1].amount, 2490.50);
  });

  test('POS-08: Batch upload via JSON processes all rows and creates POSBatchUpload record', async () => {
    const q1 = await createTestQuotation(QuotationStatus.PRINTED, 5000);
    const q2 = await createTestQuotation(QuotationStatus.PRINTED, 3000);

    const batchInput = {
      fileName: 'test_daily_pos.json',
      uploadedBy: 'supervisor_test_01',
      businessUnit: 'Central',
      tickets: [
        {
          storeBranchId: 'BRANCH-CHIDLOM-01',
          registerId: 'REG-01',
          ticketNumber: `TKT-BATCH-JSON-${Date.now()}-1`,
          quotationNumber: q1.quotationNumber,
          amount: 5000.00,
          cashierId: 'CASHIER-101',
        },
        {
          storeBranchId: 'BRANCH-CHIDLOM-01',
          registerId: 'REG-01',
          ticketNumber: `TKT-BATCH-JSON-${Date.now()}-2`,
          quotationNumber: q2.quotationNumber,
          amount: 2900.00, // Discrepancy
          cashierId: 'CASHIER-101',
        },
        {
          storeBranchId: 'BRANCH-CHIDLOM-01',
          registerId: 'REG-01',
          ticketNumber: `TKT-BATCH-JSON-${Date.now()}-3`,
          quotationNumber: 'QT-UNKNOWN-BATCH',
          amount: 500.00,
          cashierId: 'CASHIER-101',
        },
      ],
    };

    const batchResult = await processBatchUpload(batchInput);

    assert.equal(batchResult.success, true);
    assert.equal(batchResult.totalRows, 3);
    assert.equal(batchResult.matchedRows, 1);
    assert.equal(batchResult.discrepancyRows, 1);
    assert.equal(batchResult.unmatchedRows, 1);
    assert.ok(batchResult.batchId, 'batchId should be returned');
    assert.equal(batchResult.summary.totalRows, 3);

    // Verify batch in database
    const batchDb = await prisma.pOSBatchUpload.findUnique({ where: { id: batchResult.batchId } });
    assert.ok(batchDb);
    assert.equal(batchDb?.totalRows, 3);
    assert.equal(batchDb?.matchedRows, 1);
  });

  test('POS-09: Batch upload via CSV string processes correctly', async () => {
    const q = await createTestQuotation(QuotationStatus.PRINTED, 4000);
    const ticketNumber = `TKT-BATCH-CSV-${Date.now()}`;

    const csvLines = [
      'storeBranchId,registerId,posTerminalId,ticketNumber,amount,saleDateTime,transactionDate,quotationNumber,cashierId',
      `BRANCH-CHIDLOM-01,REG-01,POS-TERM-01,${ticketNumber},4000.00,2026-09-13T03:30:00.000Z,2026-09-13T03:30:00.000Z,${q.quotationNumber},CASHIER-101`,
    ].join('\n');

    const result = await processBatchUpload(csvLines, {
      fileName: 'daily_upload.csv',
      uploadedBy: 'supervisor_csv',
      businessUnit: 'Central',
    });

    assert.equal(result.success, true);
    assert.equal(result.totalRows, 1);
    assert.equal(result.matchedRows, 1);
  });

  test('POS-10: listTickets filters by status, storeBranchId, and pagination', async () => {
    const list = await listTickets({
      limit: 10,
      page: 1,
    });

    assert.ok(Array.isArray(list.data));
    assert.ok(list.total >= 1);
    assert.equal(list.page, 1);
    assert.equal(list.limit, 10);

    const reconciledList = await listTickets({
      status: POSTicketStatus.RECONCILED,
    });
    assert.ok(reconciledList.data.every(t => t.status === POSTicketStatus.RECONCILED));
  });

  test('POS-11: listBatches and getBatchById return accurate details', async () => {
    const batches = await listBatches({ limit: 5 });
    assert.ok(Array.isArray(batches.data));
    assert.ok(batches.total >= 1);

    const firstBatchId = batches.data[0].id;
    const batchDetail = await getBatchById(firstBatchId);
    assert.equal(batchDetail.id, firstBatchId);
    assert.ok(batchDetail.summary !== null);
  });

  test('POS-12: getTicketById returns ticket with quotation relation', async () => {
    const quote = await createTestQuotation(QuotationStatus.PRINTED, 7500);
    const ticketRes = await reconcileSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber: `TKT-GETBYID-${Date.now()}`,
      amount: 7500,
      quotationNumber: quote.quotationNumber,
    });

    const fetched = await getTicketById(ticketRes.ticket.id);
    assert.equal(fetched.id, ticketRes.ticket.id);
    assert.equal(fetched.status, POSTicketStatus.RECONCILED);
    assert.ok(fetched.quotation);
    assert.equal(fetched.quotation.quotationNumber, quote.quotationNumber);
  });
});
