import { NextRequest, NextResponse } from 'next/server';
import { createQuotation, listQuotations, QuotationError } from '@/lib/quotations/service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId') || undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;
    const isReconciled = searchParams.get('isReconciled') !== null ? searchParams.get('isReconciled') === 'true' : undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 20;

    const result = await listQuotations({
      caseId,
      customerId,
      businessUnit,
      status,
      search,
      isReconciled,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list quotations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const quotation = await createQuotation(body);

    return NextResponse.json(
      {
        success: true,
        quotation,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating quotation:', error);
    const statusCode = error instanceof QuotationError ? error.statusCode : 400;
    return NextResponse.json(
      {
        error: error.message || 'Failed to create quotation',
        code: error.code || 'QUOTATION_CREATE_ERROR',
        details: error.details || undefined,
      },
      { status: statusCode }
    );
  }
}
