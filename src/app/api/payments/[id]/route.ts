import { NextRequest, NextResponse } from 'next/server';
import { getPaymentById, PaymentError } from '@/lib/payments';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const payment = await getPaymentById(id);

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment transaction ${id} not found`,
          code: 'PAYMENT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        payment,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`[API GET /api/payments/${params?.id}] Error:`, error);
    const statusCode = error instanceof PaymentError ? error.statusCode : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve payment',
        code: error.code || 'PAYMENT_GET_ERROR',
      },
      { status: statusCode }
    );
  }
}
