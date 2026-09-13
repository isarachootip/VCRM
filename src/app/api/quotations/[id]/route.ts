import { NextRequest, NextResponse } from 'next/server';
import { getQuotationById, updateQuotation, QuotationError } from '@/lib/quotations/service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const { searchParams } = new URL(request.url);
    const checkExpiration = searchParams.get('checkExpiration') !== 'false';

    const quotation = await getQuotationById(id, { checkExpiration });

    if (!quotation) {
      return NextResponse.json(
        { error: `Quotation ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        quotation,
        ...quotation,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Error retrieving quotation ${params?.id}:`, error);
    const statusCode = error instanceof QuotationError ? error.statusCode : 500;
    return NextResponse.json(
      {
        error: error.message || 'Failed to retrieve quotation',
        code: error.code || 'QUOTATION_GET_ERROR',
      },
      { status: statusCode }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json().catch(() => ({}));

    const quotation = await updateQuotation(id, body, body.actorId);

    return NextResponse.json(
      {
        success: true,
        quotation,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Error updating quotation ${params?.id}:`, error);
    const statusCode = error instanceof QuotationError ? error.statusCode : (error.statusCode || 400);
    return NextResponse.json(
      {
        error: error.message || 'Failed to update quotation',
        code: error.code || 'QUOTATION_UPDATE_ERROR',
        details: error.details || undefined,
      },
      { status: statusCode }
    );
  }
}
