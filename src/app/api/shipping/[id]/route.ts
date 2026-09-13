import { NextRequest, NextResponse } from 'next/server';
import {
  getShippingFulfillment,
  updateShippingStatus,
  ShippingError,
} from '@/lib/shipping/service';
import { TrackingValidationError } from '@/lib/shipping/courier';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const fulfillment = await getShippingFulfillment(id);

    if (!fulfillment) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: `Shipping fulfillment '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      fulfillment,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();

    const updated = await updateShippingStatus(
      id,
      {
        carrier: body.carrier,
        trackingNumber: body.trackingNumber,
        status: body.status,
        labelFormat: body.labelFormat,
        weightKg: body.weightKg,
        metadata: body.metadata,
      },
      {
        actorId: request.headers.get('x-user-id') || undefined,
        actorName: request.headers.get('x-user-name') || undefined,
      }
    );

    return NextResponse.json({
      success: true,
      fulfillment: updated,
    });
  } catch (err: any) {
    if (err instanceof TrackingValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_TRACKING_FORMAT',
          code: 'INVALID_TRACKING_FORMAT',
          message: err.message,
          carrier: err.carrier,
          trackingNumber: err.trackingNumber,
        },
        { status: 422 }
      );
    }

    if (err instanceof ShippingError) {
      return NextResponse.json(
        { success: false, error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
