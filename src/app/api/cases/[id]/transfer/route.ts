/**
 * API Route: POST /api/cases/[id]/transfer
 * Path: src/app/api/cases/[id]/transfer/route.ts
 *
 * Implements Cross-Team Chat Transfer between CS, COL, and Chat & Shop.
 */

import { NextRequest, NextResponse } from 'next/server';
import { transferCase, CaseTransferError } from '@/lib/cases/transfer';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = params.id;
    const body = await request.json().catch(() => ({}));

    // Extract transfer parameters
    const sourceAgentId = body.sourceAgentId;
    const targetTeam = body.targetTeam;
    const targetQueueId = body.targetQueueId || body.queueId;
    const targetAgentId = body.targetAgentId || body.ownerId;
    const transferReason = body.transferReason;
    const contextSummary = body.contextSummary;
    const targetBusinessUnit = body.targetBusinessUnit || body.businessUnit;
    const actorId = body.actorId || sourceAgentId;
    const actorName = body.actorName;

    if (!targetQueueId) {
      return NextResponse.json(
        { error: 'Target queue ID (targetQueueId) is required for case transfer' },
        { status: 400 }
      );
    }

    const result = await transferCase({
      caseId,
      sourceAgentId,
      targetTeam,
      targetQueueId,
      targetAgentId,
      transferReason,
      contextSummary,
      targetBusinessUnit,
      actorId,
      actorName,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error executing case transfer:', error);

    if (error instanceof CaseTransferError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    const is404 = error.message && (error.message.includes('not found') || error.message.includes('404'));
    const is400 = error.message && (
      error.message.includes('closed') ||
      error.message.includes('resolved') ||
      error.message.includes('Invalid')
    );

    const status = is404 ? 404 : (is400 ? 400 : 500);

    return NextResponse.json(
      { error: error.message || 'Internal error during case transfer' },
      { status }
    );
  }
}
