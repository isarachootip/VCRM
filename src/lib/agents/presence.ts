/**
 * Agent Presence Management Service Layer (R5 / Phase 1 & R3 / Phase 3)
 * Path: src/lib/agents/presence.ts
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit/logger';
import {
  PresenceStatus,
  UserRole,
  AgentPresenceInfo,
  UpdatePresenceInput,
  StartBreakInput,
  StartBreakResult,
} from './types';

const VALID_PRESENCE_STATUSES = new Set<string>(['ONLINE', 'OFFLINE', 'LUNCH', 'BREAK']);

export class PresenceError extends Error {
  constructor(message: string, public statusCode: number = 400, public code?: string) {
    super(message);
    this.name = 'PresenceError';
  }
}

/**
 * Normalizes and validates presence status input
 */
export function normalizePresenceStatus(presenceStr: string): PresenceStatus {
  const upper = (presenceStr || '').trim().toUpperCase();
  if (!VALID_PRESENCE_STATUSES.has(upper)) {
    throw new PresenceError(
      `Invalid presence status: "${presenceStr}". Valid values: ONLINE, OFFLINE, LUNCH, BREAK`,
      400,
      'INVALID_PRESENCE_STATUS'
    );
  }
  return upper as PresenceStatus;
}

/**
 * Lists all agent presences with optional filtering
 */
