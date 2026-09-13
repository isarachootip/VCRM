/**
 * Case SLA & Inactivity Monitoring Engine
 * Path: src/lib/cases/sla.ts
 *
 * Implements Phase 2 R2 (Milestone M14):
 * - Customer inactivity monitoring (15m and 30m pending flags)
 * - Agent response waiting time alerts against configurable queue SLA
 * - Batch sweeping and real-time evaluation
 */

import { prisma } from '@/lib/db';
import { SlaPendingFlag } from '@prisma/client';

export { SlaPendingFlag };

export interface InactivityResult {
  pendingFlag: SlaPendingFlag;
  elapsedMinutes: number;
}

export interface AgentResponseWaitResult {
  isBreached: boolean;
  elapsedMinutes: number;
  slaBreachedAt: Date | null;
  alertType?: string;
}

export interface CaseSlaEvaluationResult {
  pendingFlag: SlaPendingFlag;
  inactivityMinutes: number;
  isBreached: boolean;
  responseWaitMinutes: number;
  slaBreachedAt: Date | null;
  alertType?: string;
}

/**
 * Evaluates customer inactivity:
 * Calculates elapsed time since lastCustomerMessageAt.
 * - If >= 30 min -> PENDING_30M
 * - If >= 15 min -> PENDING_15M
 * - Otherwise -> NONE
 */
export function evaluateCaseInactivity(
  caseData: {
    lastCustomerMessageAt?: Date | string | null;
    status?: string | null;
  },
  now: Date = new Date()
): InactivityResult {
  if (!caseData.lastCustomerMessageAt) {
    return { pendingFlag: SlaPendingFlag.NONE, elapsedMinutes: 0 };
  }

  // Terminal or resolved cases do not accumulate pending flags
  const statusStr = String(caseData.status || '').toUpperCase();
  if (statusStr === 'CLOSED' || statusStr === 'RESOLVED') {
    return { pendingFlag: SlaPendingFlag.NONE, elapsedMinutes: 0 };
  }

  const lastCustomerMs = new Date(caseData.lastCustomerMessageAt).getTime();
  if (isNaN(lastCustomerMs)) {
    return { pendingFlag: SlaPendingFlag.NONE, elapsedMinutes: 0 };
  }

  const elapsedMs = Math.max(0, now.getTime() - lastCustomerMs);
  const elapsedMinutes = elapsedMs / (60 * 1000);

  if (elapsedMinutes >= 30) {
    return { pendingFlag: SlaPendingFlag.PENDING_30M, elapsedMinutes };
  }
  if (elapsedMinutes >= 15) {
    return { pendingFlag: SlaPendingFlag.PENDING_15M, elapsedMinutes };
  }

  return { pendingFlag: SlaPendingFlag.NONE, elapsedMinutes };
}

/**
 * Evaluates agent response wait time:
 * Calculates elapsed time from customer inbound message to agent reply.
 * If elapsed > slaResponseMin, flags slaBreachedAt = now().
 */
export function evaluateAgentResponseWait(
  caseData: {
    lastCustomerMessageAt?: Date | string | null;
    lastAgentMessageAt?: Date | string | null;
    slaResponseMin?: number;
    status?: string | null;
    isVip?: boolean;
  },
  now: Date = new Date()
): AgentResponseWaitResult {
  if (!caseData.lastCustomerMessageAt) {
    return { isBreached: false, elapsedMinutes: 0, slaBreachedAt: null };
  }

  const statusStr = String(caseData.status || '').toUpperCase();
  if (statusStr === 'CLOSED' || statusStr === 'RESOLVED') {
    return { isBreached: false, elapsedMinutes: 0, slaBreachedAt: null };
  }

  const customerInboundMs = new Date(caseData.lastCustomerMessageAt).getTime();
  if (isNaN(customerInboundMs)) {
    return { isBreached: false, elapsedMinutes: 0, slaBreachedAt: null };
  }

  // Accelerated 5-minute threshold for NSC VIP cases vs standard 15m
  const defaultMin = caseData.slaResponseMin && caseData.slaResponseMin > 0 ? caseData.slaResponseMin : 15;
  const thresholdMin = caseData.isVip ? 5 : defaultMin;
  const thresholdMs = thresholdMin * 60 * 1000;

  const agentReplyMs = caseData.lastAgentMessageAt ? new Date(caseData.lastAgentMessageAt).getTime() : null;

  // If agent has already replied to this inbound message
  if (agentReplyMs && !isNaN(agentReplyMs) && agentReplyMs >= customerInboundMs) {
    const elapsedMs = agentReplyMs - customerInboundMs;
    const elapsedMinutes = elapsedMs / (60 * 1000);
    const isBreached = elapsedMinutes > thresholdMin;
    return {
      isBreached,
      elapsedMinutes,
      slaBreachedAt: isBreached ? new Date(customerInboundMs + thresholdMs) : null,
      alertType: isBreached ? (caseData.isVip ? 'VIP_SLA_RESPONSE_BREACH' : 'SLA_RESPONSE_WAIT_BREACH') : undefined,
    };
  }

  // Agent has not yet replied to the inbound customer message
  const elapsedMs = Math.max(0, now.getTime() - customerInboundMs);
  const elapsedMinutes = elapsedMs / (60 * 1000);

  if (elapsedMinutes > thresholdMin) {
    return {
      isBreached: true,
      elapsedMinutes,
      slaBreachedAt: now,
      alertType: caseData.isVip ? 'VIP_SLA_RESPONSE_BREACH' : 'SLA_RESPONSE_WAIT_BREACH',
    };
  }

  return {
    isBreached: false,
    elapsedMinutes,
    slaBreachedAt: null,
  };
}

