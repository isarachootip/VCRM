import { prisma } from '@/lib/db';
import {
  Case,
  CaseStatus,
  BusinessUnit,
  ChannelType,
  PriorityLevel,
  User,
  Queue,
  Customer,
} from '@prisma/client';
import { createAuditLog, formatAuditLog, FormattedAuditLog } from '@/lib/audit/logger';

// Re-export Prisma enums for convenience
export { CaseStatus, BusinessUnit, ChannelType, PriorityLevel };

/**
 * State machine allowed transitions map.
 * Invariants:
 *  - OPEN -> IN_PROGRESS, RESOLVED, CLOSED
 *  - IN_PROGRESS -> RESOLVED, CLOSED
 *  - RESOLVED -> IN_PROGRESS (reopen), CLOSED
 *  - CLOSED -> none (Terminal state lock)
 */
export const VALID_CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.OPEN]: [CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED, CaseStatus.CLOSED],
  [CaseStatus.IN_PROGRESS]: [CaseStatus.RESOLVED, CaseStatus.CLOSED],
  [CaseStatus.RESOLVED]: [CaseStatus.IN_PROGRESS, CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [], // Closed is terminal
};

// BU mapping for display and serialization
const BU_DISPLAY_MAP: Record<string, string> = {
  CENTRAL: 'Central',
  CDS: 'CDS',
  CENTRAL_BEAUTY_CLUB: 'Central Beauty Club',
  MUJI: 'Muji',
  SSP: 'SSP',
  B2S: 'B2S',
};

const BU_PARSE_MAP: Record<string, BusinessUnit> = {
  central: BusinessUnit.CENTRAL,
  cds: BusinessUnit.CDS,
  'central beauty club': BusinessUnit.CENTRAL_BEAUTY_CLUB,
  central_beauty_club: BusinessUnit.CENTRAL_BEAUTY_CLUB,
  muji: BusinessUnit.MUJI,
  ssp: BusinessUnit.SSP,
  b2s: BusinessUnit.B2S,
};

const CHANNEL_DISPLAY_MAP: Record<string, string> = {
  LINE: 'LINE',
  FACEBOOK: 'FB',
  INSTAGRAM: 'IG',
  WEB: 'WEB',
};

const CHANNEL_PARSE_MAP: Record<string, ChannelType> = {
  line: ChannelType.LINE,
  fb: ChannelType.FACEBOOK,
  facebook: ChannelType.FACEBOOK,
  ig: ChannelType.INSTAGRAM,
  instagram: ChannelType.INSTAGRAM,
  web: ChannelType.WEB,
};

const STATUS_PARSE_MAP: Record<string, CaseStatus> = {
  open: CaseStatus.OPEN,
  in_progress: CaseStatus.IN_PROGRESS,
  'in progress': CaseStatus.IN_PROGRESS,
  resolved: CaseStatus.RESOLVED,
  closed: CaseStatus.CLOSED,
};

const PRIORITY_PARSE_MAP: Record<string, PriorityLevel> = {
  critical: PriorityLevel.CRITICAL,
  urgent: PriorityLevel.URGENT,
  high: PriorityLevel.HIGH,
  medium: PriorityLevel.MEDIUM,
  low: PriorityLevel.LOW,
};

export function parseBusinessUnit(input?: string | null): BusinessUnit | undefined {
  if (!input) return undefined;
  const key = input.trim().toLowerCase();
  return BU_PARSE_MAP[key] || (BusinessUnit as any)[input.trim().toUpperCase()];
}

export function serializeBusinessUnit(bu: BusinessUnit | string): string {
  const upper = String(bu).toUpperCase();
  return BU_DISPLAY_MAP[upper] || String(bu);
}

export function parseChannel(input?: string | null): ChannelType | undefined {
  if (!input) return undefined;
  const key = input.trim().toLowerCase();
  return CHANNEL_PARSE_MAP[key] || (ChannelType as any)[input.trim().toUpperCase()];
}

export function serializeChannel(channel: ChannelType | string): string {
  const upper = String(channel).toUpperCase();
  return CHANNEL_DISPLAY_MAP[upper] || String(channel);
}

export function parseCaseStatus(input?: string | null): CaseStatus | undefined {
  if (!input) return undefined;
  const key = input.trim().toLowerCase();
  return STATUS_PARSE_MAP[key] || (CaseStatus as any)[input.trim().toUpperCase()];
}

export function parsePriority(input?: string | null): PriorityLevel | undefined {
  if (!input) return undefined;
  const key = input.trim().toLowerCase();
  return PRIORITY_PARSE_MAP[key] || (PriorityLevel as any)[input.trim().toUpperCase()];
}

/**
 * Validates whether transition from currentStatus to newStatus is permissible.
 */
