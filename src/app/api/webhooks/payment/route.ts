import { NextRequest, NextResponse } from 'next/server';
import { processPaymentWebhook, PaymentError } from '@/lib/payments';

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON payload', code: 'MALFORMED_JSON' },
        { status: 400 }
      );
    }

    const signature =
      request.headers.get('x-payment-signature') ||
      request.headers.get('x-gateway-signature') ||
      undefined;

    const headerMerchantId = request.headers.get('x-merchant-id') || undefined;
    if (headerMerchantId && !body.merchantId) {
      body.merchantId = headerMerchantId;
    }

    const result = await processPaymentWebhook(body, { signature });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/webhooks/payment] Error processing payment webhook:', error);

    const statusCode = error instanceof PaymentError ? error.statusCode : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal payment webhook error',
        code: error.code || 'PAYMENT_WEBHOOK_ERROR',
        details: error.details,
      },
      { status: statusCode }
    );
  }
}
