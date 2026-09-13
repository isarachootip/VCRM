/**
 * Zwiz.AI Chatbot Gateway Client
 * Path: src/lib/zwiz/client.ts
 */

import {
  ZwizOutboundMessagePayload,
  ZwizOutboundResponse,
  ZwizBotStateUpdatePayload,
  ZwizBotStateUpdateResponse,
} from './types';

export interface ZwizClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export class ZwizClientError extends Error {
  public statusCode?: number;
  public details?: any;

  constructor(message: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'ZwizClientError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ZwizClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: ZwizClientConfig = {}) {
    const rawUrl =
      config.baseUrl ||
      process.env.ZWIZ_API_BASE_URL ||
      process.env.ZWIZ_API_BASE ||
      process.env.ZWIZ_MOCK_URL ||
      'http://127.0.0.1:4010';
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs || 5000;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Dispatches an outbound message from CRM agent to customer via Zwiz.AI.
   * Target endpoint: POST /mock/zwiz/v1/messages
   */
  public async sendMessage(payload: ZwizOutboundMessagePayload): Promise<ZwizOutboundResponse> {
    const url = `${this.baseUrl}/mock/zwiz/v1/messages`;

    const finalPayload: ZwizOutboundMessagePayload = {
      ...payload,
      metadata: {
        ...payload.metadata,
        sentAt: payload.metadata?.sentAt || new Date().toISOString(),
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zwiz-Signature': 'crm-outbound-dispatch',
        },
        body: JSON.stringify(finalPayload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: any) {
      throw new ZwizClientError(
        `Downstream Zwiz connection failure: ${err.message}`,
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
      throw new ZwizClientError(
        `Zwiz API rejected outbound message with status ${response.status}`,
        response.status,
        errBody
      );
    }

    const data = await response.json();
    return {
      messageId: data.messageId,
      status: data.status || 'DELIVERED',
      timestamp: data.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Synchronizes/resets customer bot state in Zwiz.AI when a case is closed.
   * Target endpoint: POST /mock/zwiz/v1/users/:userId/state
   */
  public async updateBotState(payload: ZwizBotStateUpdatePayload): Promise<ZwizBotStateUpdateResponse> {
    const url = `${this.baseUrl}/mock/zwiz/v1/users/${encodeURIComponent(payload.userId)}/state`;

    const finalPayload = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      caseId: payload.caseId,
      botState: payload.botState || 'ACTIVE',
      action: payload.action || 'RESET_TO_MAIN_MENU',
      closedAt: payload.closedAt || new Date().toISOString(),
      closureReason: payload.closureReason || 'RESOLVED_BY_AGENT',
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zwiz-Signature': 'crm-state-sync',
        },
        body: JSON.stringify(finalPayload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: any) {
      throw new ZwizClientError(
        `Downstream Zwiz state sync connection failure: ${err.message}`,
        502,
        { originalError: err.message, url }
      );
    }

    if (!response.ok) {
      let errBody: any = null;
      try {
        errBody = await response.json();
      } catch {
        errBody = null;
      }
      throw new ZwizClientError(
        `Zwiz API rejected bot state update with status ${response.status}`,
        response.status,
        errBody
      );
    }

    const data = await response.json();
    return {
      status: data.status || 'UPDATED',
      userId: data.userId || payload.userId,
      botState: data.botState || 'ACTIVE',
      timestamp: data.timestamp,
    };
  }
}

// Global singleton instance
export const zwizClient = new ZwizClient();
