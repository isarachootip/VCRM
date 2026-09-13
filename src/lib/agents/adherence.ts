/**
 * Agent Shift Adherence & Break Metrics Service Layer (R3 / Phase 3)
 * Path: src/lib/agents/adherence.ts
 */

import { prisma } from '@/lib/db';
import { PresenceStatus, AgentAdherenceRecord, BreakSessionHistoryItem } from './types';

export interface AdherenceFilterOptions {
  agentId?: string;
  businessUnit?: string;
  date?: string;
}

export interface AdherenceReportResult {
  success: boolean;
  agents: AgentAdherenceRecord[];
  adherenceRecords: AgentAdherenceRecord[];
  total: number;
  timestamp: string;
}

/**
 * Retrieves break session history for a specific agent
 */
export async function getAgentBreakHistory(agentId: string): Promise<BreakSessionHistoryItem[]> {
  const sessions = await prisma.agentBreakSession.findMany({
    where: { agentId },
    orderBy: { startedAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    agentId: s.agentId,
    status: s.status as PresenceStatus,
    startedAt: s.startedAt,
    expectedEndAt: s.expectedEndAt,
    endedAt: s.endedAt,
    isAutoReverted: s.isAutoReverted,
    overrunSeconds: s.overrunSeconds,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

/**
 * Calculates agent workforce shift adherence and break overrun metrics
 */
export async function getAgentAdherenceReport(
  filters?: AdherenceFilterOptions
): Promise<AdherenceReportResult> {
  const userWhere: any = {
    role: { in: ['AGENT', 'SUPERVISOR', 'ADMIN'] },
  };

  if (filters?.agentId) {
    userWhere.OR = [{ id: filters.agentId }, { email: filters.agentId }];
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      agentProfile: true,
    },
    orderBy: { name: 'asc' },
  });

  const records: AgentAdherenceRecord[] = [];

  for (const user of users) {
    const sessions = await prisma.agentBreakSession.findMany({
      where: { agentId: user.id },
      orderBy: { startedAt: 'desc' },
    });

    let totalBreakSeconds = 0;
    let totalOverrunSeconds = 0;
    let autoRevertedCount = 0;

    for (const s of sessions) {
      if (s.isAutoReverted) {
        autoRevertedCount++;
      }
      totalOverrunSeconds += s.overrunSeconds || 0;

      const endMs = s.endedAt ? s.endedAt.getTime() : s.expectedEndAt.getTime();
      const durSec = Math.max(0, Math.floor((endMs - s.startedAt.getTime()) / 1000));
      totalBreakSeconds += durSec;
    }

    const totalBreaks = sessions.length;
    const totalBreakMinutes = Math.round(totalBreakSeconds / 60);
    const overrunMinutes = Math.round(totalOverrunSeconds / 60);

    // Adherence score: 100% baseline minus penalty for overruns (e.g. 2% per overrun minute)
    const adherenceScore = Math.max(0, Math.min(100, Math.round(100 - overrunMinutes * 2)));

    const currentPresence = (user.agentProfile?.presence || user.presence) as PresenceStatus;
    const breakExpectedEndAt = user.agentProfile?.breakExpectedEndAt || null;

    const mappedSessions: BreakSessionHistoryItem[] = sessions.map((s) => ({
      id: s.id,
      agentId: s.agentId,
      status: s.status as PresenceStatus,
      startedAt: s.startedAt,
      expectedEndAt: s.expectedEndAt,
      endedAt: s.endedAt,
      isAutoReverted: s.isAutoReverted,
      overrunSeconds: s.overrunSeconds,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    records.push({
      agentId: user.id,
      agentName: user.name,
      email: user.email,
      role: user.role,
      presence: currentPresence,
      breakExpectedEndAt,
      totalBreaks,
      totalBreakMinutes,
      totalOverrunSeconds,
      overrunMinutes,
      autoRevertedCount,
      adherenceScore,
      recentSessions: mappedSessions,
    });
  }

  return {
    success: true,
    agents: records,
    adherenceRecords: records,
    total: records.length,
    timestamp: new Date().toISOString(),
  };
}
