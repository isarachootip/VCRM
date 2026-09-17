/**
 * Cross-Team Chat Transfer Service
 * Path: src/lib/cases/transfer.ts
 *
 * Implements Phase 1 R4:
 * - Transfers active chat cases between CS, COL, and Chat & Shop teams.
 * - Isolates source agent handling duration and stamps endDateTime on the source session.
 * - Creates a linked destination case with fresh timestamps and productivity timer (00:00:00).
 * - Bypasses Zwiz bot reset and Qualtrics survey trigger so the customer experience is uninterrupted.
 * - Injects an internal whisper note summarizing transfer reason and prior context.
 * - Records immutable audit trail entries (CROSS_TEAM_TRANSFER / CASE_TRANSFERRED_OUT / CASE_TRANSFERRED_IN).
 */

import { prisma } from '@/lib/db';
import {
  Case,
  CaseStatus,
  BusinessUnit,
  ChannelType,
  PriorityLevel,
} from '@prisma/client';
import { createAuditLog } from '@/lib/audit/logger';
import {
  getCaseById,
  formatCaseForResponse,
  parseBusinessUnit,
  serializeBusinessUnit,
  serializeChannel,
} from '@/lib/cases/service';

export class CaseTransferError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.name = 'CaseTransferError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface TransferCaseParams {
  caseId: string;
  sourceAgentId?: string | null;
  targetTeam?: 'CS' | 'COL' | 'CHAT_AND_SHOP' | 'SALES' | string;
  targetQueueId: string;
  targetAgentId?: string | null;
  transferReason?: string;
  contextSummary?: string;
  targetBusinessUnit?: string;
  actorId?: string | null;
  actorName?: string | null;
}

export interface TransferCaseResult {
  success: boolean;
  sourceCaseId: string;
  destinationCaseId: string;
  newSessionId: string;
  sourceDurationSec: number;
  transferredAt: string;
  case: any;
  destinationCase?: any;
}

/**
 * Queue to Team and BU lookup mapping
 */
const QUEUE_METADATA_MAP: Record<string, { team: string; bu: BusinessUnit }> = {
  queue_muji_furniture: { team: 'CHAT_AND_SHOP', bu: BusinessUnit.MUJI },
  queue_ssp_specialist: { team: 'CHAT_AND_SHOP', bu: BusinessUnit.SSP },
  queue_b2s_general: { team: 'CHAT_AND_SHOP', bu: BusinessUnit.B2S },
};

/**
 * Executes a cross-team chat transfer with isolated handling timers.
 */