export function validateStatusTransition(
  currentStatus: CaseStatus,
  newStatus: CaseStatus
): { valid: boolean; reason?: string } {
  if (currentStatus === newStatus) {
    return { valid: true };
  }

  if (currentStatus === CaseStatus.CLOSED) {
    return {
      valid: false,
      reason: `Case is closed and locked. Cannot reopen. Invalid status transition from ${currentStatus} to ${newStatus}`,
    };
  }

  const allowed = VALID_CASE_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      reason: `Invalid status transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { valid: true };
}

let globalCaseSequence = 0;

/**
 * Generates a unique monotonic sequential caseNumber.
 * Format: CAS-YYYY-XXXXX (e.g. CAS-2026-00042)
 */
export async function generateCaseNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `CAS-${currentYear}-`;

  try {
    if (globalCaseSequence === 0) {
      const latestCase = await prisma.case.findFirst({
        where: { caseNumber: { startsWith: yearPrefix } },
        orderBy: { createdAt: 'desc' },
        select: { caseNumber: true },
      });

      if (latestCase?.caseNumber) {
        const parts = latestCase.caseNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          globalCaseSequence = lastSeq;
        }
      } else {
        const count = await prisma.case.count();
        globalCaseSequence = count;
      }
    }

    globalCaseSequence++;
    let candidate = `${yearPrefix}${String(globalCaseSequence).padStart(5, '0')}`;

    // Verify candidate is not already in DB
    let exists = await prisma.case.findUnique({ where: { caseNumber: candidate }, select: { id: true } });
    while (exists) {
      globalCaseSequence++;
      candidate = `${yearPrefix}${String(globalCaseSequence).padStart(5, '0')}`;
      exists = await prisma.case.findUnique({ where: { caseNumber: candidate }, select: { id: true } });
    }

    return candidate;
  } catch {
    globalCaseSequence++;
    return `${yearPrefix}${String(globalCaseSequence).padStart(5, '0')}`;
  }
}

export interface CreateCaseInput {
  title?: string;
  businessUnit?: string | BusinessUnit;
  bu?: string | BusinessUnit;
  channel?: string | ChannelType;
  pageId?: string;
  pageName?: string;
  page?: string;
  priority?: string | PriorityLevel;
  queueId?: string;
  ownerId?: string | null;
  customerId?: string;
  customer?: {
    externalId?: string;
    customerId?: string;
    name?: string;
    displayName?: string;
    channelUserId?: string;
    avatarUrl?: string;
    phone?: string;
    email?: string;
    channel?: string | ChannelType;
  };
  sessionId?: string;
  session?: {
    sessionId?: string;
    sessionStart?: string | Date;
    inboundSource?: string;
    botState?: string;
  };
  status?: string | CaseStatus;
  resolutionCategory?: string;
  resolutionNotes?: string;
  actorId?: string;
  actorName?: string;
  message?: {
    type?: string;
    text?: string;
    content?: string;
    mediaUrl?: string;
    media?: any;
  };
  // Specialized E-Ordering (EOR) fields
  eorTicketNumber?: string;
  sellingStoreName?: string;
  sellingStoreStaffId?: string;
  eorMetadata?: any;
  // SLA & Monitoring fields
  lastCustomerMessageAt?: Date | string | null;
  lastAgentMessageAt?: Date | string | null;
  slaPendingFlag?: any;
  slaBreachedAt?: Date | string | null;
}

export interface ListCasesParams {
  businessUnit?: string;
  bu?: string;
  queueId?: string;
  team?: string;
  queueTeam?: string;
  status?: string;
  channel?: string;
  ownerId?: string;
  search?: string;
  q?: string;
  customerName?: string;
  phone?: string;
  lineUserId?: string;
  caseNumber?: string;
  quotationNumber?: string;
  ticketNumber?: string;
  trackingNumber?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  page?: number | string;
  limit?: number | string;
  orderBy?: 'updatedAt' | 'createdAt' | 'priority';
  orderDir?: 'asc' | 'desc';
  isVip?: boolean | string;
}

export interface StatusTransitionOptions {
  closureReason?: string;
  resolutionCategory?: string;
  resolutionNotes?: string;
  actorId?: string;
  actorName?: string;
}

export interface AssignCaseOptions {
  ownerId?: string | null;
  queueId?: string;
  priority?: PriorityLevel | string;
  businessUnit?: BusinessUnit | string;
  actorId?: string;
  actorName?: string;
}

/**
 * Format a message record for API outputs.
 */
export function formatMessage(msg: any) {
  if (!msg) return null;

  const meta = typeof msg.mediaMetadata === 'object' && msg.mediaMetadata !== null
    ? msg.mediaMetadata
    : (typeof msg.mediaMetadata === 'string'
        ? (() => {
            try {
              return JSON.parse(msg.mediaMetadata);
            } catch {
              return {};
            }
          })()
        : {});

  let rawText = '';
  let mediaUrl = msg.mediaUrl || meta.mediaUrl || meta.url || null;
  let fileName = msg.fileName || meta.fileName || null;
  let mimeType = msg.mimeType || meta.mimeType || null;
  let fileSize = msg.fileSize || meta.fileSize || null;
  let duration = meta.duration || null;
  let width = meta.width || null;
  let height = meta.height || null;

  if (typeof msg.content === 'string') {
    if (msg.content.startsWith('{') && msg.content.endsWith('}')) {
      try {
        const parsed = JSON.parse(msg.content);
        rawText = parsed.text ?? msg.content;
        if (parsed.mediaUrl) mediaUrl = parsed.mediaUrl;
        if (parsed.fileName) fileName = parsed.fileName;
        if (parsed.mimeType) mimeType = parsed.mimeType;
        if (parsed.fileSize) fileSize = parsed.fileSize;
        if (parsed.duration) duration = parsed.duration;
        if (parsed.width) width = parsed.width;
        if (parsed.height) height = parsed.height;
      } catch {
        rawText = msg.content;
      }
    } else {
      rawText = msg.content;
    }
  } else if (typeof msg.content === 'object' && msg.content !== null) {
    rawText = msg.content.text ?? '';
    if (msg.content.mediaUrl) mediaUrl = msg.content.mediaUrl;
    if (msg.content.fileName) fileName = msg.content.fileName;
    if (msg.content.mimeType) mimeType = msg.content.mimeType;
    if (msg.content.fileSize) fileSize = msg.content.fileSize;
    if (msg.content.duration) duration = msg.content.duration;
    if (msg.content.width) width = msg.content.width;
    if (msg.content.height) height = msg.content.height;
  }

  const mentions = Array.isArray(meta.mentions)
    ? meta.mentions
    : (typeof rawText === 'string'
        ? (rawText.match(/@([a-zA-Z0-9_-]+)/g)?.map((m: string) => m.substring(1)) || [])
        : []);

  let deliveryStatus = msg.deliveryStatus;
  if (msg.isInternal) {
    deliveryStatus = 'INTERNAL_ONLY';
  } else if (deliveryStatus === 'FAILED') {
    deliveryStatus = 'DELIVERY_FAILED';
  } else if (!deliveryStatus) {
    deliveryStatus = 'DELIVERED';
  }

  const deliveredAt = meta.deliveredAt || (
    deliveryStatus === 'DELIVERED'
      ? (msg.updatedAt instanceof Date
          ? msg.updatedAt.toISOString()
          : (msg.createdAt instanceof Date ? msg.createdAt.toISOString() : (msg.createdAt || new Date().toISOString())))
      : null
  );

  let messageType = meta.originalType || meta.type || msg.type || 'TEXT';
  if (
    messageType === 'AUDIO' ||
    meta.originalType === 'AUDIO' ||
    meta.type === 'AUDIO' ||
    mimeType?.startsWith('audio/') ||
    (duration !== null && duration !== undefined) ||
    fileName?.endsWith('.m4a') ||
    fileName?.endsWith('.mp3') ||
    fileName?.endsWith('.wav') ||
    fileName?.endsWith('.ogg') ||
    fileName?.endsWith('.aac')
  ) {
    messageType = 'AUDIO';
  }

  const contentObj: any = {
    text: rawText,
  };
  if (mediaUrl) contentObj.mediaUrl = mediaUrl;
  if (fileName) contentObj.fileName = fileName;
  if (mimeType) contentObj.mimeType = mimeType;
  if (fileSize !== null && fileSize !== undefined) contentObj.fileSize = fileSize;
  if (duration !== null && duration !== undefined) contentObj.duration = duration;
  if (width !== null && width !== undefined) contentObj.width = width;
  if (height !== null && height !== undefined) contentObj.height = height;

  return {
    id: msg.id,
    caseId: msg.caseId,
    type: messageType,
    content: contentObj,
    text: rawText,
    mediaUrl: mediaUrl || null,
    fileName: fileName || null,
    mimeType: mimeType || null,
    fileSize: fileSize || null,
    mediaMetadata: msg.mediaMetadata || null,
    isInternal: Boolean(msg.isInternal),
    deliveryStatus,
    deliveredAt: deliveredAt || null,
    senderId: msg.senderId || msg.authorId || (msg.isInternal ? 'agent_01' : 'customer'),
    senderType: msg.authorType || (msg.isInternal ? 'AGENT' : 'CUSTOMER'),
    authorId: msg.authorId || null,
    mentions,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
    updatedAt: msg.updatedAt instanceof Date ? msg.updatedAt.toISOString() : msg.updatedAt,
  };
}

/**
 * Normalizes and formats a Case record (and its relations) into the standardized API payload.
 */
export function formatCaseForResponse(targetCase: any) {
  if (!targetCase) return null;

  const rawBu = targetCase.businessUnit;
  const rawChannel = targetCase.channel;
  const buDisplay = serializeBusinessUnit(rawBu);
  const channelDisplay = serializeChannel(rawChannel);

  // Customer normalization
  const customerObj = targetCase.customer
    ? {
        id: targetCase.customer.id,
        customerId: targetCase.customer.id,
        externalId: targetCase.customer.externalId,
        channelUserId: targetCase.customer.externalId,
        name: targetCase.customer.name || targetCase.customer.displayName || 'Customer',
        displayName: targetCase.customer.displayName || targetCase.customer.name || 'Customer',
        avatarUrl: targetCase.customer.avatarUrl || null,
        phone: targetCase.customer.phone || null,
        email: targetCase.customer.email || null,
        channel: serializeChannel(targetCase.customer.channel || rawChannel),
        isVip: Boolean(targetCase.customer.isVip),
        vipTier: targetCase.customer.vipTier || null,
      }
    : {
        id: targetCase.customerId,
        customerId: targetCase.customerId,
        externalId: targetCase.customerId,
        channelUserId: targetCase.customerId,
        name: 'Customer',
        displayName: 'Customer',
        isVip: Boolean(targetCase.isVip),
        vipTier: null,
      };

  // Session normalization
  const sessionEndVal = targetCase.sessionTraffic?.endDateTime instanceof Date
    ? targetCase.sessionTraffic.endDateTime.toISOString()
    : (targetCase.sessionTraffic?.endDateTime || (targetCase.closedAt ? (targetCase.closedAt instanceof Date ? targetCase.closedAt.toISOString() : targetCase.closedAt) : null));

  const sessionObj = targetCase.sessionTraffic
    ? {
        id: targetCase.sessionTraffic.id,
        sessionId: targetCase.sessionTraffic.sessionId,
        sessionStart: targetCase.sessionTraffic.startDateTime instanceof Date
          ? targetCase.sessionTraffic.startDateTime.toISOString()
          : targetCase.sessionTraffic.startDateTime,
        sessionEnd: sessionEndVal,
        inboundSource: targetCase.sessionTraffic.inboundSource || 'ORGANIC_CHAT',
        channel: serializeChannel(targetCase.sessionTraffic.channel || rawChannel),
        botState: 'AGENT_HANDOFF',
      }
    : (targetCase.sessionId
        ? {
            sessionId: targetCase.sessionId,
            sessionStart: targetCase.createdAt instanceof Date ? targetCase.createdAt.toISOString() : targetCase.createdAt,
            sessionEnd: sessionEndVal,
            inboundSource: 'ORGANIC_CHAT',
            botState: 'AGENT_HANDOFF',
          }
        : null);

  const formattedLogs: FormattedAuditLog[] = (targetCase.auditLogs || []).map((log: any) => {
    const formatted = formatAuditLog(log);
    if (formatted.action === 'NOTE_ADDED' || log.action === 'NOTE_ADDED') {
      if (formatted.isInternal === undefined) {
        formatted.isInternal = true;
      }
    }
    return formatted;
  });
  const formattedMessages = (targetCase.messages || []).map(formatMessage);

  // Survey dispatch and CSAT metrics extraction
  const csat = targetCase.csatResponse;
  let latestDispatch: any = null;
  if (Array.isArray(targetCase.surveyDispatches) && targetCase.surveyDispatches.length > 0) {
    const sortedDispatches = [...targetCase.surveyDispatches].sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt || a.dispatchedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.dispatchedAt || 0).getTime();
      return timeB - timeA;
    });
    latestDispatch = sortedDispatches[0];
  }

  let surveyStatus: string | null = null;
  if (csat) {
    surveyStatus = 'RESPONDED';
  } else if (latestDispatch) {
    surveyStatus = latestDispatch.status || null;
  }

  const distributionId = csat?.distributionId || latestDispatch?.distributionId || null;
  const csatScore = csat?.csatScore ?? null;
  const npsScore = csat?.npsScore ?? null;
  const cesScore = csat?.cesScore ?? null;

  const rawSubmittedAt = csat?.submittedAt || csat?.completedAt;
  const csatSubmittedAt = rawSubmittedAt
    ? (rawSubmittedAt instanceof Date ? rawSubmittedAt.toISOString() : String(rawSubmittedAt))
    : null;

  const rawComment = csat?.comment || csat?.feedbackComments;
  const feedbackComment =
    rawComment !== undefined && rawComment !== null && String(rawComment).trim() !== ''
      ? String(rawComment)
      : null;

  const supervisorAlert = Boolean(
    csat && typeof csat.csatScore === 'number' && csat.csatScore <= 2
  );

  return {
    id: targetCase.id,
    caseNumber: targetCase.caseNumber,
    title: targetCase.title,
    businessUnit: buDisplay,
    bu: buDisplay,
    channel: channelDisplay,
    pageId: targetCase.pageId,
    pageName: targetCase.page || targetCase.pageName || targetCase.pageId,
    page: targetCase.page || targetCase.pageName || targetCase.pageId,
    status: targetCase.status,
    priority: targetCase.priority,
    queueId: targetCase.queueId,
    ownerId: targetCase.ownerId || null,
    customerId: targetCase.customerId,
    sessionId: targetCase.sessionId || null,
    resolutionCategory: targetCase.resolutionCategory || null,
    resolutionNotes: targetCase.resolutionNotes || null,
    // Specialized EOR fields
    eorTicketNumber: targetCase.eorTicketNumber || null,
    sellingStoreName: targetCase.sellingStoreName || null,
    sellingStoreStaffId: targetCase.sellingStoreStaffId || null,
    eorMetadata: targetCase.eorMetadata || null,
    // SLA & Monitoring fields
    lastCustomerMessageAt: targetCase.lastCustomerMessageAt
      ? (targetCase.lastCustomerMessageAt instanceof Date ? targetCase.lastCustomerMessageAt.toISOString() : targetCase.lastCustomerMessageAt)
      : null,
    lastAgentMessageAt: targetCase.lastAgentMessageAt
      ? (targetCase.lastAgentMessageAt instanceof Date ? targetCase.lastAgentMessageAt.toISOString() : targetCase.lastAgentMessageAt)
      : null,
    slaPendingFlag: targetCase.slaPendingFlag || 'NONE',
    slaBreachedAt: targetCase.slaBreachedAt
      ? (targetCase.slaBreachedAt instanceof Date ? targetCase.slaBreachedAt.toISOString() : targetCase.slaBreachedAt)
      : null,
    closureReason: targetCase.closureReason || null,
    idleWarningSentAt: targetCase.idleWarningSentAt
      ? (targetCase.idleWarningSentAt instanceof Date ? targetCase.idleWarningSentAt.toISOString() : targetCase.idleWarningSentAt)
      : null,
    isVip: Boolean(targetCase.isVip),
    queuePriority: targetCase.queuePriority ?? 0,
    firstResponseAt: targetCase.firstResponseAt instanceof Date ? targetCase.firstResponseAt.toISOString() : targetCase.firstResponseAt,
    resolvedAt: targetCase.resolvedAt instanceof Date ? targetCase.resolvedAt.toISOString() : targetCase.resolvedAt,
    closedAt: targetCase.closedAt instanceof Date ? targetCase.closedAt.toISOString() : targetCase.closedAt,
    createdAt: targetCase.createdAt instanceof Date ? targetCase.createdAt.toISOString() : targetCase.createdAt,
    updatedAt: targetCase.updatedAt instanceof Date ? targetCase.updatedAt.toISOString() : targetCase.updatedAt,
    customer: customerObj,
    session: sessionObj,
    sessionTraffic: sessionObj,
    queue: targetCase.queue
      ? {
          id: targetCase.queue.id,
          name: targetCase.queue.name,
          code: targetCase.queue.code,
          businessUnit: serializeBusinessUnit(targetCase.queue.businessUnit),
          team: (targetCase.queue as any).team || 'CHAT_AND_SHOP',
          routingAlgorithm: (targetCase.queue as any).routingAlgorithm || 'LEAST_ACTIVE',
        }
      : null,
    owner: targetCase.owner
      ? {
          id: targetCase.owner.id,
          name: targetCase.owner.name,
          email: targetCase.owner.email,
          role: targetCase.owner.role,
        }
      : null,
    messages: formattedMessages,
    auditLogs: formattedLogs,
    quotations: targetCase.quotations || [],
    surveyDispatches: targetCase.surveyDispatches || [],
    csatResponse: targetCase.csatResponse || null,
    surveyStatus,
    distributionId,
    csatScore,
    npsScore,
    cesScore,
    csatSubmittedAt,
    feedbackComment,
    supervisorAlert,
  };
}

/**
 * Creates a new Case entity along with customer relation, queue routing, and initial audit log.
 */
export async function createCase(input: CreateCaseInput) {
  const parsedBU = parseBusinessUnit(input.businessUnit || input.bu) || BusinessUnit.CENTRAL;
  const parsedChannel = parseChannel(input.channel) || ChannelType.LINE;
  const parsedPriority = parsePriority(input.priority) || PriorityLevel.MEDIUM;
  const parsedStatus = parseCaseStatus(input.status) || CaseStatus.OPEN;

  // 1. Resolve or create Customer
  let customerId = input.customerId;
  const extId = input.customer?.externalId || input.customer?.channelUserId || (customerId ? customerId : null);

  let customerRecord: Customer | null = null;
  if (customerId) {
    customerRecord = await prisma.customer.findUnique({ where: { id: customerId } });
  }
  if (!customerRecord && extId) {
    customerRecord = await prisma.customer.findUnique({ where: { externalId: extId } });
  }

  if (!customerRecord) {
    const resolvedExtId = extId || `cust_ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const displayName = input.customer?.displayName || input.customer?.name || 'Customer';
    customerRecord = await prisma.customer.create({
      data: {
        externalId: resolvedExtId,
        channel: parsedChannel,
        displayName,
        name: displayName,
        avatarUrl: input.customer?.avatarUrl || null,
        phone: input.customer?.phone || null,
        email: input.customer?.email || null,
      },
    });
  }

  customerId = customerRecord.id;

  // 2. Resolve Queue Routing
  let queueId = input.queueId;
  let targetQueue: Queue | null = null;

  if (queueId) {
    targetQueue = await prisma.queue.findFirst({
      where: { OR: [{ id: queueId }, { code: queueId }] },
    });
    if (!targetQueue) {
      try {
        targetQueue = await prisma.queue.create({
          data: {
            id: queueId,
            code: queueId,
            name: queueId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            businessUnit: parsedBU,
            slaResponseMin: 15,
            slaResolveMin: 120,
          },
        });
      } catch {
        targetQueue = await prisma.queue.findFirst({
          where: { OR: [{ id: queueId }, { code: queueId }] },
        });
      }
    }
  }

  if (!targetQueue) {
    // Route to BU default queue
    targetQueue = await prisma.queue.findFirst({
      where: { businessUnit: parsedBU },
    });
  }

  if (!targetQueue) {
    // Fallback to any queue
    targetQueue = await prisma.queue.findFirst();
  }

  if (!targetQueue) {
    // If database has no queues seeded, create default queue
    targetQueue = await prisma.queue.create({
      data: {
        id: `queue_${parsedBU.toLowerCase()}_default`,
        name: `${serializeBusinessUnit(parsedBU)} General Queue`,
        code: `queue_${parsedBU.toLowerCase()}_default`,
        businessUnit: parsedBU,
        slaResponseMin: 15,
        slaResolveMin: 120,
      },
    });
  }

  queueId = targetQueue.id;

  // 3. Resolve Session Traffic
  const rawSessionId = input.sessionId || input.session?.sessionId;
  let sessionTrafficId: string | null = null;
  if (rawSessionId) {
    let sessionRecord = await prisma.sessionTraffic.findUnique({
      where: { sessionId: rawSessionId },
    });
    if (!sessionRecord) {
      sessionRecord = await prisma.sessionTraffic.create({
        data: {
          sessionId: rawSessionId,
          customerId,
          channel: parsedChannel,
          inboundSource: input.session?.inboundSource || 'ORGANIC_CHAT',
          pageId: input.pageId || 'default_page',
          businessUnit: parsedBU,
          startDateTime: input.session?.sessionStart ? new Date(input.session.sessionStart) : new Date(),
        },
      });
    }
    sessionTrafficId = sessionRecord.sessionId;
  }

  // 4. Generate Case Number
  const caseNumber = await generateCaseNumber();

  // 5. Generate Title
  const title = input.title
    ? input.title
    : (input.message?.text
        ? (input.message.text.length > 60 ? input.message.text.substring(0, 60) + '...' : input.message.text)
        : `Inquiry for ${serializeBusinessUnit(parsedBU)}`);

  // 6. Create Case Record
  const newCase = await prisma.case.create({
    data: {
      caseNumber,
      title,
      businessUnit: parsedBU,
      channel: parsedChannel,
      pageId: input.pageId || 'default_page',
      page: input.page || input.pageName || input.pageId || 'Default Page',
      status: parsedStatus,
      priority: parsedPriority,
      queueId,
      ownerId: input.ownerId || null,
      customerId,
      sessionId: sessionTrafficId,
      resolutionCategory: input.resolutionCategory || null,
      resolutionNotes: input.resolutionNotes || null,
      eorTicketNumber: input.eorTicketNumber || null,
      sellingStoreName: input.sellingStoreName || null,
      sellingStoreStaffId: input.sellingStoreStaffId || null,
      eorMetadata: input.eorMetadata !== undefined ? input.eorMetadata : undefined,
      lastCustomerMessageAt: input.lastCustomerMessageAt
        ? new Date(input.lastCustomerMessageAt)
        : (input.message ? new Date() : null),
      lastAgentMessageAt: input.lastAgentMessageAt ? new Date(input.lastAgentMessageAt) : null,
      slaPendingFlag: (input.slaPendingFlag as any) || 'NONE',
      slaBreachedAt: input.slaBreachedAt ? new Date(input.slaBreachedAt) : null,
      isVip: Boolean(customerRecord.isVip),
      queuePriority: customerRecord.isVip ? 100 : 0,
    },
    include: {
      customer: true,
      sessionTraffic: true,
      queue: true,
      owner: true,
    },
  });

  // 7. Insert Initial Audit Log: CASE_CREATED
  await createAuditLog({
    caseId: newCase.id,
    actorId: input.actorId || null,
    actorName: input.actorName || 'SYSTEM',
    action: 'CASE_CREATED',
    actionType: 'CASE_CREATED',
    entityType: 'Case',
    entityId: newCase.id,
    field: 'status',
    oldValue: null as any,
    newValue: parsedStatus,
    details: JSON.stringify({
      caseNumber,
      channel: serializeChannel(parsedChannel),
      businessUnit: serializeBusinessUnit(parsedBU),
      queueId,
    }),
  });

  // 8. If initial message was supplied, store it
  if (input.message && (input.message.text || input.message.content || input.message.mediaUrl || (input.message as any).media?.url)) {
    const rawContent = input.message.content;
    const text = typeof rawContent === 'string'
      ? rawContent
      : (input.message.text || (rawContent as any)?.text || '');
    const mediaUrl = input.message.mediaUrl || (input.message as any).media?.url || (rawContent as any)?.mediaUrl || null;
    const fileName = (input.message as any).fileName || (input.message as any).media?.fileName || (rawContent as any)?.fileName || null;
    const mimeType = (input.message as any).mimeType || (input.message as any).media?.mimeType || (rawContent as any)?.mimeType || null;
    const fileSize = (input.message as any).fileSize || (input.message as any).media?.fileSize || (rawContent as any)?.fileSize || null;
    const rawMsgType = input.message.type || (mediaUrl ? 'IMAGE' : 'TEXT');

    await prisma.message.create({
      data: {
        caseId: newCase.id,
        authorId: null,
        authorType: 'CUSTOMER',
        type: rawMsgType === 'AUDIO' ? 'TEXT' : (rawMsgType as any),
        content: text,
        mediaUrl,
        fileName,
        mimeType,
        fileSize: fileSize ? Number(fileSize) : null,
        mediaMetadata: {
          originalType: rawMsgType,
          ...((input.message as any).mediaMetadata || {}),
          ...((input.message as any).media ? { ...(input.message as any).media } : {}),
        },
        isInternal: false,
        deliveryStatus: 'DELIVERED',
      },
    });
  }

  // Reload full case with relations
  const fullCase = await getCaseById(newCase.id);
  return fullCase;
}

