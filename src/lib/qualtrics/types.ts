/**
 * Qualtrics CSAT Integration Type Definitions
 * Path: src/lib/qualtrics/types.ts
 */

export type SocialChannel = 'LINE' | 'FB' | 'IG' | 'WEB';

export interface QualtricsRecipient {
  customerId?: string;
  name?: string;
  channelUserId?: string;
  [key: string]: any;
}

export interface QualtricsEmbeddedData {
  agentId?: string;
  agentName?: string;
  closureTimestamp?: string;
  resolutionDurationSeconds?: number;
  caseCategory?: string;
  businessUnit?: string;
  queueId?: string;
  [key: string]: any;
}

export interface QualtricsDistributionPayload {
  surveyId: string;
  caseId: string;
  caseNumber?: string;
  businessUnit?: string;
  queueId?: string;
  channel?: string;
  recipient?: QualtricsRecipient;
  embeddedData?: QualtricsEmbeddedData;
  [key: string]: any;
}

export interface QualtricsDistributionResult {
  id: string; // e.g. EMD_dist_...
  status?: string;
  sendDate?: string;
  [key: string]: any;
}

export interface QualtricsDistributionResponse {
  result: QualtricsDistributionResult;
  [key: string]: any;
}

export interface QualtricsMetrics {
  csatScore?: number;
  npsScore?: number;
  cesScore?: number;
  ratingCategory?: string;
  [key: string]: any;
}

export interface QualtricsFeedback {
  comment?: string;
  language?: string;
  [key: string]: any;
}

export interface QualtricsInboundWebhookPayload {
  eventId?: string;
  surveyId?: string;
  responseId?: string;
  distributionId?: string;
  caseId: string;
  submittedAt?: string;
  metrics?: QualtricsMetrics;
  feedback?: QualtricsFeedback;
  embeddedData?: Record<string, any>;
  [key: string]: any;
}

export interface QualtricsClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface CustomerCooldownCheckOptions {
  customerId: string;
  cooldownHours?: number;
}
