import { NextRequest, NextResponse } from 'next/server';
import { printQuotation, QuotationError, QuotationAlreadyPrintedError } from '@/lib/quotations/service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json().catch(() => ({}));

    const quotation = await printQuotation(id, {
      actorId: body.actorId || body.printedById,
      actorName: body.actorName,
    });

    return NextResponse.json(
      {
        success: true,
        quotation,
        message: 'Quotation printed successfully and single-print lock applied.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Error printing quotation ${params?.id}:`, error);

    if (error instanceof QuotationAlreadyPrintedError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          quotationNumber: error.details?.quotationNumber,
          printedAt: error.details?.printedAt,
          printCount: error.details?.printCount,
        },
        { status: 403 }
      );
    }

    const statusCode = error instanceof QuotationError ? error.statusCode : 400;
    return NextResponse.json(
      {
        error: error.message || 'Failed to print quotation',
        code: error.code || 'PRINT_ERROR',
        details: error.details || undefined,
      },
      { status: statusCode }
    );
  }
}