/**
 * Fetches a single Case with all related entities:
 * customer, session, queue, owner, messages (asc), auditLogs (desc), quotations.
 */
export async function getCaseById(id: string) {
  const caseRecord = await prisma.case.findFirst({
    where: {
      OR: [{ id }, { caseNumber: id }],
    },
    include: {
      customer: true,
      sessionTraffic: true,
      queue: true,
      owner: true,
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      auditLogs: {
        orderBy: { timestamp: 'desc' },
      },
      quotations: {
        include: { items: true },
      },
      surveyDispatches: true,
      csatResponse: true,
    },
  });

  if (!caseRecord) return null;
  return formatCaseForResponse(caseRecord);
}

/**
 * Lists cases with filtering, search, pagination, and sorting.
 */
export async function listCases(params: ListCasesParams) {
  const page = Math.max(1, parseInt(String(params.page || '1'), 10));
  const limit = Math.max(1, Math.min(100, parseInt(String(params.limit || '20'), 10)));
  const skip = (page - 1) * limit;

  const where: any = {};

  // Business Unit filter
  const buFilter = parseBusinessUnit(params.businessUnit || params.bu);
  if (buFilter) {
    where.businessUnit = buFilter;
  }

  // Queue filter
  if (params.queueId) {
    where.OR = [
      { queueId: params.queueId },
      { queue: { code: params.queueId } },
    ];
  }

  // Queue Team filter
  const teamParam = params.team || params.queueTeam;
  if (teamParam) {
    const rawTeam = String(teamParam).trim().toUpperCase();
    const mappedTeam = rawTeam === 'EOR' ? 'E_ORDERING' : rawTeam;
    where.queue = {
      ...(where.queue || {}),
      team: mappedTeam as any,
    };
  }

  // Status filter
  const statusFilter = parseCaseStatus(params.status);
  if (statusFilter) {
    where.status = statusFilter;
  }

  // Channel filter
  const channelFilter = parseChannel(params.channel);
  if (channelFilter) {
    where.channel = channelFilter;
  }

  // Owner filter
  if (params.ownerId) {
    where.ownerId = params.ownerId;
  }

  // VIP filter
  if (params.isVip !== undefined) {
    where.isVip = params.isVip === true || params.isVip === 'true';
  }

  // Multi-Criteria Combined Search filter (params.search or params.q)
  const searchQuery = (params.search || params.q || '').trim();
  if (searchQuery) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { caseNumber: { contains: searchQuery, mode: 'insensitive' } },
        { customer: { displayName: { contains: searchQuery, mode: 'insensitive' } } },
        { customer: { name: { contains: searchQuery, mode: 'insensitive' } } },
        { customer: { phone: { contains: searchQuery, mode: 'insensitive' } } },
        { customer: { lineUserId: { contains: searchQuery, mode: 'insensitive' } } },
        { customer: { externalId: { contains: searchQuery, mode: 'insensitive' } } },
        { quotations: { some: { quotationNumber: { contains: searchQuery, mode: 'insensitive' } } } },
        { quotations: { some: { posTicketNumber: { contains: searchQuery, mode: 'insensitive' } } } },
        { quotations: { some: { posTickets: { some: { ticketNumber: { contains: searchQuery, mode: 'insensitive' } } } } } },
        { messages: { some: { content: { contains: searchQuery, mode: 'insensitive' } } } },
        { resolutionNotes: { contains: searchQuery, mode: 'insensitive' } },
        { sessionId: { contains: searchQuery, mode: 'insensitive' } },
      ],
    });
  }

  // Field-specific search criteria
  if (params.customerName && params.customerName.trim()) {
    const cName = params.customerName.trim();
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { customer: { displayName: { contains: cName, mode: 'insensitive' } } },
        { customer: { name: { contains: cName, mode: 'insensitive' } } },
      ],
    });
  }

  if (params.phone && params.phone.trim()) {
    const phone = params.phone.trim();
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { customer: { phone: { contains: phone, mode: 'insensitive' } } },
        { messages: { some: { content: { contains: phone, mode: 'insensitive' } } } },
      ],
    });
  }

  if (params.lineUserId && params.lineUserId.trim()) {
    const lineId = params.lineUserId.trim();
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { customer: { lineUserId: { contains: lineId, mode: 'insensitive' } } },
        { customer: { externalId: { contains: lineId, mode: 'insensitive' } } },
      ],
    });
  }

  if (params.caseNumber && params.caseNumber.trim()) {
    where.caseNumber = { contains: params.caseNumber.trim(), mode: 'insensitive' };
  }

  if (params.quotationNumber && params.quotationNumber.trim()) {
    const qNum = params.quotationNumber.trim();
    where.AND = where.AND || [];
    where.AND.push({
      quotations: {
        some: { quotationNumber: { contains: qNum, mode: 'insensitive' } },
      },
    });
  }

  if (params.ticketNumber && params.ticketNumber.trim()) {
    const tNum = params.ticketNumber.trim();
    where.AND = where.AND || [];
    where.AND.push({
      quotations: {
        some: {
          OR: [
            { posTicketNumber: { contains: tNum, mode: 'insensitive' } },
            { posTickets: { some: { ticketNumber: { contains: tNum, mode: 'insensitive' } } } },
          ],
        },
      },
    });
  }

  if (params.trackingNumber && params.trackingNumber.trim()) {
    const track = params.trackingNumber.trim();
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { resolutionNotes: { contains: track, mode: 'insensitive' } },
        { title: { contains: track, mode: 'insensitive' } },
      ],
    });
  }

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
  }

  // Order sorting: Priority order puts VIP cases (queuePriority: 100) first
  let orderBy: any = [{ queuePriority: 'desc' }, { updatedAt: 'desc' }];
  if (params.orderBy === 'createdAt') {
    orderBy = [{ queuePriority: 'desc' }, { createdAt: params.orderDir === 'asc' ? 'asc' : 'desc' }];
  } else if (params.orderBy === 'priority') {
    orderBy = [{ queuePriority: 'desc' }, { priority: 'asc' }, { updatedAt: 'desc' }];
  } else {
    orderBy = [{ queuePriority: 'desc' }, { updatedAt: params.orderDir === 'asc' ? 'asc' : 'desc' }];
  }

  const [total, records] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        customer: true,
        sessionTraffic: true,
        queue: true,
        owner: true,
        messages: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
        quotations: true,
        surveyDispatches: true,
        csatResponse: true,
      },
    }),
  ]);

  const formattedCases = records.map(formatCaseForResponse);

  return {
    cases: formattedCases,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Transitions the status of a Case using the state machine engine.
 * Records STATUS_CHANGED in AuditLog, manages timestamps, and validates transition legality.
 */
export async function transitionCaseStatus(
  id: string,
  newStatusInput: string | CaseStatus,
  options: StatusTransitionOptions = {}
) {
  const newStatus = parseCaseStatus(newStatusInput);
  if (!newStatus) {
    throw new Error(`Invalid status: ${newStatusInput}`);
  }

  const existingCase = await prisma.case.findFirst({
    where: { OR: [{ id }, { caseNumber: id }] },
    include: { sessionTraffic: true },
  });

  if (!existingCase) {
    throw new Error(`Case ${id} not found`);
  }

  const currentStatus = existingCase.status;

  // 1. Validate status transition
  const validation = validateStatusTransition(currentStatus, newStatus);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // 2. Check idempotent no-op
  if (currentStatus === newStatus) {
    const caseData = await getCaseById(existingCase.id);
    return {
      case: caseData,
      idempotent: true,
    };
  }

  // 3. Prepare update data & timestamp management
  const now = new Date();
  const updateData: any = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === CaseStatus.RESOLVED) {
    updateData.resolvedAt = now;
    if (options.resolutionCategory) updateData.resolutionCategory = options.resolutionCategory;
    if (options.resolutionNotes) updateData.resolutionNotes = options.resolutionNotes;
  } else if (currentStatus === CaseStatus.RESOLVED && newStatus === CaseStatus.IN_PROGRESS) {
    // Reopen clears resolvedAt timestamp
    updateData.resolvedAt = null;
  }

  if (newStatus === CaseStatus.CLOSED) {
    updateData.closedAt = now;
    if (options.resolutionCategory) updateData.resolutionCategory = options.resolutionCategory;
    if (options.resolutionNotes) updateData.resolutionNotes = options.resolutionNotes;

    // End session traffic if attached
    if (existingCase.sessionId) {
      try {
        await prisma.sessionTraffic.update({
          where: { sessionId: existingCase.sessionId },
          data: { endDateTime: now },
        });
      } catch {
        // Ignore if session record missing
      }
    }
  }

  // 4. Update Case in DB
  await prisma.case.update({
    where: { id: existingCase.id },
    data: updateData,
  });

  // 5. Create AuditLog entry
  await createAuditLog({
    caseId: existingCase.id,
    actorId: options.actorId || null,
    actorName: options.actorName || 'SYSTEM',
    action: 'STATUS_CHANGED',
    actionType: 'STATUS_CHANGE',
    entityType: 'Case',
    entityId: existingCase.id,
    field: 'status',
    oldValue: currentStatus,
    newValue: newStatus,
    details: JSON.stringify({
      oldStatus: currentStatus,
      newStatus,
      closureReason: options.closureReason || null,
      resolutionCategory: options.resolutionCategory || null,
      resolutionNotes: options.resolutionNotes || null,
    }),
  });

  const updatedCase = await getCaseById(existingCase.id);
  return {
    case: updatedCase,
    idempotent: false,
  };
}

