/**
 * Agent Break Start REST API Route (R3 / Phase 3)
 * Path: src/app/api/agents/break/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { startAgentBreak, PresenceError } from '@/lib/agents/presence';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const agentId = body.agentId || body.userId;
    const status = body.status;
    const durationMinutes = body.durationMinutes;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing required field: agentId', code: 'MISSING_AGENT_ID' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Missing required field: status', code: 'MISSING_STATUS' },
        { status: 400 }
      );
    }

    const result = await startAgentBreak({
      agentId,
      status,
      durationMinutes,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof PresenceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to start agent break' },
      { status: 500 }
    );
  }
}