export async function listAgentPresence(filters?: {
  businessUnit?: string;
  queueId?: string;
  presence?: string;
}): Promise<AgentPresenceInfo[]> {
  const where: any = {};

  if (filters?.presence) {
    const valid = normalizePresenceStatus(filters.presence);
    where.presence = valid;
  }

  if (filters?.queueId) {
    where.assignedQueues = {
      some: {
        queueId: filters.queueId,
      },
    };
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      agentProfile: true,
      assignedQueues: {
        include: {
          queue: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return users.map((u) => {
    const presence = (u.agentProfile?.presence || u.presence || PresenceStatus.OFFLINE) as PresenceStatus;
    const activeChats = u.agentProfile?.activeChatCount ?? u.activeChatCount ?? 0;
    const maxCapacity =
      u.agentProfile?.maxConcurrentChats ?? u.maxConcurrentChats ?? u.maxChatCapacity ?? 5;
    const breakExpectedEndAt = u.agentProfile?.breakExpectedEndAt ?? null;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      presence,
      activeChatCount: activeChats,
      maxChatCapacity: maxCapacity,
      maxConcurrentChats: maxCapacity,
      businessUnits: u.businessUnits ? u.businessUnits.map((b) => b.toString()) : [],
      assignedQueues: u.assignedQueues.map((aq) => ({
        queueId: aq.queue.id,
        queueName: aq.queue.name,
        queueCode: aq.queue.code,
      })),
      breakExpectedEndAt,
      updatedAt: u.updatedAt,
    };
  });
}

/**
 * Gets a single agent's presence info by user ID
 */
export async function getAgentPresence(userId: string): Promise<AgentPresenceInfo | null> {
  const u = await prisma.user.findFirst({
    where: {
      OR: [{ id: userId }, { email: userId }],
    },
    include: {
      agentProfile: true,
      assignedQueues: {
        include: {
          queue: true,
        },
      },
    },
  });

  if (!u) return null;

  const presence = (u.agentProfile?.presence || u.presence || PresenceStatus.OFFLINE) as PresenceStatus;
  const activeChats = u.agentProfile?.activeChatCount ?? u.activeChatCount ?? 0;
  const maxCapacity =
    u.agentProfile?.maxConcurrentChats ?? u.maxConcurrentChats ?? u.maxChatCapacity ?? 5;
  const breakExpectedEndAt = u.agentProfile?.breakExpectedEndAt ?? null;

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    presence,
    activeChatCount: activeChats,
    maxChatCapacity: maxCapacity,
    maxConcurrentChats: maxCapacity,
    businessUnits: u.businessUnits ? u.businessUnits.map((b) => b.toString()) : [],
    assignedQueues: u.assignedQueues.map((aq) => ({
      queueId: aq.queue.id,
      queueName: aq.queue.name,
      queueCode: aq.queue.code,
    })),
    breakExpectedEndAt,
    updatedAt: u.updatedAt,
  };
}

/**
 * Starts an agent break or lunch with countdown timer tracking (R3)
 */
export async function startAgentBreak(input: StartBreakInput): Promise<StartBreakResult> {
  if (!input.agentId || !input.agentId.trim()) {
    throw new PresenceError('Missing required field: agentId', 400, 'MISSING_AGENT_ID');
  }

  const normalizedStatus = normalizePresenceStatus(input.status);
  if (normalizedStatus !== PresenceStatus.BREAK && normalizedStatus !== PresenceStatus.LUNCH) {
    throw new PresenceError(
      `Invalid break status: "${input.status}". Must be BREAK or LUNCH`,
      400,
      'INVALID_BREAK_STATUS'
    );
  }

  // Validate break duration
  let durationMinutes = input.durationMinutes;
  if (durationMinutes === undefined || durationMinutes === null) {
    durationMinutes = normalizedStatus === PresenceStatus.LUNCH ? 60 : 15;
  } else {
    if (
      typeof durationMinutes !== 'number' ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0 ||
      durationMinutes > 480
    ) {
      throw new PresenceError(
        `Invalid break duration: ${durationMinutes}. Must be a positive number between 1 and 480 minutes.`,
        400,
        'INVALID_DURATION'
      );
    }
  }

  // Find agent
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: input.agentId }, { email: input.agentId }],
    },
    include: {
      agentProfile: true,
    },
  });

  if (!user) {
    throw new PresenceError(`Agent "${input.agentId}" not found`, 404, 'AGENT_NOT_FOUND');
  }

  const currentPresence = user.agentProfile?.presence || user.presence;

  // Boundary check: OFFLINE agents cannot initiate BREAK/LUNCH
  if (currentPresence === PresenceStatus.OFFLINE) {
    throw new PresenceError(
      'Cannot start break while OFFLINE. Agent must be ONLINE.',
      400,
      'OFFLINE_AGENT_BREAK'
    );
  }

  // Boundary check: Agent already on BREAK or LUNCH
  if (currentPresence === PresenceStatus.BREAK || currentPresence === PresenceStatus.LUNCH) {
    throw new PresenceError(
      `Agent is already in ${currentPresence} state`,
      409,
      'CONCURRENT_BREAK'
    );
  }

  const startedAt = new Date();
  const expectedEndAt = new Date(startedAt.getTime() + durationMinutes * 60000);

  // Update User presence
  await prisma.user.update({
    where: { id: user.id },
    data: {
      presence: normalizedStatus,
    },
  });

  // Upsert AgentProfile with breakExpectedEndAt
  await prisma.agentProfile.upsert({
    where: { userId: user.id },
    update: {
      presence: normalizedStatus,
      breakExpectedEndAt: expectedEndAt,
    },
    create: {
      userId: user.id,
      presence: normalizedStatus,
      role: user.role,
      maxConcurrentChats: user.maxConcurrentChats || 5,
      activeChatCount: user.activeChatCount || 0,
      breakExpectedEndAt: expectedEndAt,
    },
  });

  // Create AgentBreakSession record
  const session = await prisma.agentBreakSession.create({
    data: {
      agentId: user.id,
      status: normalizedStatus,
      startedAt,
      expectedEndAt,
      isAutoReverted: false,
      overrunSeconds: 0,
    },
  });

  // Audit log
  await createAuditLog({
    actorId: user.id,
    actorName: user.name,
    action: 'PRESENCE_CHANGED',
    actionType: 'PRESENCE_CHANGED',
    entityType: 'User',
    entityId: user.id,
    field: 'presence',
    oldValue: currentPresence,
    newValue: normalizedStatus,
    details: JSON.stringify({
      agentId: user.id,
      status: normalizedStatus,
      durationMinutes,
      startedAt: startedAt.toISOString(),
      expectedEndAt: expectedEndAt.toISOString(),
      sessionId: session.id,
    }),
  });

  return {
    success: true,
    agentId: user.id,
    presence: normalizedStatus,
    breakStartedAt: startedAt.toISOString(),
    breakExpectedEndAt: expectedEndAt.toISOString(),
    durationMinutes,
    sessionId: session.id,
  };
}

