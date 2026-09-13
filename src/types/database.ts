/**
 * Database Types for Omnichannel Social Commerce CRM (Central Chat & Shop)
 * Milestone M1 - Relational Database Foundation (R5)
 */

// ==========================================
// 1. ENUMS
// ==========================================

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT' | 'AUDITOR';

export type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'LUNCH' | 'BREAK';

export type ChannelType = 'LINE' | 'FACEBOOK' | 'INSTAGRAM' | 'WEB';

export type BusinessUnit =
  | 'CENTRAL'
  | 'CDS'
  | 'CENTRAL_BEAUTY_CLUB'
  | 'MUJI'
  | 'SSP'
  | 'B2S';

export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type PriorityLevel = 'CRITICAL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export type MessageAuthorType = 'CUSTOMER' | 'AGENT' | 'SYSTEM' | 'BOT';

export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'INTERNAL_ONLY';

export type SurveyDispatchStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'SENT'
  | 'FAILED'
  | 'FAILED_RETRY'
  | 'EXEMPT'
  | 'SKIPPED'
  | 'RESPONDED';

export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PRINTED'
  | 'COMPLETED'
  | 'VOID'
  | 'CANCEL'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentMethod = 'CREDIT_CARD' | 'BANK_TRANSFER' | 'PROMPTPAY';

export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'DISCREPANCY'
  | 'REFUNDED';

export type POSTicketStatus =
  | 'UNRECONCILED'
  | 'UNMATCHED'
  | 'RECONCILED'
  | 'DISCREPANCY'
  | 'MANUALLY_MATCHED';

// ==========================================
// 2. CORE DATABASE MODEL INTERFACES
// ==========================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessUnits: BusinessUnit[];
  presence: PresenceStatus;
  maxChatCapacity: number;
  maxConcurrentChats: number;
  activeChatCount: number;
  createdAt: Date;
  updatedAt: Date;

  agentProfile?: AgentProfile | null;
  assignedCases?: Case[];
  sentMessages?: Message[];
  auditLogs?: AuditLog[];
  assignedQueues?: QueueMember[];
  csatResponses?: CSATResponse[];
  verifiedPayments?: PaymentTransaction[];
}

export interface AgentProfile {
  id: string;
  userId: string;
  role: UserRole;
  presence: PresenceStatus;
  maxConcurrentChats: number;
  activeChatCount: number;
  createdAt: Date;
  updatedAt: Date;

  user?: User;
}

export interface Queue {
  id: string;
  name: string;
  code: string;
  businessUnit: BusinessUnit;
  description: string | null;
  slaResponseMin: number;
  slaResolveMin: number;
  createdAt: Date;
  updatedAt: Date;

  members?: QueueMember[];
  cases?: Case[];
  surveyConfigs?: SurveyConfig[];
}

export interface QueueMember {
  id: string;
  queueId: string;
  userId: string;
  createdAt: Date;

  queue?: Queue;
  user?: User;
}

export interface Customer {
  id: string;
  externalId: string;
  lineUserId: string | null;
  fbPsid: string | null;
  igUsername: string | null;
  channel: ChannelType;
  displayName: string;
  name: string | null;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;

  cases?: Case[];
  sessions?: SessionTraffic[];
  quotations?: Quotation[];
  csatResponses?: CSATResponse[];
}

export interface SessionTraffic {
  id: string;
  sessionId: string;
  customerId: string;
  channel: ChannelType;
  inboundChannel?: ChannelType | null;
  inboundSource: string;
  pageId: string;
  businessUnit: BusinessUnit;
  startDateTime: Date;
  endDateTime: Date | null;
  createdAt: Date;

  customer?: Customer;
  cases?: Case[];
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  businessUnit: BusinessUnit;
  channel: ChannelType;
  pageId: string;
  page?: string | null;
  status: CaseStatus;
  priority: PriorityLevel;
  queueId: string;
  ownerId: string | null;
  customerId: string;
  sessionId: string | null;
  resolutionCategory: string | null;
  resolutionNotes: string | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  queue?: Queue;
  owner?: User | null;
  customer?: Customer;
  sessionTraffic?: SessionTraffic | null;
  messages?: Message[];
  auditLogs?: AuditLog[];
  surveyDispatches?: SurveyDispatch[];
  csatResponse?: CSATResponse | null;
  quotations?: Quotation[];
}

export interface Message {
  id: string;
  messageId: string | null;
  caseId: string;
  authorId: string | null;
  authorType: MessageAuthorType | null;
  senderId: string | null;
  senderName: string | null;
  direction: MessageDirection | null;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  mediaMetadata: Record<string, unknown> | null;
  isInternal: boolean;
  deliveryStatus: DeliveryStatus;
  zwizMessageId: string | null;
  createdAt: Date;

  case?: Case;
  author?: User | null;
}

export interface AuditLog {
  id: string;
  caseId?: string | null;
  actorId: string | null;
  actorName: string | null;
  action: string | null;
  actionType: string | null;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  timestamp: Date;

  case?: Case | null;
  actor?: User | null;
}

export interface SurveyConfig {
  id: string;
  queueId: string;
  businessUnit: BusinessUnit;
  qualtricsSurveyId: string;
  surveyId: string | null;
  isActive: boolean;
  cooldownHours: number;
  createdAt: Date;
  updatedAt: Date;

  queue?: Queue;
}

export interface SurveyDispatch {
  id: string;
  caseId: string;
  surveyId: string;
  distributionId: string | null;
  status: SurveyDispatchStatus;
  dispatchedAt: Date | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;

  case?: Case;
}

