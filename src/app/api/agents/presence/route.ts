/**
 * Agent Presence REST API Endpoint
 * Path: src/app/api/agents/presence/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { listAgentPresence, updateAgentPresence } from '@/lib/agents/presence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || searchParams.get('userId');

    if (agentId) {
      const { getAgentPresence } = await import('@/lib/agents/presence');
      const agent = await getAgentPresence(agentId);
      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        agent,
        agents: [agent],
      });
    }

    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const queueId = searchParams.get('queueId') || undefined;
    const presence = searchParams.get('presence') || undefined;

    const agents = await listAgentPresence({
      businessUnit,
      queueId,
      presence,
    });

    return NextResponse.json({
      success: true,
      agents,
      total: agents.length,
    });
  } catch (error: any) {
    console.error('[Agent Presence GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list agent presence' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId || body.agentId;
    const presence = body.presence;
    const reason = body.reason;
    const maxConcurrentChats = body.maxConcurrentChats;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId or agentId' },
        { status: 400 }
      );
    }

    if (!presence) {
      return NextResponse.json(
        { error: 'Missing required field: presence' },
        { status: 400 }
      );
    }

    const updated = await updateAgentPresence({
      userId,
      presence,
      reason,
      maxConcurrentChats,
    });

    return NextResponse.json({
      success: true,
      userId: updated.id,
      presence: updated.presence,
      agent: updated,
    });
  } catch (error: any) {
    const isValidation = error.message && error.message.includes('Invalid presence status');
    return NextResponse.json(
      { error: error.message || 'Failed to update agent presence' },
      { status: isValidation ? 400 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
