/**
 * Automated Idle Chat Auto-Close & Pre-Closure Warning Engine
 * Path: src/lib/cases/idle-sweep.ts
 *
 * Implements R1 (Milestone M2 / Item 18):
 * - Scans active/in-progress customer chat cases.
 * - Inactivity calculation from lastCustomerMessageAt (or updatedAt / createdAt).
 * - Pre-closure warning: Exactly one notification via Zwiz 10m before closure (default 50m).
 * - Auto-closure: After 60m of inactivity, auto-close with CUSTOMER_INACTIVE_AUTO_CLOSED,
 *   reset Zwiz user bot state to ACTIVE, trigger Qualtrics CSAT survey, and release agent capacity.
 * - Dry-run evaluation mode.
 */

import { prisma } from '@/lib/db';
import { zwizClient } from '@/lib/zwiz/client';
import { qualtricsClient } from '@/lib/qualtrics/client';
import { createAuditLog } from '@/lib/audit/logger';
import { releaseCaseFromAgent } from '@/lib/agents/queue-routing';

export interface IdleSweepOptions {
  idleWarningThresholdMinutes?: number; // default: 50
  idleCloseThresholdMinutes?: number;   // default: 60
  simulatedElapsedMinutes?: number | null;
  dryRun?: boolean;
  now?: Date;
}

export interface DryRunCandidate {
  caseId: string;
  caseNumber: string;
  elapsedMinutes: number;
  action: 'WARN' | 'CLOSE';
  customerId: string;
  senderId?: string | null;
}

export interface IdleSweepResult {
  success: boolean;
  scanned: number;
  warned: number;
  closed: number;
  caseIdsWarned: string[];
  caseIdsClosed: string[];
  dryRunCandidates?: DryRunCandidate[];
}

/**
 * Validates sweep threshold parameters.
 * Throws an Error with statusCode 400 if invalid.
 */
export function validateSweepThresholds(
  warnMin: number,
  closeMin: number
): void {
  if (typeof warnMin !== 'number' || isNaN(warnMin) || warnMin <= 0) {
    throw new Error('idleWarningThresholdMinutes must be a positive number');
  }
  if (typeof closeMin !== 'number' || isNaN(closeMin) || closeMin <= 0) {
    throw new Error('idleCloseThresholdMinutes must be a positive number');
  }
  if (warnMin >= closeMin) {
    throw new Error('idleWarningThresholdMinutes must be strictly less than idleCloseThresholdMinutes');
  }
}

/**
 * Core engine for sweeping idle chats across all queues and business units.
 */
