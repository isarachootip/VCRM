import { NextRequest, NextResponse } from 'next/server';
import { getBatchById, PosNotFoundError, PosError } from '@/lib/pos';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const batch = await getBatchById(id);

    return NextResponse.json(
      {
        success: true,
        batch,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof PosNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code || 'BATCH_NOT_FOUND',
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

    console.error('[API GET /api/pos/batches/[id]] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to retrieve batch',
        code: 'BATCH_GET_ERROR',
      },
      { status: 500 }
    );
  }
}
