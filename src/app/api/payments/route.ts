import { NextRequest, NextResponse } from 'next/server';
import { listPayments, recordPayment, PaymentError } from '@/lib/payments';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const businessUnit = searchParams.get('businessUnit') || searchParams.get('bu') || undefined;
    const status = searchParams.get('status') || undefined;
    const quotationId = searchParams.get('quotationId') || undefined;
    const paymentMethod = searchParams.get('paymentMethod') || undefined;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const page = searchParams.get('page') || undefined;
    const limit = searchParams.get('limit') || undefined;

    const result = await listPayments({
      businessUnit,
      status,
      quotationId,
      paymentMethod,
      search,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[API GET /api/payments] Error listing payments:', error);
    const statusCode = error instanceof PaymentError ? error.statusCode : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list payment transactions',
        code: error.code || 'PAYMENTS_LIST_ERROR',
      },
      { status: statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON payload', code: 'MALFORMED_JSON' },
        { status: 400 }
      );
    }

    const payment = await recordPayment(body);

    return NextResponse.json(
      {
        success: true,
        payment,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API POST /api/payments] Error recording payment:', error);
    const statusCode = error instanceof PaymentError ? error.statusCode : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to record payment',
        code: error.code || 'PAYMENT_RECORD_ERROR',
      },
      { status: statusCode }
    );
  }
}