/**
 * Composite evaluation combining customer inactivity and agent response wait
 */
export function evaluateCaseSla(
  caseData: {
    lastCustomerMessageAt?: Date | string | null;
    lastAgentMessageAt?: Date | string | null;
    status?: string | null;
    isVip?: boolean;
    queue?: { slaResponseMin?: number } | null;
  },
  slaResponseMin: number = 15,
  now: Date = new Date()
): CaseSlaEvaluationResult {
  const queueSlaMin = caseData.isVip ? 5 : (caseData.queue?.slaResponseMin ?? slaResponseMin);

  const inactivity = evaluateCaseInactivity(caseData, now);
  const responseWait = evaluateAgentResponseWait(
    {
      ...caseData,
      slaResponseMin: queueSlaMin,
    },
    now
  );

  return {
    pendingFlag: inactivity.pendingFlag,
    inactivityMinutes: inactivity.elapsedMinutes,
    isBreached: responseWait.isBreached,
    responseWaitMinutes: responseWait.elapsedMinutes,
    slaBreachedAt: responseWait.slaBreachedAt,
    alertType: responseWait.alertType,
  };
}

/**
 * Evaluates and persists SLA state changes for a given Case
 */
export async function checkAndUpdateCaseSla(
  caseId: string,
  now: Date = new Date()
): Promise<any> {
  const targetCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { queue: true },
  });

  if (!targetCase) return null;

  const evalResult = evaluateCaseSla(targetCase, targetCase.queue?.slaResponseMin || 15, now);

  const updates: any = {};
  if (targetCase.slaPendingFlag !== evalResult.pendingFlag) {
    updates.slaPendingFlag = evalResult.pendingFlag;
  }
  if (evalResult.isBreached && !targetCase.slaBreachedAt) {
    updates.slaBreachedAt = evalResult.slaBreachedAt || now;
  } else if (!evalResult.isBreached && targetCase.slaBreachedAt && targetCase.lastAgentMessageAt && targetCase.lastCustomerMessageAt && new Date(targetCase.lastAgentMessageAt) >= new Date(targetCase.lastCustomerMessageAt)) {
    // If agent replied in time on subsequent check, reset breach
    updates.slaBreachedAt = null;
  }

  if (Object.keys(updates).length > 0) {
    return prisma.case.update({
      where: { id: caseId },
      data: updates,
    });
  }

  return targetCase;
}

/**
 * Sweeps all active cases to update inactivity flags and SLA breach alerts
 */
export async function sweepCasesSla(now: Date = new Date()): Promise<{
  checked: number;
  updated: number;
  breaches: number;
}> {
  const activeCases = await prisma.case.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      lastCustomerMessageAt: { not: null },
    },
    include: { queue: true },
  });

  let updated = 0;
  let breaches = 0;

  for (const c of activeCases) {
    const evalResult = evaluateCaseSla(c, c.queue?.slaResponseMin || 15, now);
    const updates: any = {};

    if (c.slaPendingFlag !== evalResult.pendingFlag) {
      updates.slaPendingFlag = evalResult.pendingFlag;
    }
    if (evalResult.isBreached && !c.slaBreachedAt) {
      updates.slaBreachedAt = evalResult.slaBreachedAt || now;
      breaches++;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.case.update({
        where: { id: c.id },
        data: updates,
      });
      updated++;
    }
  }

  return {
    checked: activeCases.length,
    updated,
    breaches,
  };
}
