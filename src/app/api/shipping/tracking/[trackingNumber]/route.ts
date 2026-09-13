/**
 * Shipping Tracking Detail API Route
 * Path: src/app/api/shipping/tracking/[trackingNumber]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrackingTimeline } from '@/lib/shipping/tracking-service';
import { TrackingServiceError } from '@/lib/shipping/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingNumber: string } }
) {
  try {
    const { trackingNumber } = params;
    const timeline = await getTrackingTimeline(trackingNumber);
    return NextResponse.json(timeline, { status: 200 });
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

    console.error('Unhandled error in tracking detail endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve tracking detail' },
      { status: 500 }
    );
  }
}
