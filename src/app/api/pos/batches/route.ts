import { NextRequest, NextResponse } from 'next/server';
import { listBatches } from '@/lib/pos';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const businessUnit = searchParams.get('businessUnit') || undefined;
    const status = searchParams.get('status') || undefined;
    const uploadedBy = searchParams.get('uploadedBy') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const page = searchParams.get('page') || undefined;
    const limit = searchParams.get('limit') || undefined;

    const result = await listBatches({
      businessUnit,
      status,
      uploadedBy,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        batches: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API GET /api/pos/batches] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to list batch uploads',
        code: 'BATCHES_LIST_ERROR',
      },
      { status: 500 }
    );
  }
}
