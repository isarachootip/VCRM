import { NextRequest, NextResponse } from 'next/server';
import {
  reconcileSingleTicket,
  listTickets,
  DuplicateTicketError,
  PosValidationError,
  PosNotFoundError,
  PosError,
} from '@/lib/pos';

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON payload', code: 'MALFORMED_JSON' },
        { status: 400 }
      );
    }

    const result = await reconcileSingleTicket(body);

    return NextResponse.json(
      {
        success: true,
        status: result.status,
        ticket: result.ticket,
        quotationStatus: result.quotationStatus,
        matchedQuotationId: result.matchedQuotationId,
        expectedAmount: result.expectedAmount,
        amountDiff: result.amountDiff,
        discrepancyReason: result.discrepancyReason,
        reason: result.discrepancyReason,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof DuplicateTicketError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code || 'DUPLICATE_TICKET',
        },
        { status: 409 }
      );
    }

    if (error instanceof PosValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code || 'POS_VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    if (error instanceof PosNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code || 'POS_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (error instanceof PosError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode }
      );
    }

    console.error('[API POST /api/pos/tickets] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || undefined;
    const storeBranchId = searchParams.get('storeBranchId') || undefined;
    const registerId = searchParams.get('registerId') || undefined;
    const ticketNumber = searchParams.get('ticketNumber') || undefined;
    const quotationId = searchParams.get('quotationId') || undefined;
    const quotationNumber = searchParams.get('quotationNumber') || undefined;
    const batchUploadId = searchParams.get('batchUploadId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;
    const page = searchParams.get('page') || undefined;
    const limit = searchParams.get('limit') || undefined;

    const result = await listTickets({
      status,
      storeBranchId,
      registerId,
      ticketNumber,
      quotationId,
      quotationNumber,
      batchUploadId,
      dateFrom,
      dateTo,
      search,
      page,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        tickets: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API GET /api/pos/tickets] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to list POS tickets',
        code: 'POS_LIST_ERROR',
      },
      { status: 500 }
    );
  }
}
