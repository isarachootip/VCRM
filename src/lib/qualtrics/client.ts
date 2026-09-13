/**
 * Qualtrics CSAT Integration Client
 * Path: src/lib/qualtrics/client.ts
 */

import { prisma } from '@/lib/db';
import {
  QualtricsDistributionPayload,
  QualtricsDistributionResponse,
  QualtricsClientConfig,
} from './types';

export class QualtricsClientError extends Error {
  public statusCode?: number;
  public details?: any;

  constructor(message: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'QualtricsClientError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class QualtricsClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: QualtricsClientConfig = {}) {
    const rawUrl =
      config.baseUrl ||
      process.env.QUALTRICS_API_BASE_URL ||
      process.env.QUALTRICS_API_BASE ||
      process.env.QUALTRICS_MOCK_URL ||
      'http://127.0.0.1:4020';
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs || 5000;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Dispatches a survey distribution request to the Qualtrics API (or mock server).
   * Target endpoint: POST /mock/qualtrics/v3/distributions
   */
  public async triggerDistribution(
    payload: QualtricsDistributionPayload
  ): Promise<QualtricsDistributionResponse> {
    const url = `${this.baseUrl}/mock/qualtrics/v3/distributions`;

    const bodyData = {
      surveyId: payload.surveyId,
      caseId: payload.caseId,
      caseNumber: payload.caseNumber || '',
      businessUnit: payload.businessUnit || '',
      queueId: payload.queueId || '',
      channel: payload.channel || 'LINE',
      recipient: {
        customerId: payload.recipient?.customerId || '',
        name: payload.recipient?.name || 'Customer',
        channelUserId: payload.recipient?.channelUserId || '',
      },
      embeddedData: {
        agentId: payload.embeddedData?.agentId || 'unassigned',
        agentName: payload.embeddedData?.agentName,
        closureTimestamp:
          payload.embeddedData?.closureTimestamp || new Date().toISOString(),
        ...payload.embeddedData,
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: any) {
      throw new QualtricsClientError(
        `Qualtrics connection failure: ${err.message}`,
        502,
        { originalError: err.message, url }
      );
    }

    if (!response.ok) {
      let errBody: any = null;
      try {
        errBody = await response.json();
      } catch {
        try {
          errBody = await response.text();
        } catch {
          errBody = null;
        }
      }
      throw new QualtricsClientError(
        `Qualtrics API rejected survey distribution with status ${response.status}`,
        response.status,
        errBody
      );
    }

    const data = await response.json();
    return data as QualtricsDistributionResponse;
  }

  /**
   * 24-hour customer cooldown check.
   * Verifies whether the specified customer has received a CSAT survey dispatch
   * within the last `cooldownHours` (default 24h) to prevent survey fatigue/spam.
   */
  public async isCustomerInCooldown(
    customerId: string,
    cooldownHours: number = 24
  ): Promise<boolean> {
    if (!customerId) return false;

    const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

    const recentDispatch = await prisma.surveyDispatch.findFirst({
      where: {
        status: {
          in: ['DISPATCHED', 'SENT', 'RESPONDED'],
        },
        OR: [
          { dispatchedAt: { gte: cutoff } },
          { createdAt: { gte: cutoff } },
        ],
        case: {
          OR: [
            { customerId },
            { customer: { id: customerId } },
            { customer: { externalId: customerId } },
            { customer: { lineUserId: customerId } },
            { customer: { fbPsid: customerId } },
          ],
        },
      },
      select: { id: true, createdAt: true, dispatchedAt: true, status: true },
    });

    return Boolean(recentDispatch);
  }
}

export const qualtricsClient = new QualtricsClient();
