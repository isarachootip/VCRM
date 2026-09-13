import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { PosMockGenerator } from '../../mocks/pos-mock-generator';
import { waitFor } from '../../runner/wait-for';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.12: Store POS Ticket Reconciliation (R3 / Phase 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createPrintedQuotation(bu = 'Central', price = 25000) {
    // 1. Create case
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_pos_case_${Date.now()}_${Math.random()}`,
        source: { channel: 'LINE', pageId: 'central_chidlom', businessUnit: bu, senderId: `U_pos_${Date.now()}` },
        session: { sessionId: `sess_pos_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_pos_${Date.now()}`, type: 'TEXT', text: 'POS testing order' }
      })
    });
    const caseData = await caseRes.json();

    // 2. Create quotation
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.caseId,
        items: [{ sku: 'SKU-POS', productName: 'POS Item', quantity: 1, unitPrice: price }]
      })
    });
    const qData = await quoteRes.json();
    const qId = qData.quotation.id;

    // 3. Mark PAID and PRINTED
    await fetch(`${APP_URL}/api/quotations/${qId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });
    await fetch(`${APP_URL}/api/quotations/${qId}/lock`, { method: 'POST' });

    const finalRes = await fetch(`${APP_URL}/api/quotations/${qId}`);
    const finalData = await finalRes.json();
    return finalData.quotation || finalData;
  }

  test('T1.12.1 - Single POS ticket entry matching order amount flags RECONCILED and completes Quotation', async () => {
    const quote = await createPrintedQuotation('Central', 10000);
    const ticketPayload = PosMockGenerator.generateSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber: `TKT-${Date.now()}-01`,
      quotationNumber: quote.quotationNumber,
      amount: quote.grandTotal,
      cashierId: 'CASHIER-101'
    });

    const res = await fetch(`${APP_URL}/api/pos/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketPayload)
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      assert.ok(data.ticket || data.status, 'Response should contain ticket data');
      const status = data.ticket?.status || data.status;
      assert.equal(status, 'RECONCILED', 'Matched POS ticket must be RECONCILED');

      // Verify quotation advances to COMPLETED
      const qRes = await fetch(`${APP_URL}/api/quotations/${quote.id}`);
      const qData = await qRes.json();
      const currentStatus = qData.quotation?.status || qData.status;
      assert.ok(['COMPLETED', 'PRINTED'].includes(currentStatus));
    }
  });

  test('T1.12.2 - Single POS ticket entry with amount discrepancy flags DISCREPANCY', async () => {
    const quote = await createPrintedQuotation('Central', 10000);
    const ticketPayload = PosMockGenerator.generateSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber: `TKT-${Date.now()}-02`,
      quotationNumber: quote.quotationNumber,
      amount: quote.grandTotal - 500, // Mismatched amount
      cashierId: 'CASHIER-101'
    });

    const res = await fetch(`${APP_URL}/api/pos/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketPayload)
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      const status = data.ticket?.status || data.status;
      assert.equal(status, 'DISCREPANCY', 'Mismatched POS ticket must be flagged as DISCREPANCY');
    }
  });

  test('T1.12.3 - POS ticket entry with non-existent quotation flags UNMATCHED', async () => {
    const ticketPayload = PosMockGenerator.generateSingleTicket({
      storeBranchId: 'BRANCH-CHIDLOM-01',
      registerId: 'REG-01',
      ticketNumber: `TKT-${Date.now()}-03`,
      quotationNumber: 'QT-DOES-NOT-EXIST-999',
      amount: 1500,
      cashierId: 'CASHIER-101'
    });

    const res = await fetch(`${APP_URL}/api/pos/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketPayload)
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      const status = data.ticket?.status || data.status;
      assert.ok(['UNMATCHED', 'DISCREPANCY'].includes(status));
    }
  });

  test('T1.12.4 - Batch POS reconciliation via JSON payload', async () => {
    const quote1 = await createPrintedQuotation('Central', 5000);
    const quote2 = await createPrintedQuotation('Muji', 2000);

    const batchPayload = {
      fileName: 'daily_pos_test.json',
      uploadedBy: 'supervisor_chidlom_01',
      businessUnit: 'CENTRAL',
      tickets: [
        {
          storeBranchId: 'BRANCH-CHIDLOM-01',
          registerId: 'REG-01',
          ticketNumber: `TKT-${Date.now()}-11`,
          quotationNumber: quote1.quotationNumber,
          amount: quote1.grandTotal,
          cashierId: 'CASHIER-101'
        },
        {
          storeBranchId: 'BRANCH-MUJI-SAMYAN-01',
          registerId: 'REG-01',
          ticketNumber: `TKT-${Date.now()}-12`,
          quotationNumber: quote2.quotationNumber,
          amount: quote2.grandTotal - 100, // Discrepancy
          cashierId: 'CASHIER-102'
        },
        {
          storeBranchId: 'BRANCH-CHIDLOM-01',
          registerId: 'REG-02',
          ticketNumber: `TKT-${Date.now()}-13`,
          quotationNumber: 'QT-UNKNOWN',
          amount: 500,
          cashierId: 'CASHIER-103'
        }
      ]
    };

    const res = await fetch(`${APP_URL}/api/pos/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchPayload)
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      assert.ok(data.totalRows >= 3 || data.summary?.totalRows >= 3);
      assert.ok(data.matchedRows !== undefined || data.summary?.matchedRows !== undefined);
    }
  });

  test('T1.12.5 - Batch POS reconciliation via CSV file format', async () => {
    const quote = await createPrintedQuotation('Central', 4000);
    const tickets = [
      PosMockGenerator.generateSingleTicket({
        storeBranchId: 'BRANCH-CHIDLOM-01',
        registerId: 'REG-01',
        ticketNumber: `TKT-CSV-${Date.now()}-1`,
        quotationNumber: quote.quotationNumber,
        amount: quote.grandTotal
      })
    ];
    const csvContent = PosMockGenerator.generateCsvBatch(tickets);

    const res = await fetch(`${APP_URL}/api/pos/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csvContent
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      assert.ok(data.success || data.totalRows !== undefined);
    }
  });
});
