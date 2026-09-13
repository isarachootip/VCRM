import { NextRequest, NextResponse } from 'next/server';
import { getCaseById, assignCase, parsePriority, parseBusinessUnit, CaseStatus } from '@/lib/cases/service';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit/logger';
import { getUserRole, redactCaseFields, isEorPrivilegedRole } from '@/lib/audit/redactor';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = params.id;
    const targetCase = await getCaseById(caseId);

    if (!targetCase) {
      return NextResponse.json(
        { error: `Case ${caseId} not found` },
        { status: 404 }
      );
    }

    const role = getUserRole(request);
    const redactedCase = redactCaseFields(targetCase, role, targetCase.queue?.team);

    // Return both top-level and .case for maximum interoperability
    return NextResponse.json({
      ...redactedCase,
      case: redactedCase,
    });
  } catch (error: any) {
    console.error('Error fetching case detail:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch case detail' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = params.id;
    const data = await request.json().catch(() => ({}));

    // Check if case exists first
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

    const role = getUserRole(request);

    // EOR RBAC guard: Non-EOR frontline agents cannot mutate EOR fields
    const hasEorFields =
      data.eorTicketNumber !== undefined ||
      data.sellingStoreName !== undefined ||
      data.sellingStoreStaffId !== undefined ||
      data.eorMetadata !== undefined;

    if (hasEorFields && !isEorPrivilegedRole(role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          code: 'PERMISSION_DENIED',
          message: 'Field is restricted to EOR staff and supervisors.',
        },
        { status: 403 }
      );
    }

    // Handle assignments / transfers / priority updates
    const hasAssignOrPriority =
      data.ownerId !== undefined ||
      data.queueId !== undefined ||
      data.priority !== undefined ||
      data.businessUnit !== undefined;

    const eorAndSlaUpdates: any = {};
    if (data.eorTicketNumber !== undefined) eorAndSlaUpdates.eorTicketNumber = data.eorTicketNumber;
    if (data.sellingStoreName !== undefined) eorAndSlaUpdates.sellingStoreName = data.sellingStoreName;
    if (data.sellingStoreStaffId !== undefined) eorAndSlaUpdates.sellingStoreStaffId = data.sellingStoreStaffId;
    if (data.eorMetadata !== undefined) eorAndSlaUpdates.eorMetadata = data.eorMetadata;
    if (data.lastCustomerMessageAt !== undefined) eorAndSlaUpdates.lastCustomerMessageAt = data.lastCustomerMessageAt ? new Date(data.lastCustomerMessageAt) : null;
    if (data.lastAgentMessageAt !== undefined) eorAndSlaUpdates.lastAgentMessageAt = data.lastAgentMessageAt ? new Date(data.lastAgentMessageAt) : null;
    if (data.slaPendingFlag !== undefined) eorAndSlaUpdates.slaPendingFlag = data.slaPendingFlag;
    if (data.slaBreachedAt !== undefined) eorAndSlaUpdates.slaBreachedAt = data.slaBreachedAt ? new Date(data.slaBreachedAt) : null;

    if (hasAssignOrPriority) {
      const result = await assignCase(existingCase.id, {
        ownerId: data.ownerId,
        queueId: data.queueId,
        priority: data.priority,
        businessUnit: data.businessUnit,
        actorId: data.actorId,
        actorName: data.actorName,
      });

      // Also check if other scalar fields need updating (title, resolutionNotes, etc.)
      const otherUpdates: any = { ...eorAndSlaUpdates };
      if (data.title !== undefined) otherUpdates.title = data.title;
      if (data.resolutionCategory !== undefined) otherUpdates.resolutionCategory = data.resolutionCategory;
      if (data.resolutionNotes !== undefined) otherUpdates.resolutionNotes = data.resolutionNotes;

      if (Object.keys(otherUpdates).length > 0) {
        await prisma.case.update({
          where: { id: existingCase.id },
          data: otherUpdates,
        });
        const finalCase = await getCaseById(existingCase.id);
        const redacted = redactCaseFields(finalCase, role, finalCase?.queue?.team);
        return NextResponse.json({ success: true, case: redacted });
      }

      const redacted = redactCaseFields(result.case, role, result.case?.queue?.team);
      return NextResponse.json({
        success: true,
        case: redacted,
      });
    }

    // General updates
    const updateData: any = { updatedAt: new Date(), ...eorAndSlaUpdates };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.resolutionCategory !== undefined) updateData.resolutionCategory = data.resolutionCategory;
    if (data.resolutionNotes !== undefined) updateData.resolutionNotes = data.resolutionNotes;

    await prisma.case.update({
      where: { id: existingCase.id },
      data: updateData,
    });

    const updatedCase = await getCaseById(existingCase.id);
    const redacted = redactCaseFields(updatedCase, role, updatedCase?.queue?.team);
    return NextResponse.json({
      success: true,
      case: redacted,
    });
  } catch (error: any) {
    console.error('Error updating case:', error);
    const status = error.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to update case' },
      { status }
    );
  }
}