/**
 * Assigns case to an agent (ownerId) or transfers to another queue (queueId).
 * Supports priority updates and business unit reassignment.
 * Records OWNER_ASSIGNED / QUEUE_TRANSFERRED / PRIORITY_CHANGED in AuditLog.
 */
export async function assignCase(
  id: string,
  options: AssignCaseOptions
) {
  const existingCase = await prisma.case.findFirst({
    where: { OR: [{ id }, { caseNumber: id }] },
  });

  if (!existingCase) {
    throw new Error(`Case ${id} not found`);
  }

  // Strict terminal lock on CLOSED cases (Tier 5 Remediation)
  if (existingCase.status === CaseStatus.CLOSED || String(existingCase.status).toUpperCase() === 'CLOSED') {
    throw new Error('Cannot modify or assign a closed case');
  }

  const updateData: any = {
    updatedAt: new Date(),
  };

  const auditLogsToCreate: Array<Parameters<typeof createAuditLog>[0]> = [];

  // 1. Owner Assignment
  if (options.ownerId !== undefined) {
    if (options.ownerId !== null && options.ownerId !== '') {
      // Validate owner exists
      const user = await prisma.user.findUnique({
        where: { id: options.ownerId },
      });
      if (!user) {
        // Also check if ownerId is username/email
        const userByEmail = await prisma.user.findFirst({
          where: { OR: [{ email: options.ownerId }, { name: options.ownerId }] },
        });
        if (!userByEmail) {
          throw new Error(`User ${options.ownerId} not found`);
        }
        options.ownerId = userByEmail.id;
      }
    }

    const previousOwnerId = existingCase.ownerId;
    updateData.ownerId = options.ownerId || null;

    auditLogsToCreate.push({
      caseId: existingCase.id,
      actorId: options.actorId || null,
      actorName: options.actorName || 'SYSTEM',
      action: 'OWNER_ASSIGNED',
      actionType: 'OWNER_CHANGED',
      entityType: 'Case',
      entityId: existingCase.id,
      field: 'ownerId',
      oldValue: previousOwnerId || 'unassigned',
      newValue: options.ownerId || 'unassigned',
      details: JSON.stringify({
        ownerId: options.ownerId || null,
        previousOwnerId: previousOwnerId || null,
      }),
    });
  }

  // 2. Queue Transfer
  if (options.queueId !== undefined) {
    let queue = await prisma.queue.findFirst({
      where: { OR: [{ id: options.queueId }, { code: options.queueId }] },
    });
    if (!queue) {
      const buForQueue = (options.businessUnit ? parseBusinessUnit(options.businessUnit) : null) || existingCase.businessUnit;
      try {
        queue = await prisma.queue.create({
          data: {
            id: options.queueId,
            code: options.queueId,
            name: options.queueId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            businessUnit: buForQueue,
            slaResponseMin: 15,
            slaResolveMin: 120,
          },
        });
      } catch {
        queue = await prisma.queue.findFirst({
          where: { OR: [{ id: options.queueId }, { code: options.queueId }] },
        });
      }
    }
    if (!queue) {
      throw new Error(`Queue ${options.queueId} not found`);
    }

    const previousQueueId = existingCase.queueId;
    updateData.queueId = queue.id;

    if (options.businessUnit === undefined && queue.businessUnit) {
      updateData.businessUnit = queue.businessUnit;
    }

    auditLogsToCreate.push({
      caseId: existingCase.id,
      actorId: options.actorId || null,
      actorName: options.actorName || 'SYSTEM',
      action: 'QUEUE_TRANSFERRED',
      actionType: 'QUEUE_TRANSFER',
      entityType: 'Case',
      entityId: existingCase.id,
      field: 'queueId',
      oldValue: previousQueueId,
      newValue: queue.id,
      details: JSON.stringify({
        queueId: queue.id,
        queueCode: queue.code,
        previousQueueId,
      }),
    });
  }

  // 3. Priority update
  if (options.priority !== undefined) {
    const parsedPriority = parsePriority(options.priority);
    if (!parsedPriority) {
      throw new Error(`Invalid priority: ${options.priority}`);
    }
    const previousPriority = existingCase.priority;
    updateData.priority = parsedPriority;

    auditLogsToCreate.push({
      caseId: existingCase.id,
      actorId: options.actorId || null,
      actorName: options.actorName || 'SYSTEM',
      action: 'PRIORITY_CHANGED',
      actionType: 'PRIORITY_UPDATE',
      entityType: 'Case',
      entityId: existingCase.id,
      field: 'priority',
      oldValue: previousPriority,
      newValue: parsedPriority,
    });
  }

  // 4. Business Unit update
  if (options.businessUnit !== undefined) {
    const parsedBU = parseBusinessUnit(options.businessUnit);
    if (!parsedBU) {
      throw new Error(`Invalid businessUnit: ${options.businessUnit}`);
    }
    const previousBU = existingCase.businessUnit;
    updateData.businessUnit = parsedBU;

    auditLogsToCreate.push({
      caseId: existingCase.id,
      actorId: options.actorId || null,
      actorName: options.actorName || 'SYSTEM',
      action: 'BU_TRANSFERRED',
      actionType: 'BU_CHANGE',
      entityType: 'Case',
      entityId: existingCase.id,
      field: 'businessUnit',
      oldValue: previousBU,
      newValue: parsedBU,
    });
  }

  // Update Case
  await prisma.case.update({
    where: { id: existingCase.id },
    data: updateData,
  });

  // Record all audit logs
  for (const logInput of auditLogsToCreate) {
    await createAuditLog(logInput);
  }

  const updatedCase = await getCaseById(existingCase.id);
  return {
    case: updatedCase,
  };
}
