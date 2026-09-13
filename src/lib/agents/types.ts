/**
 * Agent Presence & Team Queue Routing Types (R5 / Phase 1)
 * Path: src/lib/agents/types.ts
 */

import { PresenceStatus, UserRole } from '@prisma/client';

export { PresenceStatus, UserRole };

export interface AssignedQueueInfo {
  queueId: string;
  queueName: string;
  queueCode: string;
}

export interface AgentPresenceInfo {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  presence: PresenceStatus;
  activeChatCount: number;
  maxChatCapacity: number;
  maxConcurrentChats: number;
  businessUnits: string[];
  assignedQueues: AssignedQueueInfo[];
  breakExpectedEndAt?: Date | string | null;
  updatedAt: Date;
}

export interface UpdatePresenceInput {
  userId: string;
  presence: PresenceStatus | string;
  reason?: string;
  maxConcurrentChats?: number;
  durationMinutes?: number;
}

export interface StartBreakInput {
  agentId: string;
  status: PresenceStatus | string;
  durationMinutes?: number;
}

export interface StartBreakResult {
  success: boolean;
  agentId: string;
  presence: PresenceStatus;
  breakStartedAt: string;
  breakExpectedEndAt: string;
  durationMinutes: number;
  sessionId?: string;
}

export interface BreakSessionHistoryItem {
  id: string;
  agentId: string;
  status: PresenceStatus;
  startedAt: Date;
  expectedEndAt: Date;
  endedAt: Date | null;
  isAutoReverted: boolean;
  overrunSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentAdherenceRecord {
  agentId: string;
  agentName: string;
  email: string;
  role: UserRole;
  presence: PresenceStatus;
  breakExpectedEndAt: Date | string | null;
  totalBreaks: number;
  totalBreakMinutes: number;
  totalOverrunSeconds: number;
  overrunMinutes: number;
  autoRevertedCount: number;
  adherenceScore: number;
  recentSessions: BreakSessionHistoryItem[];
}

export interface QueueRoutingResult {
  assigned: boolean;
  caseId: string;
  queueId: string;
  agentId: string | null;
  agentName?: string | null;
  reason?: string;
}
