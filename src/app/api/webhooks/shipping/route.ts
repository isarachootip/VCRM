/**
 * Courier Shipping Webhook Alias Route
 * Path: src/app/api/webhooks/shipping/route.ts
 *
 * Alias endpoint for courier partner webhooks, delegating to the tracking service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processCourierWebhook } from '@/lib/shipping/tracking-service';
import { TrackingServiceError } from '@/lib/shipping/types';

export async function POST(request: NextRequest) {
  try {
    const signature =
      request.headers.get('x-courier-signature') ||
      request.headers.get('X-Courier-Signature');
    const carrierHeader =
      request.headers.get('x-carrier-code') ||
      request.headers.get('X-Carrier-Code');

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON payload', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const result = await processCourierWebhook(body, {
      signature,
      carrierHeader,
      rawBody: body,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof TrackingServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.statusCode }
      );
    }

    console.error('Unhandled error in shipping webhook alias:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
