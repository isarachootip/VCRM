/**
 * Real-Time Operational Dashboard Type Definitions (R5 / Phase 1)
 * Path: src/lib/dashboard/types.ts
 */

export interface ActiveQueueMetric {
  queueId: string;
  queueName: string;
  queueCode: string;
  businessUnit: string;
  openCases: number;
  inProgressCases: number;
  waitingCases: number;
  activeCases: number;
  avgWaitTimeMin: number;
  avgWaitTimeSeconds: number;
  slaBreachedCount: number;
}

export interface AgentStatusSummary {
  online: number;
  offline: number;
  lunch: number;
  break: number;
  totalAgents: number;
}

export interface AgentDetailMetric {
  id: string;
  name: string;
  email: string;
  presence: string;
  activeChats: number;
  maxCapacity: number;
  utilizationPercent: number;
}

export interface AgentPresenceMetric {
  online: number;
  offline: number;
  lunch: number;
  break: number;
  totalAgents: number;
  totalCapacity: number;
  activeChats: number;
  utilizationRate: number;
  agents: AgentDetailMetric[];
}

export interface PendingPaymentMetric {
  count: number;
  totalAmount: number;
  amount: number;
}

export interface DailySalesVolumeMetric {
  paidQuotationsCount: number;
  completedQuotationsCount: number;
  totalQuotationsCount: number;
  totalPaidAmountThb: number;
  count: number;
  revenueThb: number;
  amount: number;
}

export interface SalesMetrics {
  quotationsCreatedToday: number;
  quotationsPaidToday: number;
  conversionRate: number;
  pendingPaymentCount: number;
  pendingPaymentValue: number;
  totalRevenueToday: number;
}

export interface ServiceSLAMetric {
  avgFirstResponseTimeSeconds: number;
  avgHandlingTimeSeconds: number;
  breachedSLACount: number;
}

export interface DashboardMetrics {
  timestamp: string;
  activeQueues: ActiveQueueMetric[];
  queueDepth: ActiveQueueMetric[];
  activeCases: number;
  totalCases: number;
  agentStatuses: AgentStatusSummary;
  agentPresence: AgentPresenceMetric;
  pendingPayments: PendingPaymentMetric;
  dailySalesVolume: DailySalesVolumeMetric;
  salesMetrics: SalesMetrics;
  serviceSLA: ServiceSLAMetric;
  conversionRate: number;
  metrics: {
    queueDepth: ActiveQueueMetric[];
    agentPresence: AgentPresenceMetric;
    salesMetrics: SalesMetrics;
    conversionRate: number;
  };
}
