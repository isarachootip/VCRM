import { NextRequest, NextResponse } from 'next/server';
import { getTicketById, PosNotFoundError, PosError } from '@/lib/pos';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const ticket = await getTicketById(id);

    return NextResponse.json(
      {
        success: true,
        ticket,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof PosNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code || 'TICKET_NOT_FOUND',
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

    console.error('[API GET /api/pos/tickets/[id]] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to retrieve ticket',
        code: 'TICKET_GET_ERROR',
      },
      { status: 500 }
    );
  }
}
