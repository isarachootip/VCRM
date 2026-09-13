import { NextRequest, NextResponse } from 'next/server';
import { verifySlip, PaymentError } from '@/lib/payments';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body can be empty for default approval
      body = {};
    }

    const result = await verifySlip(id, body);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error(`[API POST /api/payments/${params?.id}/verify] Error:`, error);
    const statusCode = error instanceof PaymentError ? error.statusCode : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify payment slip',
        code: error.code || 'PAYMENT_VERIFY_ERROR',
      },
      { status: statusCode }
    );
  }
}
