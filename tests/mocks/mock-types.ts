export type SocialChannel = 'LINE' | 'FB' | 'IG';

export type BusinessUnitName =
  | 'Central'
  | 'Central Beauty Club'
  | 'Muji'
  | 'SSP'
  | 'B2S';

export type MessageContentType =
  | 'TEXT'
  | 'IMAGE'
  | 'FILE'
  | 'VIDEO'
  | 'AUDIO'
  | 'TEMPLATE'
  | 'BUTTON_CARD'
  | 'CAROUSEL';

export type ZwizTemplateType =
  | 'BUTTONS'
  | 'BUTTON_CARD'
  | 'QUICK_REPLIES'
  | 'CAROUSEL'
  | 'PAYMENT_LINK'
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_CONFIRMATION'
  | 'ORDER_SUMMARY'
  | 'PROMOTION_CARD'
  | 'QUOTATION_EXPIRED';

export interface ZwizTemplateAction {
  type: 'uri' | 'URI' | 'message' | 'MESSAGE' | 'postback' | 'POSTBACK';
  label: string;
  url?: string;
  text?: string;
  data?: string;
}

export interface ZwizQuickReplyItem {
  type?: 'action';
  label?: string;
  action?: ZwizTemplateAction | 'POSTBACK' | 'MESSAGE' | 'URI';
  data?: string;
  value?: string;
}

export interface ZwizCarouselColumn {
  thumbnailImageUrl?: string;
  imageUrl?: string;
  title?: string;
  text?: string;
  description?: string;
  defaultAction?: ZwizTemplateAction;
  actions: ZwizTemplateAction[];
}

export interface ZwizTemplatePayload {
  templateType?: ZwizTemplateType;
  altText?: string;
  title?: string;
  subtitle?: string;
  text?: string;
  description?: string;
  thumbnailImageUrl?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  actions?: ZwizTemplateAction[];
  quickReplies?: ZwizQuickReplyItem[];
  columns?: ZwizCarouselColumn[];
  items?: ZwizCarouselColumn[];
  quotationNumber?: string;
  amount?: number;
  paymentUrl?: string;
  expiresAt?: string;
  [key: string]: any;
}

export interface ZwizMediaAttachment {
  url: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ZwizInboundPayload {
  eventId: string;
  timestamp: string;
  source: {
    channel: SocialChannel;
    pageId: string;
    pageName: string;
    businessUnit: BusinessUnitName;
    senderId: string;
    senderName: string;
    senderProfileUrl?: string;
  };
  session: {
    sessionId: string;
    sessionStart: string;
    botState: 'AGENT_HANDOFF' | 'ACTIVE' | 'CLOSED';
  };
  message: {
    messageId: string;
    type: MessageContentType;
    text?: string;
    media?: ZwizMediaAttachment;
    template?: ZwizTemplatePayload;
  };
}

export interface ZwizOutboundMessage {
  caseId: string;
  recipientId: string;
  channel: SocialChannel;
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
    template?: ZwizTemplatePayload;
    card?: ZwizTemplatePayload;
    carousel?: {
      items: ZwizCarouselColumn[];
    };
    quickReplies?: ZwizQuickReplyItem[];
  };
  metadata?: {
    agentId?: string;
    agentName?: string;
    sentAt?: string;
    notificationType?: string;
    sourceEvent?: string;
    [key: string]: any;
  };
  receivedAt: string;
}

export interface ZwizBotStateUpdate {
  userId: string;
  sessionId: string;
  caseId: string;
  botState: string;
  action: string;
  closedAt: string;
  closureReason?: string;
  receivedAt: string;
}

export interface QualtricsDistribution {
  distributionId: string;
  surveyId: string;
  caseId: string;
  caseNumber: string;
  businessUnit: string;
  queueId: string;
  channel: string;
  recipient: {
    customerId: string;
    name: string;
    channelUserId: string;
  };
  embeddedData: {
    agentId?: string;
    agentName?: string;
    closureTimestamp?: string;
    resolutionDurationSeconds?: number;
    caseCategory?: string;
    [key: string]: any;
  };
  receivedAt: string;
}

export interface QualtricsInboundWebhookPayload {
  eventId: string;
  surveyId: string;
  responseId: string;
  distributionId: string;
  caseId: string;
  submittedAt: string;
  metrics: {
    csatScore: number;
    npsScore: number;
    cesScore: number;
    ratingCategory?: string;
  };
  feedback?: {
    comment?: string;
    language?: string;
  };
  embeddedData?: {
    businessUnit?: string;
    queueId?: string;
    agentId?: string;
    [key: string]: any;
  };
}

export interface InjectedError {
  statusCode: number;
  count: number;
}

// ==========================================
// Courier Logistics Types (Phase 2 / Port 4040)
// ==========================================

export type CourierCarrier = 'KERRY' | 'FLASH' | 'CENTRAL_EXPRESS';

export type ShipmentStatus =
  | 'MANIFEST_CREATED'
  | 'PACKED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'FAILED';

export interface ShipmentRecipient {
  name: string;
  phone: string;
  address: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postalCode: string;
}

export interface ShipmentSender {
  name: string;
  phone: string;
  address: string;
}

export interface ShipmentParcel {
  weightKg: number;
  dimensions?: { width: number; length: number; height: number };
  declaredValue?: number;
  itemsCount?: number;
}

export interface ShipmentRecord {
  trackingNumber: string;
  carrier: CourierCarrier;
  orderNumber: string;
  quotationId?: string;
  caseId?: string;
  status: ShipmentStatus;
  sortingCode: string;
  serviceType: string;
  recipient: ShipmentRecipient;
  sender: ShipmentSender;
  parcel: ShipmentParcel;
  labelUrls: {
    a4: string;
    thermal4x6: string;
    json: string;
  };
  events: Array<{
    status: ShipmentStatus;
    location: string;
    notes?: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CapturedCourierWebhook {
  trackingNumber: string;
  carrier: CourierCarrier;
  status: ShipmentStatus;
  statusCode?: string;
  location?: string;
  notes?: string;
  description?: string;
  orderId?: string;
  estimatedDelivery?: string | null;
  timestamp: string;
  crmWebhookUrl: string;
  crmStatus: number;
  crmResponse: any;
  dispatchedAt: string;
}
