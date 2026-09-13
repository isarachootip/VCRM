/**
 * Agent Break Session History REST API Route (R3 / Phase 3)
 * Path: src/app/api/agents/break/history/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentBreakHistory } from '@/lib/agents/adherence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || searchParams.get('userId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: agentId' },
        { status: 400 }
      );
    }

    const sessions = await getAgentBreakHistory(agentId);

    return NextResponse.json({
      success: true,
      agentId,
      sessions,
      total: sessions.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch break history' },
      { status: 500 }
    );
  }
}
