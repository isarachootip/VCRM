import { NextRequest, NextResponse } from 'next/server';
import { lookupThe1Profile } from '@/lib/loyalty/the1';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone') || searchParams.get('mobile') || undefined;
    const cardNumber = searchParams.get('cardNumber') || searchParams.get('card') || searchParams.get('the1CardNumber') || undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const identifier = searchParams.get('identifier') || searchParams.get('q') || searchParams.get('query') || undefined;

    if (!phone && !cardNumber && !customerId && !identifier) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_IDENTIFIER_FORMAT',
          message: 'Please provide phone number, card number, or customerId parameter.',
        },
        { status: 400 }
      );
    }

    const profile = await lookupThe1Profile({
      phone,
      cardNumber,
      customerId,
      identifier,
    });

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: 'MEMBER_NOT_FOUND',
          message: 'No The 1 loyalty profile found for the provided identifier.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        member: profile,
        // Flat top-level convenience properties
        memberId: profile.memberId,
        the1CardNumber: profile.the1CardNumber,
        cardNumber: profile.the1CardNumber,
        name: profile.name,
        mobile: profile.mobile,
        tier: profile.tier,
        the1Tier: profile.tier,
        pointsBalance: profile.pointsBalance,
        availablePoints: profile.availablePoints,
        pointsValueThb: profile.pointsValueThb,
        customerId: profile.customerId,
        customer: profile.customer,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in The 1 loyalty lookup:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error looking up The 1 loyalty profile',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = body.phone || body.mobile || undefined;
    const cardNumber = body.cardNumber || body.the1CardNumber || body.card || undefined;
    const customerId = body.customerId || undefined;
    const identifier = body.identifier || body.q || body.query || undefined;

    if (!phone && !cardNumber && !customerId && !identifier) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_IDENTIFIER_FORMAT',
          message: 'Please provide phone number, card number, or customerId.',
        },
        { status: 400 }
      );
    }

    const profile = await lookupThe1Profile({
      phone,
      cardNumber,
      customerId,
      identifier,
    });

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: 'MEMBER_NOT_FOUND',
          message: 'No The 1 loyalty profile found for the provided identifier.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        member: profile,
        memberId: profile.memberId,
        the1CardNumber: profile.the1CardNumber,
        cardNumber: profile.the1CardNumber,
        name: profile.name,
        mobile: profile.mobile,
        tier: profile.tier,
        the1Tier: profile.tier,
        pointsBalance: profile.pointsBalance,
        availablePoints: profile.availablePoints,
        pointsValueThb: profile.pointsValueThb,
        customerId: profile.customerId,
        customer: profile.customer,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in The 1 loyalty lookup POST:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error looking up The 1 loyalty profile',
      },
      { status: 500 }
    );
  }
}
