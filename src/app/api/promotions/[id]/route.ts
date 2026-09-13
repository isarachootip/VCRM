/**
 * Single Promotion REST API Route
 * Path: src/app/api/promotions/[id]/route.ts
 *
 * Implements Phase 2 R6 (Milestone M18):
 * - GET: Fetch promotion by ID or generate quick-share card (?card=true).
 * - PUT / PATCH: Update promotion (RBAC restricted to ADMIN & SUPERVISOR; HTTP 403 on frontline agents).
 * - DELETE: Archive / remove promotion (RBAC restricted to ADMIN & SUPERVISOR; HTTP 403 on frontline agents).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPromotionById,
  updatePromotion,
  archivePromotion,
  deletePromotion,
  generatePromotionCard,
  canMutatePromotions,
} from '@/lib/promotions/service';
import { getUserRole } from '@/lib/audit/redactor';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promoId = params.id;
    const promo = await getPromotionById(promoId);

    if (!promo) {
      return NextResponse.json(
        { error: `Promotion ${promoId} not found` },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const wantsCard =
      searchParams.get('card') === 'true' ||
      searchParams.get('format') === 'card';

    if (wantsCard) {
      const caseId = searchParams.get('caseId') || undefined;
      const card = await generatePromotionCard(promo, caseId);
      return NextResponse.json({
        success: true,
        card,
      });
    }

    return NextResponse.json({
      success: true,
      promotion: promo,
    });
  } catch (error: any) {
    console.error(`[Promotion GET ${params.id}] Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch promotion' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const role = getUserRole(request);

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
    const updated = await updatePromotion(params.id, body);

    return NextResponse.json({
      success: true,
      promotion: updated,
    });
  } catch (error: any) {
    console.error(`[Promotion PUT ${params.id}] Error:`, error);
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to update promotion' },
      { status }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return PUT(request, { params });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const role = getUserRole(request);

    if (!canMutatePromotions(role)) {
      return NextResponse.json(
        {
          error: 'PROMOTION_MUTATION_RESTRICTED',
          message: 'Frontline agents have read-only access to promotions',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      await deletePromotion(params.id);
      return NextResponse.json({
        success: true,
        message: 'Promotion permanently deleted',
      });
    }

    const archived = await archivePromotion(params.id);
    return NextResponse.json({
      success: true,
      message: 'Promotion archived successfully',
      promotion: archived,
    });
  } catch (error: any) {
    console.error(`[Promotion DELETE ${params.id}] Error:`, error);
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to delete promotion' },
      { status }
    );
  }
}
