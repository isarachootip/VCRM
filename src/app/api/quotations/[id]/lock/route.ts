import { NextRequest, NextResponse } from 'next/server';
import { lockQuotation, QuotationError } from '@/lib/quotations/service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json().catch(() => ({}));

    const quotation = await lockQuotation(id, {
      actorId: body.actorId,
    });

    return NextResponse.json(
      {
        success: true,
        quotation,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Error locking quotation ${params?.id}:`, error);
    const statusCode = error instanceof QuotationError ? error.statusCode : 400;
    return NextResponse.json(
      {
        error: error.message || 'Failed to lock quotation',
        code: error.code || 'LOCK_ERROR',
      },
      { status: statusCode }
    );
  }
}
