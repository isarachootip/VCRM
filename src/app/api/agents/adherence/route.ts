/**
 * Supervisor Agent Adherence & Break Metrics REST API Route (R3 / Phase 3)
 * Path: src/app/api/agents/adherence/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentAdherenceReport } from '@/lib/agents/adherence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || searchParams.get('userId') || undefined;
    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const date = searchParams.get('date') || undefined;

    const report = await getAgentAdherenceReport({
      agentId,
      businessUnit,
      date,
    });

    return NextResponse.json(report, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch agent adherence report' },
      { status: 500 }
    );
  }
}