/**
 * Updates agent presence status and syncs both User and AgentProfile records
 */
export async function updateAgentPresence(
  input: UpdatePresenceInput
): Promise<AgentPresenceInfo> {
  if (!input.userId || !input.userId.trim()) {
    throw new PresenceError('Missing required field: userId', 400, 'MISSING_USER_ID');
  }

  const newPresence = normalizePresenceStatus(input.presence);

  // Find user
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ id: input.userId }, { email: input.userId }],
    },
    include: {
      agentProfile: true,
    },
  });

  // If user does not exist in DB yet (e.g. test agent), create one
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: input.userId,
        email: `${input.userId}@vcrm.internal`,
        name: input.userId.replace(/^user_/, '').replace(/_/g, ' ').toUpperCase(),
        role: UserRole.AGENT,
        presence: newPresence,
        maxChatCapacity: input.maxConcurrentChats || 5,
        maxConcurrentChats: input.maxConcurrentChats || 5,
        activeChatCount: 0,
      },
      include: {
        agentProfile: true,
      },
    });
  } else {
    const oldPresence = user.agentProfile?.presence || user.presence;

    // If voluntary return to ONLINE while previously on BREAK or LUNCH:
    // Close active break session with isAutoReverted=false, overrunSeconds=0
    if (
      newPresence === PresenceStatus.ONLINE &&
      (oldPresence === PresenceStatus.BREAK || oldPresence === PresenceStatus.LUNCH)
    ) {
      const activeSession = await prisma.agentBreakSession.findFirst({
        where: {
          agentId: user.id,
          endedAt: null,
        },
        orderBy: { startedAt: 'desc' },
      });

      if (activeSession) {
        await prisma.agentBreakSession.update({
          where: { id: activeSession.id },
          data: {
            endedAt: new Date(),
            isAutoReverted: false,
            overrunSeconds: 0,
          },
        });
      }
    }

    // Update User
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        presence: newPresence,
        ...(input.maxConcurrentChats ? { maxConcurrentChats: input.maxConcurrentChats } : {}),
      },
      include: {
        agentProfile: true,
      },
    });

    // Upsert AgentProfile (clear breakExpectedEndAt if moving to ONLINE or OFFLINE)
    const shouldClearBreakEnd =
      newPresence === PresenceStatus.ONLINE || newPresence === PresenceStatus.OFFLINE;

    await prisma.agentProfile.upsert({
      where: { userId: user.id },
      update: {
        presence: newPresence,
        ...(input.maxConcurrentChats ? { maxConcurrentChats: input.maxConcurrentChats } : {}),
        ...(shouldClearBreakEnd ? { breakExpectedEndAt: null } : {}),
      },
      create: {
        userId: user.id,
        presence: newPresence,
        role: user.role,
        maxConcurrentChats: input.maxConcurrentChats || user.maxConcurrentChats || 5,
        activeChatCount: user.activeChatCount || 0,
        breakExpectedEndAt: null,
      },
    });

    // Create Audit Log
    await createAuditLog({
      actorId: user.id,
      actorName: user.name,
      action: 'PRESENCE_CHANGED',
      actionType: 'PRESENCE_CHANGED',
      entityType: 'User',
      entityId: user.id,
      field: 'presence',
      oldValue: oldPresence,
      newValue: newPresence,
      details: JSON.stringify({
        userId: user.id,
        oldPresence,
        newPresence,
        reason: input.reason || null,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  // Refetch complete info with queues
  const complete = await getAgentPresence(user.id);
  if (!complete) {
    throw new PresenceError(
      `Failed to retrieve agent presence after update for user ${user.id}`,
      500,
      'FETCH_FAILED'
    );
  }

  return complete;
}
