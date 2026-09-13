import { NextRequest, NextResponse } from 'next/server';
import { transitionStatus, QuotationError } from '@/lib/quotations/service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json().catch(() => ({}));

    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing target status in request body', code: 'MISSING_STATUS' },
        { status: 400 }
      );
    }

    const result = await transitionStatus(id, body.status, {
      reason: body.reason || body.voidReason,
      actorId: body.actorId,
      actorName: body.actorName,
    });

    return NextResponse.json(
      {
        success: true,
        quotation: result.quotation,
        idempotent: result.idempotent,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Error transitioning status for quotation ${params?.id}:`, error);
    const statusCode = error instanceof QuotationError ? error.statusCode : 400;
    return NextResponse.json(
      {
        error: error.message || 'Failed to transition quotation status',
        code: error.code || 'STATUS_TRANSITION_ERROR',
        details: error.details || undefined,
      },
      { status: statusCode }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return POST(request, context);
}
