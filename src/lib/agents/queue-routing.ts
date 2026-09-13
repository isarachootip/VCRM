/**
 * Team Queue Routing Engine (R5 / Phase 1)
 * Path: src/lib/agents/queue-routing.ts
 *
 * Dispatches inbound cases to the least-loaded ONLINE agent whose
 * activeChatCount is strictly less than their max capacity.
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit/logger';
import { QueueRoutingResult, PresenceStatus } from './types';

export type RoutingAlgorithmType = 'LEAST_ACTIVE' | 'MOST_AVAILABLE';

/**
 * Pure evaluation function to select the optimal agent given a list of available agents
 * and a routing algorithm ('LEAST_ACTIVE' or 'MOST_AVAILABLE').
 */
export function selectBestAgent(
  availableAgents: any[],
  algorithm: RoutingAlgorithmType = 'LEAST_ACTIVE',
  isVipCase: boolean = false
): any | null {
  if (!availableAgents || availableAgents.length === 0) return null;

  // Strict Max Chat capacity enforcement: filter for headroom > 0
  const eligible = availableAgents.filter((agent) => {
    const activeChats = agent.agentProfile?.activeChatCount ?? agent.activeChatCount ?? 0;
    const maxCapacity =
      agent.agentProfile?.maxConcurrentChats ?? agent.maxConcurrentChats ?? agent.maxChatCapacity ?? 5;
    return maxCapacity - activeChats > 0;
  });

  if (eligible.length === 0) {
    return null; // Queue overflow
  }

  // If VIP case: prioritize or restrict to VIP-eligible agents (isVipEligible === true or role in ['SUPERVISOR', 'ADMIN'])
  let candidates = eligible;
  if (isVipCase) {
    const vipEligible = eligible.filter((agent) => {
      const isVip = agent.agentProfile?.isVipEligible ?? agent.isVipEligible ?? false;
      const role = agent.agentProfile?.role || agent.role;
      return Boolean(isVip) || role === 'SUPERVISOR' || role === 'ADMIN';
    });
    if (vipEligible.length > 0) {
      candidates = vipEligible;
    } else {
      return null; // Strict VIP pool isolation when no VIP agents have capacity
    }
  }

  if (algorithm === 'MOST_AVAILABLE') {
    // MOST_AVAILABLE: calculate headroom = maxConcurrentChats - activeChatCount.
    // Filter headroom > 0. Sort by headroom DESC, break ties with activeChatCount ASC.
    candidates.sort((a, b) => {
      const aMax = a.agentProfile?.maxConcurrentChats ?? a.maxConcurrentChats ?? a.maxChatCapacity ?? 5;
      const aChats = a.agentProfile?.activeChatCount ?? a.activeChatCount ?? 0;
      const aHeadroom = aMax - aChats;

      const bMax = b.agentProfile?.maxConcurrentChats ?? b.maxConcurrentChats ?? b.maxChatCapacity ?? 5;
      const bChats = b.agentProfile?.activeChatCount ?? b.activeChatCount ?? 0;
      const bHeadroom = bMax - bChats;

      // 1. Sort by headroom DESC
      if (aHeadroom !== bHeadroom) {
        return bHeadroom - aHeadroom;
      }
      // 2. Break ties with activeChatCount ASC
      if (aChats !== bChats) {
        return aChats - bChats;
      }
      // 3. Break ties with lastAssignedAt ASC
      const aTime = (a.lastAssignedAt || a.agentProfile?.lastAssignedAt || a.updatedAt || new Date(0)).getTime();
      const bTime = (b.lastAssignedAt || b.agentProfile?.lastAssignedAt || b.updatedAt || new Date(0)).getTime();
      return aTime - bTime;
    });
  } else {
    // LEAST_ACTIVE: sort by activeChatCount ASC, break ties with lastAssignedAt ASC.
    candidates.sort((a, b) => {
      const aChats = a.agentProfile?.activeChatCount ?? a.activeChatCount ?? 0;
      const bChats = b.agentProfile?.activeChatCount ?? b.activeChatCount ?? 0;
      if (aChats !== bChats) {
        return aChats - bChats;
      }
      const aTime = (a.lastAssignedAt || a.agentProfile?.lastAssignedAt || a.updatedAt || new Date(0)).getTime();
      const bTime = (b.lastAssignedAt || b.agentProfile?.lastAssignedAt || b.updatedAt || new Date(0)).getTime();
      return aTime - bTime;
    });
  }

  return candidates[0];
}

/**
 * Finds the optimal ONLINE agent in the designated queue based on selected routing algorithm
 * ('LEAST_ACTIVE' vs 'MOST_AVAILABLE').
 */
