import { NextRequest, NextResponse } from 'next/server';
import { listAgentPresence } from '@/lib/agents/presence';
import { findBestAgentForQueue, routeCaseToAgent } from '@/lib/agents/queue-routing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const queueId = searchParams.get('queueId') || undefined;
    const presence = searchParams.get('presence') || undefined;
    const findBest = searchParams.get('best') === 'true' || searchParams.get('findBest') === 'true';
    const algorithm = (searchParams.get('algorithm') as any) || undefined;

    // Support querying optimal agent for a queue
    if (findBest && queueId) {
      const bestAgent = await findBestAgentForQueue(queueId, algorithm);
      return NextResponse.json({
        success: true,
        queueId,
        algorithm: algorithm || 'LEAST_ACTIVE',
        bestAgent: bestAgent || null,
        overflow: !bestAgent,
      });
    }

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
    console.error('[Agents GET] Error listing agents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { caseId, queueId, algorithm } = body;

    if (!caseId) {
      return NextResponse.json(
        { error: 'Missing required field: caseId' },
        { status: 400 }
      );
    }

    const result = await routeCaseToAgent(caseId, queueId, algorithm);
    return NextResponse.json({
      success: result.assigned,
      ...result,
    });
  } catch (error: any) {
    console.error('[Agents POST] Error routing case:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to route case' },
      { status: 500 }
    );
  }
}

