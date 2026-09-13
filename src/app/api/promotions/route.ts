/**
 * Promotions REST API Route
 * Path: src/app/api/promotions/route.ts
 *
 * Implements Phase 2 R6 (Milestone M18):
 * - GET: List active promotional campaigns (Read access for all authenticated roles).
 * - POST: Create promotion (RBAC restricted to ADMIN and SUPERVISOR; HTTP 403 on frontline agents).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listPromotions,
  createPromotion,
  canMutatePromotions,
} from '@/lib/promotions/service';
import { getUserRole } from '@/lib/audit/redactor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bu = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;
    const code = searchParams.get('code') || undefined;
    const isActive = searchParams.get('isActive') !== null ? searchParams.get('isActive')! : undefined;
    const validNow = searchParams.get('validNow') !== null ? searchParams.get('validNow')! : undefined;
    const page = searchParams.get('page') || undefined;
    const limit = searchParams.get('limit') || undefined;

    const result = await listPromotions({
      bu,
      search,
      code,
      isActive,
      validNow,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Promotions GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list promotions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = getUserRole(request);

    // Enforce RBAC: Only ADMIN and SUPERVISOR may create promotions
    if (!canMutatePromotions(role)) {
      return NextResponse.json(
        {
          error: 'PROMOTION_MUTATION_RESTRICTED',
          message: 'Frontline agents have read-only access to promotions',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const newPromotion = await createPromotion(body);

    return NextResponse.json(
      {
        success: true,
        promotion: newPromotion,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Promotions POST] Error:', error);
    const isConflict = error.message?.includes('already exists');
    return NextResponse.json(
      { error: error.message || 'Failed to create promotion' },
      { status: isConflict ? 409 : 400 }
    );
  }
}