export async function sweepIdleChats(options: IdleSweepOptions = {}): Promise<IdleSweepResult> {
  const warnThreshold = options.idleWarningThresholdMinutes !== undefined
    ? Number(options.idleWarningThresholdMinutes)
    : 50;
  const closeThreshold = options.idleCloseThresholdMinutes !== undefined
    ? Number(options.idleCloseThresholdMinutes)
    : 60;
  const dryRun = Boolean(options.dryRun);
  const now = options.now || new Date();

  // Validate threshold boundary constraints
  validateSweepThresholds(warnThreshold, closeThreshold);

  // Filter isolation: only scan OPEN and IN_PROGRESS cases (ignore RESOLVED, CLOSED)
  const activeCases = await prisma.case.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    include: {
      customer: true,
      sessionTraffic: true,
      queue: true,
      owner: true,
    },
  });

  const caseIdsWarned: string[] = [];
  const caseIdsClosed: string[] = [];
  const dryRunCandidates: DryRunCandidate[] = [];

  for (const caseRec of activeCases) {
    // Determine inactivity duration
    let elapsedMinutes: number;
    if (options.simulatedElapsedMinutes !== undefined && options.simulatedElapsedMinutes !== null) {
      elapsedMinutes = Number(options.simulatedElapsedMinutes);
    } else {
      const lastActivityTime = caseRec.lastCustomerMessageAt || caseRec.updatedAt || caseRec.createdAt;
      const elapsedMs = Math.max(0, now.getTime() - new Date(lastActivityTime).getTime());
      elapsedMinutes = elapsedMs / (60 * 1000);
    }

    const recipientId =
      (caseRec.customer as any)?.channelUserId ||
      caseRec.customer?.externalId ||
      caseRec.customer?.lineUserId ||
      null;

    // 1. Auto-Closure Threshold (>= closeThreshold, e.g. 60 min)
    if (elapsedMinutes >= closeThreshold) {
      if (dryRun) {
        dryRunCandidates.push({
          caseId: caseRec.id,
          caseNumber: caseRec.caseNumber,
          elapsedMinutes,
          action: 'CLOSE',
          customerId: caseRec.customerId,
          senderId: recipientId,
        });
        caseIdsClosed.push(caseRec.id);
        continue;
      }

      // Mutate case to CLOSED
      const closedAt = new Date();
      await prisma.case.update({
        where: { id: caseRec.id },
        data: {
          status: 'CLOSED',
          closureReason: 'CUSTOMER_INACTIVE_AUTO_CLOSED',
          closedAt,
          updatedAt: closedAt,
        },
      });

      // Update session traffic endDateTime if linked
      const targetSessionId = caseRec.sessionId || caseRec.sessionTraffic?.sessionId;
      if (targetSessionId) {
        try {
          await prisma.sessionTraffic.update({
            where: { sessionId: targetSessionId },
            data: { endDateTime: closedAt },
          });
        } catch (err: any) {
          console.warn(`[Idle Sweep] Failed to update sessionTraffic for session ${targetSessionId}:`, err.message);
        }
      } else if (caseRec.sessionTraffic?.id) {
        try {
          await prisma.sessionTraffic.update({
            where: { id: caseRec.sessionTraffic.id },
            data: { endDateTime: closedAt },
          });
        } catch (err: any) {
          console.warn(`[Idle Sweep] Failed to update sessionTraffic for id ${caseRec.sessionTraffic.id}:`, err.message);
        }
      }

      // Reset Zwiz bot state to terminate session & reactivate bot
      if (recipientId) {
        try {
          await zwizClient.updateBotState({
            userId: recipientId,
            sessionId: caseRec.sessionId || caseRec.sessionTraffic?.sessionId || `sess_idle_${caseRec.id}`,
            caseId: caseRec.id,
            botState: 'ACTIVE',
            action: 'RESET_TO_MAIN_MENU',
            closedAt: closedAt.toISOString(),
            closureReason: 'CUSTOMER_INACTIVE_AUTO_CLOSED',
          });
        } catch (err: any) {
          console.warn(`[Idle Sweep] Failed to update Zwiz bot state for user ${recipientId}:`, err.message);
        }
      }

      // Trigger Qualtrics CSAT post-chat survey dispatch
      try {
        const buLower = (caseRec.businessUnit || 'central').toLowerCase().replace(/\s+/g, '_');
        const surveyId = `SV_qualtrics_${buLower}`;

        const qualtricsResult = await qualtricsClient.triggerDistribution({
          surveyId,
          caseId: caseRec.id,
          caseNumber: caseRec.caseNumber,
          businessUnit: caseRec.businessUnit,
          queueId: caseRec.queueId,
          channel: caseRec.channel as any,
          recipient: {
            customerId: caseRec.customerId,
            name: caseRec.customer?.displayName || caseRec.customer?.name || 'Customer',
            channelUserId: recipientId || '',
          },
          embeddedData: {
            agentId: caseRec.ownerId || 'unassigned',
            closureTimestamp: closedAt.toISOString(),
            closureReason: 'CUSTOMER_INACTIVE_AUTO_CLOSED',
          },
        });

        await prisma.surveyDispatch.create({
          data: {
            caseId: caseRec.id,
            surveyId,
            distributionId: qualtricsResult?.result?.id || (qualtricsResult as any)?.distributionId || `dist_${Date.now()}`,
            status: 'DISPATCHED',
            dispatchedAt: new Date(),
          },
        });
      } catch (err: any) {
        console.warn(`[Idle Sweep] Failed to dispatch Qualtrics CSAT for case ${caseRec.id}:`, err.message);
      }

      // Release agent active chat capacity
      if (caseRec.ownerId) {
        await releaseCaseFromAgent(caseRec.ownerId, caseRec.id);
      }

      // Record audit log
      await createAuditLog({
        caseId: caseRec.id,
        actorId: null,
        actorName: 'SYSTEM',
        action: 'CASE_AUTO_CLOSED_INACTIVITY',
        actionType: 'CASE_AUTO_CLOSED_INACTIVITY',
        entityType: 'Case',
        entityId: caseRec.id,
        field: 'status',
        oldValue: caseRec.status,
        newValue: 'CLOSED',
        details: JSON.stringify({
          closureReason: 'CUSTOMER_INACTIVE_AUTO_CLOSED',
          elapsedMinutes,
          thresholdMinutes: closeThreshold,
        }),
      });

      caseIdsClosed.push(caseRec.id);
    }
    // 2. Pre-Closure Warning Threshold (>= warnThreshold, < closeThreshold, e.g. 50-59 min)
    // Idempotency: only send if idleWarningSentAt is not yet set
    else if (elapsedMinutes >= warnThreshold && !caseRec.idleWarningSentAt) {
      if (dryRun) {
        dryRunCandidates.push({
          caseId: caseRec.id,
          caseNumber: caseRec.caseNumber,
          elapsedMinutes,
          action: 'WARN',
          customerId: caseRec.customerId,
          senderId: recipientId,
        });
        caseIdsWarned.push(caseRec.id);
        continue;
      }

      // Dispatch exactly one pre-closure warning message to customer via Zwiz
      if (recipientId) {
        try {
          await zwizClient.sendMessage({
            caseId: caseRec.id,
            recipientId,
            channel: caseRec.channel as any,
            pageId: caseRec.pageId,
            message: {
              messageType: 'TEXT',
              content: {
                text: 'เรียนท่านลูกค้า ไม่มีความเคลื่อนไหวในบทสนทนานี้ หากท่านต้องการรับบริการต่อ กรุณาส่งข้อความตอบกลับ ระบบจะทำการปิดเซสชันอัตโนมัติหากไม่มีการตอบสนองภายใน 10 นาที ขอบคุณครับ',
              },
            },
            metadata: {
              agentId: 'system_idle_monitor',
              warningType: 'IDLE_PRE_CLOSURE_WARNING',
              sentAt: new Date().toISOString(),
            },
          });
        } catch (err: any) {
          console.warn(`[Idle Sweep] Failed to dispatch warning message to ${recipientId}:`, err.message);
        }
      }

      // Update case to mark idleWarningSentAt timestamp
      const warnedAt = new Date();
      await prisma.case.update({
        where: { id: caseRec.id },
        data: {
          idleWarningSentAt: warnedAt,
          updatedAt: warnedAt,
        },
      });

      // Record audit log
      await createAuditLog({
        caseId: caseRec.id,
        actorId: null,
        actorName: 'SYSTEM',
        action: 'CASE_IDLE_WARNING_SENT',
        actionType: 'CASE_IDLE_WARNING_SENT',
        entityType: 'Case',
        entityId: caseRec.id,
        field: 'idleWarningSentAt',
        oldValue: null as any,
        newValue: warnedAt.toISOString(),
        details: JSON.stringify({
          elapsedMinutes,
          warningThresholdMinutes: warnThreshold,
        }),
      });

      caseIdsWarned.push(caseRec.id);
    }
  }

  return {
    success: true,
    scanned: activeCases.length,
    warned: caseIdsWarned.length,
    closed: caseIdsClosed.length,
    caseIdsWarned,
    caseIdsClosed,
    ...(dryRun ? { dryRunCandidates } : {}),
  };
}
