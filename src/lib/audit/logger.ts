import { prisma } from '@/lib/db';
import { AuditLog } from '@prisma/client';

export interface CreateAuditLogParams {
  caseId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  actionType?: string;
  entityType: string;
  entityId: string;
  details?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

export interface FormattedAuditLog {
  id: string;
  caseId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  actionType: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: string | null;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  ownerId?: string | null;
  queueId?: string | null;
  timestamp: string;
  [key: string]: any;
}

/**
 * Formats an AuditLog record for API responses, populating convenience
 * alias fields (oldStatus, newStatus, ownerId, queueId) and unpacking details JSON.
 */
export function formatAuditLog(log: any): FormattedAuditLog {
  let parsedDetails: Record<string, any> = {};
  if (log.details) {
    try {
      parsedDetails = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    } catch {
      // Plain text or non-json details
    }
  }

  const action = log.action || log.actionType || 'AUDIT_RECORD';
  const actionType = log.actionType || log.action || action;

  // Extract old/new status
  let oldStatus = log.field === 'status' ? log.oldValue : (parsedDetails.oldStatus ?? null);
  let newStatus = log.field === 'status' ? log.newValue : (parsedDetails.newStatus ?? null);

  // Extract ownerId
  let ownerId = log.field === 'ownerId'
    ? log.newValue
    : (parsedDetails.ownerId ?? (action === 'OWNER_ASSIGNED' ? (log.newValue || log.actorId) : null));

  // Extract queueId
  let queueId = log.field === 'queueId'
    ? log.newValue
    : (parsedDetails.queueId ?? (action === 'QUEUE_TRANSFERRED' ? log.newValue : null));

  const timestampStr = log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp);

  return {
    id: log.id || `audit_${Date.now()}`,
    caseId: log.caseId ?? null,
    actorId: log.actorId ?? null,
    actorName: log.actorName ?? null,
    action,
    actionType,
    entityType: log.entityType ?? 'Case',
    entityId: log.entityId ?? log.caseId ?? null,
    details: log.details ?? null,
    field: log.field ?? null,
    oldValue: log.oldValue ?? null,
    newValue: log.newValue ?? null,
    oldStatus,
    newStatus,
    ownerId,
    queueId,
    timestamp: timestampStr,
    ...parsedDetails,
  };
}

/**
 * Persists an immutable audit record using Prisma client.
 * Handles foreign key validation for actorId and caseId gracefully.
 */
export async function createAuditLog(data: CreateAuditLogParams): Promise<AuditLog> {
  let validCaseId: string | null = null;
  if (data.caseId) {
    try {
      const existingCase = await prisma.case.findUnique({
        where: { id: data.caseId },
        select: { id: true },
      });
      if (existingCase) {
        validCaseId = existingCase.id;
      }
    } catch {
      validCaseId = null;
    }
  }

  let validActorId: string | null = null;
  let resolvedActorName: string = data.actorName || 'SYSTEM';

  if (data.actorId) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { id: data.actorId },
        select: { id: true, name: true },
      });
      if (existingUser) {
        validActorId = existingUser.id;
        if (!data.actorName) {
          resolvedActorName = existingUser.name;
        }
      } else {
        // User not in DB (e.g. virtual ID or customer); store actor name without breaking FK
        if (!data.actorName) {
          resolvedActorName = data.actorId;
        }
      }
    } catch {
      validActorId = null;
    }
  }

  // Preserve extra metadata in details if details not already JSON
  let finalDetails = data.details;
  if (!finalDetails && (data.oldValue || data.newValue)) {
    finalDetails = JSON.stringify({
      field: data.field,
      oldValue: data.oldValue,
      newValue: data.newValue,
      originalCaseId: data.caseId,
      originalActorId: data.actorId,
    });
  }

  const log = await prisma.auditLog.create({
    data: {
      caseId: validCaseId,
      actorId: validActorId,
      actorName: resolvedActorName,
      action: data.action,
      actionType: data.actionType || data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      details: finalDetails,
      field: data.field,
      oldValue: data.oldValue,
      newValue: data.newValue,
    },
  });

  return log;
}

/**
 * Fetches all audit logs for a case, ordered by timestamp descending.
 */
export async function getAuditLogsForCase(caseId: string): Promise<FormattedAuditLog[]> {
  const logs = await prisma.auditLog.findMany({
    where: { caseId },
    orderBy: { timestamp: 'desc' },
  });

  return logs.map(formatAuditLog);
}
