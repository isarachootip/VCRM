/**
 * Agent Break Sweeper REST API Route (R3 / Phase 3)
 * Path: src/app/api/agents/break-sweep/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { sweepAgentBreakTimers } from '@/lib/agents/break-sweep';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const simulatedElapsedMinutes =
      body.simulatedElapsedMinutes !== undefined ? Number(body.simulatedElapsedMinutes) : null;
    const dryRun = Boolean(body.dryRun);

    const result = await sweepAgentBreakTimers({
      simulatedElapsedMinutes,
      dryRun,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Break sweep scheduler failed' },
      { status: 500 }
    );
  }
}
