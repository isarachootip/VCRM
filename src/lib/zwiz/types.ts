/**
 * Authoritative Type Definitions for Zwiz.AI Chatbot Gateway Integration
 * Path: src/lib/zwiz/types.ts
 */

export type SocialChannel = 'LINE' | 'FB' | 'IG' | 'FACEBOOK' | 'INSTAGRAM' | string;

export type BusinessUnitName =
  | 'Muji'
  | 'SSP'
  | 'B2S'
  | string;

export type MessageContentType = 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO' | string;

export interface ZwizMediaAttachment {
  url: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ZwizInboundWebhookPayload {
  eventId?: string;
  timestamp?: string;
  source: {
    channel: SocialChannel;
    pageId?: string;
    pageName?: string;
    businessUnit?: BusinessUnitName;
    senderId: string;
    senderName?: string;
    senderProfileUrl?: string;
  };
  session?: {
    sessionId: string;
    sessionStart?: string;
    sessionEnd?: string;
    inboundSource?: string;
    botState?: string;
  };
  message?: {
    messageId: string;
    type: MessageContentType;
    text?: string;
    media?: ZwizMediaAttachment;
  };
  queueId?: string;
}

export interface ZwizInboundWebhookResponse {
  success: boolean;
  caseId: string;
  caseNumber?: string;
  messageId?: string;
  status?: string;
  duplicate?: boolean;
  error?: string;
}

export interface ZwizOutboundMessagePayload {
  caseId: string;
  recipientId: string;
  channel: 'LINE' | 'FB' | 'IG' | string;
  pageId: string;
  message: {
    messageType: MessageContentType;
    content?: {
      text?: string;
      mediaUrl?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    };
    card?: any;
    template?: any;
    carousel?: any;
    quickReplies?: any[];
    actions?: any[];
    [key: string]: any;
  };
  metadata?: {
    agentId?: string;
    agentName?: string;
    sentAt?: string;
    [key: string]: any;
  };
}

export interface ZwizOutboundResponse {
  messageId: string;
  status: 'DELIVERED' | string;
  timestamp?: string;
}

export interface ZwizBotStateUpdatePayload {
  userId: string;
  sessionId: string;
  caseId: string;
  botState?: 'ACTIVE' | 'AGENT_HANDOFF' | 'CLOSED' | string;
  action?: 'RESET_TO_MAIN_MENU' | string;
  closedAt?: string;
  closureReason?: string;
}

export interface ZwizBotStateUpdateResponse {
  status: 'UPDATED' | string;
  userId: string;
  botState: string;
  timestamp?: string;
}
