export interface PosTicketPayload {
  storeBranchId: string;
  registerId: string;
  ticketNumber: string;
  amount: number;
  quotationNumber: string;
  cashierId: string;
  transactionDate?: string;
  saleDateTime?: string;
  posTerminalId?: string;
}

export interface PosBatchUploadPayload {
  fileName: string;
  uploadedBy: string;
  businessUnit?: string;
  totalRows: number;
  tickets: PosTicketPayload[];
}

export class PosMockGenerator {
  public static defaultBranches = [
    'BRANCH-CHIDLOM-01',
    'BRANCH-MUJI-SAMYAN-01',
    'BRANCH-SSP-CENTRALWORLD-01',
    'BRANCH-B2S-CENTRALWORLD-01'
  ];

  public static generateSingleTicket(options: Partial<PosTicketPayload> = {}): PosTicketPayload {
    const timestamp = options.saleDateTime || options.transactionDate || new Date().toISOString();
    return {
      storeBranchId: options.storeBranchId || 'BRANCH-CHIDLOM-01',
      registerId: options.registerId || 'REG-01',
      posTerminalId: options.posTerminalId || 'POS-TERM-CHIDLOM-01',
      ticketNumber: options.ticketNumber || `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: options.amount ?? 27890.00,
      quotationNumber: options.quotationNumber || `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      cashierId: options.cashierId || 'CASHIER-101',
      saleDateTime: timestamp,
      transactionDate: timestamp
    };
  }

  public static generateCsvBatch(tickets: PosTicketPayload[]): string {
    const headers = [
      'storeBranchId',
      'registerId',
      'posTerminalId',
      'ticketNumber',
      'amount',
      'saleDateTime',
      'transactionDate',
      'quotationNumber',
      'cashierId'
    ];

    const rows = tickets.map(t => {
      const date = t.saleDateTime || t.transactionDate || new Date().toISOString();
      return [
        t.storeBranchId,
        t.registerId,
        t.posTerminalId || 'POS-TERM-01',
        t.ticketNumber,
        t.amount.toFixed(2),
        date,
        date,
        t.quotationNumber,
        t.cashierId
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  public static generateBatchPayload(options: {
    fileName?: string;
    uploadedBy?: string;
    businessUnit?: string;
    tickets?: PosTicketPayload[];
  } = {}): PosBatchUploadPayload {
    const tickets = options.tickets || [
      this.generateSingleTicket({ storeBranchId: 'BRANCH-CHIDLOM-01', registerId: 'REG-01', amount: 27890.00 }),
      this.generateSingleTicket({ storeBranchId: 'BRANCH-MUJI-SAMYAN-01', registerId: 'REG-01', amount: 1450.00 })
    ];

    return {
      fileName: options.fileName || `pos_batch_${Date.now()}.csv`,
      uploadedBy: options.uploadedBy || 'user_supervisor_01',
      businessUnit: options.businessUnit || 'CENTRAL',
      totalRows: tickets.length,
      tickets
    };
  }

  public static generateDeterministicBatch(): { csv: string; json: PosBatchUploadPayload; tickets: PosTicketPayload[] } {
    const tickets: PosTicketPayload[] = [
      {
        storeBranchId: 'BRANCH-CHIDLOM-01',
        registerId: 'REG-01',
        posTerminalId: 'POS-TERM-01',
        ticketNumber: 'TKT-2026-9081',
        amount: 27890.00,
        saleDateTime: '2026-09-13T03:30:00.000Z',
        transactionDate: '2026-09-13T03:30:00.000Z',
        quotationNumber: 'QT-2026-1001',
        cashierId: 'CASHIER-101'
      },
      {
        storeBranchId: 'BRANCH-MUJI-SAMYAN-01',
        registerId: 'REG-02',
        posTerminalId: 'POS-TERM-04',
        ticketNumber: 'TKT-2026-9082',
        amount: 1450.00,
        saleDateTime: '2026-09-13T03:35:00.000Z',
        transactionDate: '2026-09-13T03:35:00.000Z',
        quotationNumber: 'QT-2026-1002',
        cashierId: 'CASHIER-102'
      },
      {
        storeBranchId: 'BRANCH-CHIDLOM-01',
        registerId: 'REG-01',
        posTerminalId: 'POS-TERM-01',
        ticketNumber: 'TKT-2026-9083',
        amount: 500.00,
        saleDateTime: '2026-09-13T03:40:00.000Z',
        transactionDate: '2026-09-13T03:40:00.000Z',
        quotationNumber: 'QT-NON-EXISTENT',
        cashierId: 'CASHIER-101'
      },
      {
        storeBranchId: 'BRANCH-SSP-CENTRALWORLD-01',
        registerId: 'REG-03',
        posTerminalId: 'POS-TERM-09',
        ticketNumber: 'TKT-2026-9084',
        amount: 3200.00,
        saleDateTime: '2026-09-13T03:45:00.000Z',
        transactionDate: '2026-09-13T03:45:00.000Z',
        quotationNumber: 'QT-2026-1003',
        cashierId: 'CASHIER-103'
      },
      {
        storeBranchId: 'BRANCH-B2S-CENTRALWORLD-01',
        registerId: 'REG-01',
        posTerminalId: 'POS-TERM-02',
        ticketNumber: 'TKT-2026-9085',
        amount: 890.00,
        saleDateTime: '2026-09-13T03:50:00.000Z',
        transactionDate: '2026-09-13T03:50:00.000Z',
        quotationNumber: 'QT-2026-1004',
        cashierId: 'CASHIER-104'
      }
    ];

    const csv = this.generateCsvBatch(tickets);
    const json: PosBatchUploadPayload = {
      fileName: 'pos-tickets-batch.csv',
      uploadedBy: 'supervisor_chidlom_01',
      businessUnit: 'CENTRAL',
      totalRows: tickets.length,
      tickets
    };

    return { csv, json, tickets };
  }
}
