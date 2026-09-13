/**
 * Real-Time Operational Dashboard Service Layer (R5 / Phase 1)
 * Path: src/lib/dashboard/service.ts
 */

import { prisma } from '@/lib/db';
import {
  DashboardMetrics,
  ActiveQueueMetric,
  AgentStatusSummary,
  AgentDetailMetric,
  AgentPresenceMetric,
  PendingPaymentMetric,
  DailySalesVolumeMetric,
  SalesMetrics,
  ServiceSLAMetric,
} from './types';

/**
 * Aggregates real-time operational dashboard metrics from PostgreSQL
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const nowMs = now.getTime();

  // 1. Queues and active cases
  const queues = await prisma.queue.findMany({
    include: {
      cases: {
        where: {
          status: {
            in: ['OPEN', 'IN_PROGRESS'],
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  let totalActiveCases = 0;
  let totalOpenCases = 0;
  let totalSlaBreaches = 0;
  let totalWaitSeconds = 0;
  let waitCount = 0;

  const activeQueues: ActiveQueueMetric[] = queues.map((q) => {
    const openCases = q.cases.filter((c) => c.status === 'OPEN').length;
    const inProgressCases = q.cases.filter((c) => c.status === 'IN_PROGRESS').length;
    const waitingCases = openCases;
    const activeCases = openCases + inProgressCases;

    totalOpenCases += openCases;
    totalActiveCases += activeCases;

    // Calculate wait times for waiting/open cases
    let queueWaitSeconds = 0;
    let queueWaitCount = 0;
    let queueSlaBreached = 0;

    const slaLimitMs = (q.slaResponseMin || 15) * 60 * 1000;

    for (const c of q.cases) {
      const createdMs = new Date(c.createdAt).getTime();
      const elapsedMs = Math.max(0, nowMs - createdMs);

      if (c.status === 'OPEN') {
        queueWaitSeconds += Math.round(elapsedMs / 1000);
        queueWaitCount++;

        if (!c.firstResponseAt && elapsedMs > slaLimitMs) {
          queueSlaBreached++;
        }
      }
    }

    if (queueWaitCount > 0) {
      totalWaitSeconds += queueWaitSeconds;
      waitCount += queueWaitCount;
    }
    totalSlaBreaches += queueSlaBreached;

    const avgWaitSec = queueWaitCount > 0 ? Math.round(queueWaitSeconds / queueWaitCount) : 0;
    const avgWaitMin = Math.round((avgWaitSec / 60) * 10) / 10;

    return {
      queueId: q.id,
      queueName: q.name,
      queueCode: q.code,
      businessUnit: q.businessUnit,
      openCases,
      inProgressCases,
      waitingCases,
      activeCases,
      avgWaitTimeMin: avgWaitMin,
      avgWaitTimeSeconds: avgWaitSec,
      slaBreachedCount: queueSlaBreached,
    };
  });

  // 2. Agent Presence & Capacity
  const agentsList = await prisma.user.findMany({
    where: {
      role: { in: ['AGENT', 'SUPERVISOR'] },
    },
    include: {
      agentProfile: true,
    },
  });

  let onlineCount = 0;
  let offlineCount = 0;
  let lunchCount = 0;
  let breakCount = 0;
  let totalCapacity = 0;
  let totalActiveChats = 0;

  const agentDetails: AgentDetailMetric[] = agentsList.map((u) => {
    const presence = (u.agentProfile?.presence || u.presence || 'OFFLINE').toUpperCase();
    const activeChats = u.agentProfile?.activeChatCount ?? u.activeChatCount ?? 0;
    const maxCapacity = u.agentProfile?.maxConcurrentChats ?? u.maxConcurrentChats ?? u.maxChatCapacity ?? 5;

    totalCapacity += maxCapacity;
    totalActiveChats += activeChats;

    if (presence === 'ONLINE') onlineCount++;
    else if (presence === 'LUNCH') lunchCount++;
    else if (presence === 'BREAK') breakCount++;
    else offlineCount++;

    const util = maxCapacity > 0 ? Math.round((activeChats / maxCapacity) * 100) : 0;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      presence,
      activeChats,
      maxCapacity,
      utilizationPercent: util,
    };
  });

  const agentStatuses: AgentStatusSummary = {
    online: onlineCount,
    offline: offlineCount,
    lunch: lunchCount,
    break: breakCount,
    totalAgents: agentsList.length,
  };

  const agentPresence: AgentPresenceMetric = {
    online: onlineCount,
    offline: offlineCount,
    lunch: lunchCount,
    break: breakCount,
    totalAgents: agentsList.length,
    totalCapacity,
    activeChats: totalActiveChats,
    utilizationRate: totalCapacity > 0 ? Math.round((totalActiveChats / totalCapacity) * 100) / 100 : 0,
    agents: agentDetails,
  };

  // 3. Pending Payments
  const pendingQuotations = await prisma.quotation.findMany({
    where: {
      status: 'PENDING_PAYMENT',
    },
    select: {
      grandTotal: true,
    },
  });

  const pendingCount = pendingQuotations.length;
  const pendingTotalAmount = pendingQuotations.reduce(
    (sum, q) => sum + Number(q.grandTotal),
    0
  );

  const pendingPayments: PendingPaymentMetric = {
    count: pendingCount,
    totalAmount: pendingTotalAmount,
    amount: pendingTotalAmount,
  };

  // 4. Daily Sales Volume & Conversion Rate
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayQuotations = await prisma.quotation.findMany({
    where: {
      createdAt: {
        gte: todayStart,
      },
    },
    select: {
      status: true,
      grandTotal: true,
    },
  });

  const paidStatuses = ['PAID', 'PRINTED', 'COMPLETED'];
  const paidTodayQuotations = todayQuotations.filter((q) =>
    paidStatuses.includes(q.status)
  );

  const totalQuotationsCreatedToday = todayQuotations.length;
  const totalQuotationsPaidToday = paidTodayQuotations.length;
  const totalRevenueToday = paidTodayQuotations.reduce(
    (sum, q) => sum + Number(q.grandTotal),
    0
  );

  const completedTodayCount = todayQuotations.filter(
    (q) => q.status === 'COMPLETED'
  ).length;

  const conversionRate =
    totalQuotationsCreatedToday > 0
      ? Math.round((totalQuotationsPaidToday / totalQuotationsCreatedToday) * 10000) / 100
      : 0;

  const dailySalesVolume: DailySalesVolumeMetric = {
    paidQuotationsCount: totalQuotationsPaidToday,
    completedQuotationsCount: completedTodayCount,
    totalQuotationsCount: totalQuotationsCreatedToday,
    totalPaidAmountThb: totalRevenueToday,
    count: totalQuotationsPaidToday,
    revenueThb: totalRevenueToday,
    amount: totalRevenueToday,
  };

  const salesMetrics: SalesMetrics = {
    quotationsCreatedToday: totalQuotationsCreatedToday,
    quotationsPaidToday: totalQuotationsPaidToday,
    conversionRate,
    pendingPaymentCount: pendingCount,
    pendingPaymentValue: pendingTotalAmount,
    totalRevenueToday,
  };

  // 5. Service SLA Metrics
  const avgWaitSec = waitCount > 0 ? Math.round(totalWaitSeconds / waitCount) : 0;

  // Recent resolved cases for average handling time
  const recentCases = await prisma.case.findMany({
    where: {
      status: { in: ['RESOLVED', 'CLOSED'] },
      resolvedAt: { not: null },
    },
    take: 50,
    orderBy: { updatedAt: 'desc' },
    select: {
      createdAt: true,
      resolvedAt: true,
      firstResponseAt: true,
    },
  });

  let totalHandlingSec = 0;
  let totalFrtSec = 0;
  let frtCount = 0;

  for (const rc of recentCases) {
    if (rc.resolvedAt) {
      const dur = Math.max(0, new Date(rc.resolvedAt).getTime() - new Date(rc.createdAt).getTime());
      totalHandlingSec += Math.round(dur / 1000);
    }
    if (rc.firstResponseAt) {
      const frt = Math.max(0, new Date(rc.firstResponseAt).getTime() - new Date(rc.createdAt).getTime());
      totalFrtSec += Math.round(frt / 1000);
      frtCount++;
    }
  }

  const avgHandlingTimeSeconds = recentCases.length > 0 ? Math.round(totalHandlingSec / recentCases.length) : 0;
  const avgFirstResponseTimeSeconds = frtCount > 0 ? Math.round(totalFrtSec / frtCount) : avgWaitSec;

  const serviceSLA: ServiceSLAMetric = {
    avgFirstResponseTimeSeconds,
    avgHandlingTimeSeconds,
    breachedSLACount: totalSlaBreaches,
  };

  return {
    timestamp: now.toISOString(),
    activeQueues,
    queueDepth: activeQueues,
    activeCases: totalActiveCases,
    totalCases: totalActiveCases,
    agentStatuses,
    agentPresence,
    pendingPayments,
    dailySalesVolume,
    salesMetrics,
    serviceSLA,
    conversionRate,
    metrics: {
      queueDepth: activeQueues,
      agentPresence,
      salesMetrics,
      conversionRate,
    },
  };
}

/**
 * Snapshot convenience function
 */
export async function getDashboardSnapshot(): Promise<DashboardMetrics> {
  return getDashboardMetrics();
}
