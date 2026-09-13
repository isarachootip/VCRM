import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomer360Profile,
  linkCustomerIdentity,
} from '@/lib/customers/analytics';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const profile = await getCustomer360Profile(id);

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: 'CUSTOMER_NOT_FOUND',
          message: `Customer 360 profile not found for '${id}'`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: profile,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();

    const customer = await linkCustomerIdentity({
      ...body,
      customerId: id,
      actorId: request.headers.get('x-user-id') || undefined,
    });

    return NextResponse.json({
      success: true,
      customer,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Identity linking failed' },
      { status: 400 }
    );
  }
}
