import { NextRequest, NextResponse } from 'next/server';
import { assignCase, getCaseById, CaseStatus } from '@/lib/cases/service';
import { prisma } from '@/lib/db';

async function handleCaseAssignment(
  request: NextRequest,
  params: { id: string }
) {
  try {
    const caseId = params.id;
    const body = await request.json().catch(() => ({}));

    if (
      body.ownerId === undefined &&
      body.queueId === undefined &&
      body.priority === undefined &&
      body.businessUnit === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one field (ownerId, queueId, priority, businessUnit) is required to assign or transfer' },
        { status: 400 }
      );
    }

    // Check if target case exists
    const existingCase = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
    });

    if (!existingCase) {
      return NextResponse.json(
        { error: `Case ${caseId} not found` },
        { status: 404 }
      );
    }

    // Strict terminal lock on CLOSED cases (Tier 5 Remediation)
    if (existingCase.status === CaseStatus.CLOSED || String(existingCase.status).toUpperCase() === 'CLOSED') {
      return NextResponse.json(
        { error: 'Cannot modify or assign a closed case' },
        { status: 400 }
      );
    }

    // Validate owner exists if ownerId provided
    if (body.ownerId !== undefined && body.ownerId !== null && body.ownerId !== '') {
      const owner = await prisma.user.findFirst({
        where: {
          OR: [{ id: body.ownerId }, { email: body.ownerId }, { name: body.ownerId }],
        },
      });

      if (!owner) {
        return NextResponse.json(
          { error: `User ${body.ownerId} not found` },
          { status: 404 }
        );
      }
      body.ownerId = owner.id;
    }

    // Validate queue exists if queueId provided
    if (body.queueId !== undefined && body.queueId !== null && body.queueId !== '') {
      const queue = await prisma.queue.findFirst({
        where: {
          OR: [{ id: body.queueId }, { code: body.queueId }],
        },
      });

      if (!queue) {
        return NextResponse.json(
          { error: `Queue ${body.queueId} not found` },
          { status: 404 }
        );
      }
      body.queueId = queue.id;
    }

    const result = await assignCase(existingCase.id, {
      ownerId: body.ownerId,
      queueId: body.queueId,
      priority: body.priority,
      businessUnit: body.businessUnit,
      actorId: body.actorId,
      actorName: body.actorName,
    });

    return NextResponse.json({
      success: true,
      case: result.case,
    });
  } catch (error: any) {
    console.error('Error assigning case:', error);
    const msg = error.message || 'Assignment failed';
    const isNotFound = msg.includes('not found');
    return NextResponse.json(
      { error: msg },
      { status: isNotFound ? 404 : 400 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleCaseAssignment(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleCaseAssignment(request, params);
}
