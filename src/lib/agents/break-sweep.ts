/**
 * Agent Break Timer Auto-Reversion Sweeper (R3 / Phase 3)
 * Path: src/lib/agents/break-sweep.ts
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit/logger';
import { PresenceStatus } from './types';

export interface BreakSweepOptions {
  simulatedElapsedMinutes?: number | null;
  dryRun?: boolean;
}

export interface BreakSweepResult {
  scanned: number;
  reverted: number;
  agentIdsReverted: string[];
  sessionsUpdated: number;
  dryRun: boolean;
  timestamp: string;
}

/**
 * Sweeps agent break timers and automatically reverts expired breaks back to ONLINE
 */
export async function sweepAgentBreakTimers(
  options?: BreakSweepOptions
): Promise<BreakSweepResult> {
  const dryRun = Boolean(options?.dryRun);
  const simulatedElapsedMinutes = options?.simulatedElapsedMinutes;

  // 1. Query all agents currently in BREAK or LUNCH presence
  const agentsOnBreak = await prisma.user.findMany({
    where: {
      presence: {
        in: [PresenceStatus.BREAK, PresenceStatus.LUNCH],
      },
    },
    include: {
      agentProfile: true,
    },
  });

  // 2. Query active unended break sessions
  const activeSessions = await prisma.agentBreakSession.findMany({
    where: {
      endedAt: null,
      status: {
        in: [PresenceStatus.BREAK, PresenceStatus.LUNCH],
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
  });

  const sessionMap = new Map<string, typeof activeSessions[0]>();
  for (const session of activeSessions) {
    if (!sessionMap.has(session.agentId)) {
      sessionMap.set(session.agentId, session);
    }
  }

  const revertedAgentIds: string[] = [];
  let sessionsUpdated = 0;
  let scanned = agentsOnBreak.length;

  for (const agent of agentsOnBreak) {
    const session = sessionMap.get(agent.id);
    const startedAt = session?.startedAt ?? agent.agentProfile?.updatedAt ?? agent.updatedAt;
    const expectedEndAt =
      session?.expectedEndAt ??
      agent.agentProfile?.breakExpectedEndAt ??
      new Date(startedAt.getTime() + (agent.presence === PresenceStatus.LUNCH ? 60 : 15) * 60000);

    // Calculate effective current evaluation time
    let effectiveNow: Date;
    if (typeof simulatedElapsedMinutes === 'number' && Number.isFinite(simulatedElapsedMinutes)) {
      effectiveNow = new Date(startedAt.getTime() + simulatedElapsedMinutes * 60000);
    } else {
      effectiveNow = new Date();
    }

    // Check expiration: effectiveNow >= expectedEndAt
    const isExpired = effectiveNow.getTime() >= expectedEndAt.getTime();

    if (isExpired) {
      const overrunSeconds = Math.max(
        0,
        Math.floor((effectiveNow.getTime() - expectedEndAt.getTime()) / 1000)
      );

      if (!dryRun) {
        // Update AgentBreakSession if exists
        if (session) {
          await prisma.agentBreakSession.update({
            where: { id: session.id },
            data: {
              endedAt: effectiveNow,
              isAutoReverted: true,
              overrunSeconds,
            },
          });
          sessionsUpdated++;
        } else {
          // Fallback: create closed session record for completeness
          await prisma.agentBreakSession.create({
            data: {
              agentId: agent.id,
              status: agent.presence,
              startedAt,
              expectedEndAt,
              endedAt: effectiveNow,
              isAutoReverted: true,
              overrunSeconds,
            },
          });
          sessionsUpdated++;
        }

        // Auto-revert User presence to ONLINE
        await prisma.user.update({
          where: { id: agent.id },
          data: {
            presence: PresenceStatus.ONLINE,
          },
        });

        // Clear breakExpectedEndAt and set profile presence to ONLINE
        await prisma.agentProfile.upsert({
          where: { userId: agent.id },
          update: {
            presence: PresenceStatus.ONLINE,
            breakExpectedEndAt: null,
          },
          create: {
            userId: agent.id,
            presence: PresenceStatus.ONLINE,
            role: agent.role,
            maxConcurrentChats: agent.maxConcurrentChats || 5,
            activeChatCount: agent.activeChatCount || 0,
            breakExpectedEndAt: null,
          },
        });

        // Record Audit Log: PRESENCE_AUTO_REVERTED
        await createAuditLog({
          actorId: agent.id,
          actorName: agent.name,
          action: 'PRESENCE_AUTO_REVERTED',
          actionType: 'PRESENCE_AUTO_REVERTED',
          entityType: 'User',
          entityId: agent.id,
          field: 'presence',
          oldValue: agent.presence,
          newValue: PresenceStatus.ONLINE,
          details: JSON.stringify({
            agentId: agent.id,
            autoReverted: true,
            overrunSeconds,
            simulatedElapsedMinutes: simulatedElapsedMinutes ?? null,
            effectiveNow: effectiveNow.toISOString(),
            expectedEndAt: expectedEndAt.toISOString(),
            reason: 'Break timer expired via auto-reversion sweeper',
          }),
        });
      }

      revertedAgentIds.push(agent.id);
    }
  }

  return {
    scanned,
    reverted: revertedAgentIds.length,
    agentIdsReverted: revertedAgentIds,
    sessionsUpdated: dryRun ? 0 : sessionsUpdated,
    dryRun,
    timestamp: new Date().toISOString(),
  };
}
