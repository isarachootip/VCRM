/**
 * Quick-Share Promotion Card REST API Route
 * Path: src/app/api/promotions/[id]/card/route.ts
 *
 * Implements Phase 2 R6 (Milestone M18):
 * - Generates structured card payload (type: 'PROMOTION_CARD') for Zwiz chat composer.
 * - Accessible to all authenticated frontline agents and supervisors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePromotionCard } from '@/lib/promotions/service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId') || undefined;

    const card = await generatePromotionCard(params.id, caseId);

    return NextResponse.json({
      success: true,
      card,
    });
  } catch (error: any) {
    console.error(`[Promotion Card GET ${params.id}] Error:`, error);
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to generate promotion card' },
      { status }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const caseId = body.caseId || undefined;

    const card = await generatePromotionCard(params.id, caseId);

    return NextResponse.json({
      success: true,
      card,
    });
  } catch (error: any) {
    console.error(`[Promotion Card POST ${params.id}] Error:`, error);
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to generate promotion card' },
      { status }
    );
  }
}
