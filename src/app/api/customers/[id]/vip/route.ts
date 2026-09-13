import { NextRequest, NextResponse } from 'next/server';
import { tagCustomerVip, VipServiceError } from '@/lib/customers/vip-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const customerId = params.id;
  const userRole = request.headers.get('x-user-role') || request.headers.get('X-User-Role') || 'ADMIN';

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const { isVip, vipTier, reason } = body;

  try {
    const updatedCustomer = await tagCustomerVip(customerId, {
      isVip: Boolean(isVip),
      vipTier,
      reason,
      userRole,
    });

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
    }, { status: 200 });
  } catch (err: any) {
    if (err instanceof VipServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error updating customer VIP status:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