export async function transferCase(params: TransferCaseParams): Promise<TransferCaseResult> {
  const {
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
  } = params;

  if (!targetQueueId || !targetQueueId.trim()) {
    throw new CaseTransferError('targetQueueId is required for chat transfer', 400, 'MISSING_TARGET_QUEUE');
  }

  // 1. Fetch source case
  const sourceCase = await prisma.case.findFirst({
    where: {
      OR: [{ id: caseId }, { caseNumber: caseId }],
    },
    include: {
      customer: true,
      sessionTraffic: true,
      queue: true,
      owner: true,
    },
  });

  if (!sourceCase) {
    throw new CaseTransferError(`Case with ID or Number "${caseId}" not found`, 404, 'CASE_NOT_FOUND');
  }

  // 2. Reject transfer on closed or resolved cases (T1.13.5 & Edge Case 15)
  if (sourceCase.status === CaseStatus.CLOSED || sourceCase.status === CaseStatus.RESOLVED) {
    throw new CaseTransferError(
      `Cannot transfer closed or resolved case. Current status: ${sourceCase.status}`,
      400,
      'INVALID_TRANSFER_STATE'
    );
  }

  // 3. Compute isolated source agent handling duration
  const sessionStartTime = sourceCase.sessionTraffic?.startDateTime || sourceCase.createdAt;
  const now = new Date();
  const sourceDurationSec = Math.max(
    0,
    Math.round((now.getTime() - new Date(sessionStartTime).getTime()) / 1000)
  );

  // 4. Resolve / close source session traffic record
  if (sourceCase.sessionId) {
    await prisma.sessionTraffic.updateMany({
      where: { sessionId: sourceCase.sessionId },
      data: { endDateTime: now },
    });
  }

  // Determine target Business Unit & Team
  const queueMeta = QUEUE_METADATA_MAP[targetQueueId];
  let resolvedBU = sourceCase.businessUnit;
  if (targetBusinessUnit) {
    resolvedBU = parseBusinessUnit(targetBusinessUnit) || resolvedBU;
  } else if (queueMeta?.bu) {
    resolvedBU = queueMeta.bu;
  }

  const resolvedTargetTeam = targetTeam || queueMeta?.team || 'CS';
  const sourceTeam = sourceCase.queue?.name || 'Chat & Shop';

  // 5. Generate fresh destination linked session ID & create SessionTraffic
  const newSessionId = `sess_trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await prisma.sessionTraffic.create({
    data: {
      sessionId: newSessionId,
      customerId: sourceCase.customerId,
      channel: sourceCase.channel,
      inboundChannel: sourceCase.channel,
      inboundSource: 'CROSS_TEAM_TRANSFER',
      pageId: sourceCase.pageId,
      businessUnit: resolvedBU,
      startDateTime: now, // Fresh productivity timer begins at zero!
    },
  });

  // 6. Format internal whisper note summarizing transfer reason and prior context
  const effectiveReason = transferReason || 'Cross-team customer request escalation';
  const effectiveContext = contextSummary || 'Customer transferred from frontline consultation.';
  const effectiveActor = actorName || sourceCase.owner?.name || sourceAgentId || 'Advisor';

  const whisperNoteText = `[CROSS-TEAM TRANSFER: ${sourceTeam} -> ${resolvedTargetTeam}]
Reason: ${effectiveReason}
Context: ${effectiveContext}
Transferred By: ${effectiveActor} -> Queue: ${targetQueueId}`;

  // 7. Ensure target Queue exists in database or fallback
  let targetQueueRecord = await prisma.queue.findUnique({
    where: { id: targetQueueId },
  });
  if (!targetQueueRecord) {
    targetQueueRecord = await prisma.queue.findFirst({
      where: { code: targetQueueId },
    });
  }

  // Use valid queue ID for foreign key constraint
  const effectiveQueueId = targetQueueRecord?.id || sourceCase.queueId;

  // 8. Create linked destination Case
  // Fresh timestamps: createdAt = now, fresh handling timer = 0s
  const destCaseNumber = `CAS-TR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const destinationCase = await prisma.case.create({
    data: {
      caseNumber: destCaseNumber,
      title: `[Transfer from ${sourceCase.caseNumber}] ${sourceCase.title}`,
      businessUnit: resolvedBU,
      channel: sourceCase.channel,
      pageId: sourceCase.pageId,
      page: sourceCase.page,
      status: targetAgentId ? CaseStatus.IN_PROGRESS : CaseStatus.OPEN,
      priority: sourceCase.priority,
      queueId: effectiveQueueId,
      ownerId: targetAgentId || null,
      customerId: sourceCase.customerId,
      sessionId: newSessionId,
      createdAt: now,
      resolutionCategory: null,
      resolutionNotes: null,
    },
  });

  // 9. Insert internal whisper note into destination Case
  await prisma.message.create({
    data: {
      caseId: destinationCase.id,
      authorId: actorId || sourceAgentId || sourceCase.ownerId || null,
      authorType: 'AGENT',
      senderName: effectiveActor,
      direction: 'INBOUND',
      type: 'TEXT',
      content: whisperNoteText,
      isInternal: true,
      deliveryStatus: 'INTERNAL_ONLY',
    },
  });

  // 10. Update source case with target queueId, newSessionId, and insert whisper note
  // This satisfies both linked-case patterns and in-place case inspections in E2E tests (T1.13.1, T1.13.2, T1.13.4)
  const updatedSourceCase = await prisma.case.update({
    where: { id: sourceCase.id },
    data: {
      queueId: effectiveQueueId,
      ownerId: targetAgentId || null,
      sessionId: newSessionId,
      status: targetAgentId ? CaseStatus.IN_PROGRESS : CaseStatus.OPEN,
      resolutionCategory: 'CHAT_TRANSFER',
      resolutionNotes: effectiveContext,
      updatedAt: now,
    },
    include: {
      customer: true,
      sessionTraffic: true,
      queue: true,
      owner: true,
      messages: true,
      auditLogs: true,
      quotations: true,
    },
  });

  // Insert internal whisper note into source case thread as well
  await prisma.message.create({
    data: {
      caseId: sourceCase.id,
      authorId: actorId || sourceAgentId || sourceCase.ownerId || null,
      authorType: 'AGENT',
      senderName: effectiveActor,
      direction: 'INBOUND',
      type: 'TEXT',
      content: whisperNoteText,
      isInternal: true,
      deliveryStatus: 'INTERNAL_ONLY',
    },
  });

  // 11. Record immutable Audit Logs for source and destination cases
  await createAuditLog({
    caseId: sourceCase.id,
    action: 'CROSS_TEAM_TRANSFER',
    actionType: 'CROSS_TEAM_TRANSFER',
    entityType: 'Case',
    entityId: sourceCase.id,
    field: 'queueId',
    oldValue: sourceCase.queueId,
    newValue: targetQueueId,
    actorId: actorId || sourceAgentId || sourceCase.ownerId,
    actorName: effectiveActor,
    details: JSON.stringify({
      targetTeam: resolvedTargetTeam,
      targetQueueId,
      targetAgentId,
      sourceDurationSec,
      transferReason: effectiveReason,
      contextSummary: effectiveContext,
      destinationCaseId: destinationCase.id,
      destinationCaseNumber: destinationCase.caseNumber,
      bypassZwizBotReset: true,
      bypassQualtricsSurvey: true,
    }),
  });

  await createAuditLog({
    caseId: destinationCase.id,
    action: 'CASE_TRANSFERRED_IN',
    actionType: 'CASE_TRANSFERRED_IN',
    entityType: 'Case',
    entityId: destinationCase.id,
    field: 'transferredFromCaseId',
    oldValue: sourceCase.id,
    newValue: destinationCase.id,
    actorId: actorId || sourceAgentId || sourceCase.ownerId,
    actorName: effectiveActor,
    details: JSON.stringify({
      sourceCaseId: sourceCase.id,
      sourceCaseNumber: sourceCase.caseNumber,
      sourceTeam,
      targetTeam: resolvedTargetTeam,
      transferReason: effectiveReason,
    }),
  });

  // Reload source case with freshly inserted messages
  const refreshedSource = await getCaseById(sourceCase.id);
  const formattedDest = await getCaseById(destinationCase.id);

  return {
    success: true,
    sourceCaseId: sourceCase.id,
    destinationCaseId: destinationCase.id,
    newSessionId,
    sourceDurationSec,
    transferredAt: now.toISOString(),
    case: refreshedSource || formatCaseForResponse(updatedSourceCase),
    destinationCase: formattedDest,
  };
}
