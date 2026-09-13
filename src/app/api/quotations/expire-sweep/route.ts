import { NextRequest, NextResponse } from 'next/server';
import { sweepExpiredQuotations } from '@/lib/quotations/service';

export async function POST(request: NextRequest) {
  try {
    const result = await sweepExpiredQuotations();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error sweeping expired quotations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sweep expired quotations',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
