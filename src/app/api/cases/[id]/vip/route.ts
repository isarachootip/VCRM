import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const { isVip, vipTier, queuePriority } = body;

  const targetCase = await prisma.case.findFirst({
    where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
  });

  if (!targetCase) {
    return NextResponse.json({ error: `Case ${caseId} not found` }, { status: 404 });
  }

  const priorityVal = queuePriority !== undefined ? Number(queuePriority) : (isVip ? 100 : 0);

  const updatedCase = await prisma.case.update({
    where: { id: targetCase.id },
    data: {
      isVip: Boolean(isVip),
      queuePriority: priorityVal,
      updatedAt: new Date(),
    },
    include: {
      customer: true,
      queue: true,
      owner: true,
    },
  });

  await createAuditLog({
    caseId: targetCase.id,
    actorId: null,
    actorName: 'SYSTEM',
    action: 'CASE_VIP_UPDATED',
    actionType: 'CASE_VIP_UPDATED',
    entityType: 'Case',
    entityId: targetCase.id,
    field: 'isVip',
    oldValue: String(targetCase.isVip),
    newValue: String(isVip),
    details: JSON.stringify({
      isVip,
      vipTier,
      queuePriority: priorityVal,
    }),
  });

  return NextResponse.json({
    success: true,
    case: updatedCase,
  }, { status: 200 });
}
