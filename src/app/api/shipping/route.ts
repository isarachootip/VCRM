import { NextRequest, NextResponse } from 'next/server';
import {
  createShippingFulfillment,
  listShippingFulfillments,
  ShippingError,
  OrderNotPaidError,
  IncompleteAddressError,
} from '@/lib/shipping/service';
import { TrackingValidationError } from '@/lib/shipping/courier';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const carrier = searchParams.get('carrier') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = searchParams.get('page') || undefined;
    const limit = searchParams.get('limit') || undefined;

    const result = await listShippingFulfillments({
      status,
      carrier,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      items: result.items,
      pagination: result.pagination,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.quotationId) {
      return NextResponse.json(
        { success: false, error: 'MISSING_QUOTATION_ID', message: 'quotationId is required' },
        { status: 400 }
      );
    }

    const fulfillment = await createShippingFulfillment({
      quotationId: body.quotationId,
      carrier: body.carrier,
      trackingNumber: body.trackingNumber,
      recipientName: body.recipientName,
      recipientPhone: body.recipientPhone,
      shippingAddress: body.shippingAddress,
      postalCode: body.postalCode,
      weightKg: body.weightKg,
      labelFormat: body.labelFormat,
      metadata: body.metadata,
      createdById: request.headers.get('x-user-id') || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        fulfillment,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof OrderNotPaidError) {
      return NextResponse.json(
        {
          success: false,
          error: 'ORDER_NOT_PAID',
          code: 'ORDER_NOT_PAID',
          message: err.message,
          details: err.details,
        },
        { status: 400 }
      );
    }

    if (err instanceof IncompleteAddressError) {
      return NextResponse.json(
        {
          success: false,
          error: 'INCOMPLETE_ADDRESS',
          code: 'INCOMPLETE_ADDRESS',
          message: err.message,
          missingFields: err.details?.missingFields,
        },
        { status: 422 }
      );
    }

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
        {
          success: false,
          error: err.code,
          message: err.message,
        },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: err.message },
      { status: 500 }
    );
  }
}
