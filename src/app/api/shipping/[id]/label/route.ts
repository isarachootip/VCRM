import { NextRequest, NextResponse } from 'next/server';
import {
  generateShippingLabelHtml,
  ShippingError,
  OrderNotPaidError,
} from '@/lib/shipping/service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || undefined;

    const html = await generateShippingLabelHtml(id, format);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    if (err instanceof OrderNotPaidError) {
      return NextResponse.json(
        {
          success: false,
          error: 'ORDER_NOT_PAID',
          message: err.message,
          details: err.details,
        },
        { status: 400 }
      );
    }

    if (err instanceof ShippingError) {
      return NextResponse.json(
        { success: false, error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'LABEL_GENERATION_FAILED', message: err.message },
      { status: 500 }
    );
  }
}