export interface CSATResponse {
  id: string;
  caseId: string;
  responseId: string | null;
  qualtricsResponseId: string | null;
  distributionId?: string | null;
  customerId: string | null;
  agentId: string | null;
  businessUnit: BusinessUnit | null;
  csatScore: number;
  npsScore: number | null;
  cesScore: number | null;
  comment: string | null;
  feedbackComments: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;

  case?: Case;
  customer?: Customer | null;
  agent?: User | null;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  caseId: string;
  customerId: string;
  businessUnit: BusinessUnit;
  status: QuotationStatus;
  subtotal: number | string;
  discountTotal: number | string;
  vatAmount: number | string;
  grandTotal: number | string;
  totalAmount?: number | string | null;
  paymentLinkUrl: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  printedAt: Date | null;
  isLocked: boolean;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;

  case?: Case;
  customer?: Customer;
  items?: QuotationItem[];
  payments?: PaymentTransaction[];
  posTickets?: POSTicket[];
  matchedPosTickets?: POSTicket[];
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  discount: number | string;
  totalPrice: number | string;
  createdAt: Date;

  quotation?: Quotation;
}

export interface PaymentTransaction {
  id: string;
  transactionNumber: string | null;
  quotationId: string;
  businessUnit: BusinessUnit | null;
  paymentMethod: PaymentMethod;
  amount: number | string;
  status: PaymentStatus;
  referenceNo: string | null;
  gatewayReference: string | null;
  slipUrl: string | null;
  slipVerifiedAt: Date | null;
  verifiedById: string | null;
  discrepancyNote: string | null;
  createdAt: Date;
  updatedAt: Date;

  quotation?: Quotation;
  verifiedBy?: User | null;
}

export interface POSBatchUpload {
  id: string;
  fileName: string;
  uploadedBy: string;
  totalRows: number;
  matchedRows: number;
  errorRows: number;
  createdAt: Date;

  tickets?: POSTicket[];
}

/**
 * POS Cash Register Ticket
 * Compound unique constraint: @@unique([storeBranchId, registerId, ticketNumber])
 */
export interface POSTicket {
  id: string;
  ticketNumber: string;
  quotationId: string | null;
  matchedQuotationId: string | null;
  registerId: string | null;
  cashierId: string | null;
  storeBranchId: string | null;
  posTerminalId: string | null;
  amount: number | string;
  saleDateTime: Date | null;
  status: POSTicketStatus;
  batchUploadId: string | null;
  createdAt: Date;
  updatedAt: Date;

  quotation?: Quotation | null;
  matchedQuotation?: Quotation | null;
  batchUpload?: POSBatchUpload | null;
}

/**
 * Compound unique key input for multi-branch retail POS ticket lookup
 * Matches @@unique([storeBranchId, registerId, ticketNumber])
 */
export interface POSTicketCompoundUniqueInput {
  storeBranchId: string;
  registerId: string;
  ticketNumber: string;
}

// ==========================================
// 3. COMPOSITE & RELATIONAL TYPES
// ==========================================

export interface CaseWithRelations extends Case {
  queue?: Queue;
  owner?: User | null;
  customer?: Customer;
  sessionTraffic?: SessionTraffic | null;
  messages?: Message[];
  auditLogs?: AuditLog[];
  surveyDispatches?: SurveyDispatch[];
  csatResponse?: CSATResponse | null;
  quotations?: (Quotation & {
    items?: QuotationItem[];
    payments?: PaymentTransaction[];
  })[];
}

export interface CustomerWithHistory extends Customer {
  cases?: Case[];
  sessions?: SessionTraffic[];
  quotations?: Quotation[];
  csatResponses?: CSATResponse[];
}

export interface QuotationWithDetails extends Quotation {
  items: QuotationItem[];
  payments: PaymentTransaction[];
  posTickets?: POSTicket[];
  case?: Case;
  customer?: Customer;
}

export interface QueueWithMembers extends Queue {
  members: (QueueMember & {
    user: User;
  })[];
  surveyConfigs: SurveyConfig[];
}

export interface UserWithProfileAndQueues extends User {
  agentProfile?: AgentProfile | null;
  assignedQueues?: (QueueMember & {
    queue: Queue;
  })[];
}

// ==========================================
// 4. DATA CREATION / DTO INTERFACES
// ==========================================

export interface CreateCustomerInput {
  externalId: string;
  channel: ChannelType;
  displayName: string;
  name?: string;
  lineUserId?: string;
  fbPsid?: string;
  igUsername?: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
}

export interface CreateCaseInput {
  caseNumber: string;
  title: string;
  businessUnit: BusinessUnit;
  channel: ChannelType;
  pageId: string;
  page?: string;
  priority?: PriorityLevel;
  queueId: string;
  customerId: string;
  ownerId?: string;
  sessionId?: string;
}

export interface CreateMessageInput {
  caseId: string;
  messageId?: string;
  authorId?: string;
  authorType?: MessageAuthorType;
  senderId?: string;
  senderName?: string;
  direction?: MessageDirection;
  type?: MessageType;
  content?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  mediaMetadata?: Record<string, unknown>;
  isInternal?: boolean;
}

export interface CreateQuotationInput {
  quotationNumber: string;
  caseId: string;
  customerId: string;
  businessUnit: BusinessUnit;
  items: {
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }[];
  shippingFee?: number;
  discountTotal?: number;
}

export interface CreateAuditLogInput {
  caseId?: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

export interface CreatePOSTicketInput {
  ticketNumber: string;
  storeBranchId?: string;
  registerId?: string;
  posTerminalId?: string;
  cashierId?: string;
  amount: number | string;
  quotationId?: string;
  matchedQuotationId?: string;
  batchUploadId?: string;
  saleDateTime?: Date;
  status?: POSTicketStatus;
}