export async function findBestAgentForQueue(
  queueId: string,
  algorithmOverride?: RoutingAlgorithmType,
  isVipCase: boolean = false
): Promise<any | null> {
  // Fetch queue to determine configured routing algorithm if not specified
  const queue = await prisma.queue.findFirst({
    where: { OR: [{ id: queueId }, { code: queueId }] },
    select: { id: true, routingAlgorithm: true },
  });

  const actualQueueId = queue?.id || queueId;
  const selectedAlgorithm: RoutingAlgorithmType =
    algorithmOverride || (queue?.routingAlgorithm as RoutingAlgorithmType) || 'LEAST_ACTIVE';

  // 1. Fetch queue members with their user and agentProfile data
  const queueMembers = await prisma.queueMember.findMany({
    where: { queueId: actualQueueId },
    include: {
      user: {
        include: {
          agentProfile: true,
        },
      },
    },
  });

  // 2. Filter for ONLINE status
  const onlineAgents = queueMembers
    .map((qm) => qm.user)
    .filter((user) => {
      const presence = user.agentProfile?.presence || user.presence;
      return presence === PresenceStatus.ONLINE;
    });

  return selectBestAgent(onlineAgents, selectedAlgorithm, isVipCase);
}

/**
 * Routes an existing case to the best available agent in the queue
 */
export async function routeCaseToAgent(
  caseId: string,
  targetQueueId?: string,
  algorithmOverride?: RoutingAlgorithmType,
  prioritizeVip?: boolean
): Promise<QueueRoutingResult> {
  const targetCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { queue: true },
  });

  if (!targetCase) {
    throw new Error(`Case with ID ${caseId} not found`);
  }

  const queueId = targetQueueId || targetCase.queueId;
  const isVipCase = Boolean(prioritizeVip || targetCase.isVip);
  const bestAgent = await findBestAgentForQueue(queueId, algorithmOverride, isVipCase);

  if (!bestAgent) {
    // No online agent with capacity available: leave in queue pool with ownerId = null
    await prisma.case.update({
      where: { id: caseId },
      data: {
        queueId,
        ownerId: null,
      },
    });

    return {
      assigned: false,
      caseId,
      queueId,
      agentId: null,
      reason: 'QUEUE_OVERFLOW',
    };
  }

  const now = new Date();

  // Assign case to agent and atomically increment activeChatCount + stamp lastAssignedAt
  await prisma.$transaction([
    prisma.case.update({
      where: { id: caseId },
      data: {
        queueId,
        ownerId: bestAgent.id,
        status: targetCase.status === 'OPEN' ? 'IN_PROGRESS' : targetCase.status,
      },
    }),
    prisma.user.update({
      where: { id: bestAgent.id },
      data: {
        activeChatCount: { increment: 1 },
        lastAssignedAt: now,
      },
    }),
    prisma.agentProfile.upsert({
      where: { userId: bestAgent.id },
      update: {
        activeChatCount: { increment: 1 },
        lastAssignedAt: now,
      },
      create: {
        userId: bestAgent.id,
        presence: PresenceStatus.ONLINE,
        role: bestAgent.role,
        maxConcurrentChats: bestAgent.maxConcurrentChats || 5,
        activeChatCount: (bestAgent.activeChatCount || 0) + 1,
        lastAssignedAt: now,
      },
    }),
  ]);

  // Record audit log
  await createAuditLog({
    caseId,
    actorId: bestAgent.id,
    actorName: bestAgent.name,
    action: 'CASE_ROUTED',
    actionType: 'CASE_ROUTED',
    entityType: 'Case',
    entityId: caseId,
    details: JSON.stringify({
      caseId,
      queueId,
      agentId: bestAgent.id,
      agentName: bestAgent.name,
      assignedAt: now.toISOString(),
    }),
  });

  return {
    assigned: true,
    caseId,
    queueId,
    agentId: bestAgent.id,
    agentName: bestAgent.name,
  };
}

/**
 * Decrements agent active chat workload when a case is closed or unassigned,
 * ensuring activeChatCount is clamped to never go below 0 across User and AgentProfile.
 */
export async function releaseCaseFromAgent(
  agentId: string,
  caseId?: string,
  prismaClient?: any
): Promise<void> {
  const client = prismaClient || prisma;
  try {
    const user = await client.user.findUnique({
      where: { id: agentId },
      select: { activeChatCount: true },
    });

    if (user) {
      const nextCount = Math.max(0, (user.activeChatCount || 0) - 1);
      await client.user.update({
        where: { id: agentId },
        data: { activeChatCount: nextCount },
      });
    }

    // Keep AgentProfile.activeChatCount synchronized and non-negative
    const profile = await client.agentProfile.findUnique({
      where: { userId: agentId },
      select: { id: true, activeChatCount: true },
    });

    if (profile) {
      const nextProfileCount = Math.max(0, (profile.activeChatCount || 0) - 1);
      await client.agentProfile.update({
        where: { id: profile.id },
        data: { activeChatCount: nextProfileCount },
      });
    } else {
      await client.agentProfile.updateMany({
        where: { userId: agentId, activeChatCount: { gt: 0 } },
        data: { activeChatCount: { decrement: 1 } },
      });
    }
  } catch (err) {
    console.error(`[Queue Routing] Failed to release chat for agent ${agentId}:`, err);
  }
}

/**
 * Fetches queued (unassigned open) cases sorted by priority weight DESC (VIP cases jump ahead), then createdAt ASC.
 */
export async function getQueuedCases(queueId?: string) {
  return prisma.case.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      ownerId: null,
      ...(queueId ? { queueId } : {}),
    },
    orderBy: [
      { queuePriority: 'desc' },
      { createdAt: 'asc' },
    ],
    include: { customer: true, queue: true },
  });
}

