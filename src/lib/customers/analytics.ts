/**
 * Customer 360 & Behavioral Analytics Service (R5 - Phase 2)
 * Path: src/lib/customers/analytics.ts
 *
 * Implements:
 * - Multi-channel identity linking (LINE ID, FB PSID, IG handle, Phone)
 * - Deterministic customer deduplication & merge algorithm
 * - Real-time Lifetime Value (LTV) calculation
 * - Real-time Average Order Value (AOV) calculation (division-by-zero protected)
 * - Purchase frequency metric (orders per 30 days)
 * - Algorithmic preferred communication channel identification
 * - Normalized Customer Engagement Score (CES, 0-100 composite index)
 * - Loyalty tier classification (PLATINUM, GOLD, SILVER, BRONZE)
 */

import { prisma } from '@/lib/db';
import { QuotationStatus, ChannelType } from '@prisma/client';
import { createAuditLog } from '@/lib/audit/logger';

export type LoyaltyTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';

export interface Customer360Profile {
  id: string;
  externalId: string;
  displayName: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  channel: string;
  lineUserId: string | null;
  fbPsid: string | null;
  igUsername: string | null;
  the1CardNumber: string | null;
  the1Points: number;
  the1Tier: string;

  // Behavioral Analytics Metrics
  ltv: number;
  aov: number;
  totalOrders: number;
  paidOrderCount: number;
  purchaseFrequency: number;
  preferredChannel: string;
  customerEngagementScore: number;
  loyaltyTier: LoyaltyTier;

  // Activity Dates
  customerAgeDays: number;
  daysSinceLastActivity: number;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Detailed History
  orderHistory: Array<{
    id: string;
    quotationNumber: string;
    status: string;
    grandTotal: number;
    businessUnit: string;
    createdAt: string;
    issuedAt: string | null;
  }>;
  caseCount: number;
  sessionCount: number;
  avgCsat: number | null;
}

export interface LinkIdentityInput {
  customerId?: string;
  phone?: string;
  lineUserId?: string;
  fbPsid?: string;
  igUsername?: string;
  displayName?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  the1CardNumber?: string;
  the1Mobile?: string;
  channel?: ChannelType | string;
  actorId?: string;
}

// =========================================================================
// Mathematical Calculation Helpers
// =========================================================================

/**
 * 1. Calculate Lifetime Value (LTV):
 * Sum of grandTotal for all paid, printed, or completed quotations.
 */
export function calculateLtv(quotations: any[]): number {
  if (!Array.isArray(quotations) || quotations.length === 0) {
    return 0.0;
  }

  const eligibleStatuses: QuotationStatus[] = [QuotationStatus.PAID, QuotationStatus.PRINTED, QuotationStatus.COMPLETED];

  const total = quotations
    .filter((q) => eligibleStatuses.includes(q.status))
    .reduce((sum, q) => sum + Number(q.grandTotal || 0), 0);

  return Math.round(total * 100) / 100;
}

/**
 * 2. Calculate Average Order Value (AOV):
 * LTV / N_paid (0.00 if N_paid == 0, preventing division by zero).
 */
export function calculateAov(ltv: number, paidOrderCount: number): number {
  if (!paidOrderCount || paidOrderCount <= 0 || ltv <= 0) {
    return 0.0;
  }
  return Math.round((ltv / paidOrderCount) * 100) / 100;
}

/**
 * 3. Calculate Purchase Frequency:
 * Orders per 30-day period = N_paid / max(1, customerAgeDays / 30).
 */
export function calculatePurchaseFrequency(paidOrderCount: number, createdAt: Date | string): number {
  if (!paidOrderCount || paidOrderCount <= 0) {
    return 0.0;
  }

  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.max(1, Math.floor((now.getTime() - created.getTime()) / (86400 * 1000)));

  const periodsOf30Days = Math.max(1, diffDays / 30);
  const freq = paidOrderCount / periodsOf30Days;

  return Math.round(freq * 100) / 100;
}

/**
 * 4. Determine Preferred Communication Channel:
 * Identifies the dominant communication channel by interaction volume,
 * resolving ties with the most recent interaction timestamp.
 */
export function determinePreferredChannel(
  cases: any[] = [],
  sessions: any[] = [],
  defaultChannel = 'LINE'
): string {
  const channelCounts: Record<string, { count: number; latestAt: number }> = {
    LINE: { count: 0, latestAt: 0 },
    FACEBOOK: { count: 0, latestAt: 0 },
    INSTAGRAM: { count: 0, latestAt: 0 },
    WEB: { count: 0, latestAt: 0 },
  };

  const normalizeChannel = (ch?: string | null): string => {
    if (!ch) return 'LINE';
    const c = ch.toUpperCase().trim();
    if (c === 'FB' || c === 'FACEBOOK') return 'FACEBOOK';
    if (c === 'IG' || c === 'INSTAGRAM') return 'INSTAGRAM';
    if (c === 'WEB' || c === 'WEBSITE' || c === 'EOR') return 'WEB';
    return 'LINE';
  };

  // Tally sessions
  for (const s of sessions) {
    const norm = normalizeChannel(s.channel || s.inboundChannel);
    if (!channelCounts[norm]) channelCounts[norm] = { count: 0, latestAt: 0 };
    channelCounts[norm].count += 1;
    const time = new Date(s.startDateTime || s.createdAt).getTime();
    if (time > channelCounts[norm].latestAt) {
      channelCounts[norm].latestAt = time;
    }
  }

  // Tally cases
  for (const c of cases) {
    const norm = normalizeChannel(c.channel);
    if (!channelCounts[norm]) channelCounts[norm] = { count: 0, latestAt: 0 };
    channelCounts[norm].count += 1;
    const time = new Date(c.createdAt).getTime();
    if (time > channelCounts[norm].latestAt) {
      channelCounts[norm].latestAt = time;
    }
  }

  // Select channel with maximum count; tie-breaker: largest latestAt
  let bestChannel = defaultChannel.toUpperCase();
  let maxCount = -1;
  let latestTime = -1;

  for (const [ch, info] of Object.entries(channelCounts)) {
    if (info.count > maxCount || (info.count === maxCount && info.latestAt > latestTime)) {
      maxCount = info.count;
      latestTime = info.latestAt;
      bestChannel = ch;
    }
  }

  return bestChannel;
}

/**
 * 5. Calculate Customer Engagement Score (CES):
 * Normalized 0-100 composite index combining recency, frequency, monetary value, and CSAT:
 * CES = round(min(100, 0.25 * S_recency + 0.25 * S_frequency + 0.30 * S_monetary + 0.20 * S_csat))
 */
export function calculateCustomerEngagementScore(params: {
  daysSinceLastActivity: number;
  sessionCount: number;
  paidOrderCount: number;
  ltv: number;
  csatScores: number[];
}): { score: number; tier: LoyaltyTier } {
  const { daysSinceLastActivity, sessionCount, paidOrderCount, ltv, csatScores } = params;

  // Recency Score (0-100): decays to 0 over 90 days of silence
  const sRecency = 100 * Math.max(0, 1 - Math.min(daysSinceLastActivity, 90) / 90);

  // Frequency Score (0-100): 10 pts per session + 15 pts per paid order, capped at 100
  const sFrequency = Math.min(100, sessionCount * 10 + paidOrderCount * 15);

  // Monetary Score (0-100): ฿50,000 net spend achieves maximum 100
  const sMonetary = Math.min(100, (ltv / 50000) * 100);

  // CSAT Score (0-100): avg CSAT / 5 * 100 (defaults to 70.0 baseline if customer hasn't completed survey)
  let sCsat = 70.0;
  if (csatScores && csatScores.length > 0) {
    const validScores = csatScores.filter((s) => typeof s === 'number' && s > 0 && s <= 5);
    if (validScores.length > 0) {
      const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      sCsat = (avg / 5) * 100;
    }
  }

  // Composite CES
  const rawScore = 0.25 * sRecency + 0.25 * sFrequency + 0.3 * sMonetary + 0.2 * sCsat;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Determine Loyalty Tier:
  // PLATINUM: CES >= 85 or LTV >= 100,000 THB
  // GOLD: CES in [70, 84] or LTV in [30,000, 99,999] THB
  // SILVER: CES in [50, 69] or LTV in [10,000, 29,999] THB
  // BRONZE: CES < 50 and LTV < 10,000 THB
  let tier: LoyaltyTier = 'BRONZE';
  if (score >= 85 || ltv >= 100000) {
    tier = 'PLATINUM';
  } else if (score >= 70 || ltv >= 30000) {
    tier = 'GOLD';
  } else if (score >= 50 || ltv >= 10000) {
    tier = 'SILVER';
  } else {
    tier = 'BRONZE';
  }

  return { score, tier };
}

// =========================================================================
// Core Analytics & Profile Retrieval
// =========================================================================

/**
 * 6. Get complete Customer 360 Analytics profile by Customer ID or Case ID.
 */
export async function getCustomer360Profile(identifier: string): Promise<Customer360Profile | null> {
  // Resolve customer by ID, externalId, or linked Case ID
  let customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { id: identifier },
        { externalId: identifier },
        { lineUserId: identifier },
        { fbPsid: identifier },
        { phone: identifier },
        { cases: { some: { OR: [{ id: identifier }, { caseNumber: identifier }] } } },
      ],
    },
    include: {
      cases: {
        orderBy: { createdAt: 'desc' },
      },
      sessions: {
        orderBy: { startDateTime: 'desc' },
      },
      quotations: {
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      },
      csatResponses: true,
    },
  });

  if (!customer) {
    return null;
  }

  const eligibleStatuses: QuotationStatus[] = [QuotationStatus.PAID, QuotationStatus.PRINTED, QuotationStatus.COMPLETED];
  const paidQuotations = customer.quotations.filter((q) => eligibleStatuses.includes(q.status));
  const paidOrderCount = paidQuotations.length;

  // LTV & AOV
  const ltv = calculateLtv(customer.quotations);
  const aov = calculateAov(ltv, paidOrderCount);

  // Purchase Frequency
  const purchaseFrequency = calculatePurchaseFrequency(paidOrderCount, customer.createdAt);

  // Preferred Channel
  const preferredChannel = determinePreferredChannel(
    customer.cases,
    customer.sessions,
    String(customer.channel || 'LINE')
  );

  // Activity Timestamps & Days Elapsed
  const timestamps: number[] = [customer.createdAt.getTime()];
  for (const c of customer.cases) timestamps.push(new Date(c.updatedAt || c.createdAt).getTime());
  for (const s of customer.sessions) timestamps.push(new Date(s.startDateTime || s.createdAt).getTime());
  for (const q of customer.quotations) timestamps.push(new Date(q.updatedAt || q.createdAt).getTime());

  const lastActiveTimestamp = Math.max(...timestamps);
  const lastActiveDate = new Date(lastActiveTimestamp);
  const now = new Date();

  const customerAgeDays = Math.max(1, Math.floor((now.getTime() - customer.createdAt.getTime()) / (86400 * 1000)));
  const daysSinceLastActivity = Math.max(0, Math.floor((now.getTime() - lastActiveTimestamp) / (86400 * 1000)));

  // CSAT Score
  const csatScores = customer.csatResponses
    .map((r) => r.csatScore)
    .filter((s): s is number => typeof s === 'number');
  const avgCsat = csatScores.length > 0 ? csatScores.reduce((a, b) => a + b, 0) / csatScores.length : null;

  // Engagement Score & Tier
  const { score: customerEngagementScore, tier: loyaltyTier } = calculateCustomerEngagementScore({
    daysSinceLastActivity,
    sessionCount: customer.sessions.length,
    paidOrderCount,
    ltv,
    csatScores,
  });

  return {
    id: customer.id,
    externalId: customer.externalId,
    displayName: customer.displayName,
    name: customer.name,
    phone: customer.phone || customer.the1Mobile || null,
    email: customer.email,
    avatarUrl: customer.avatarUrl,
    channel: customer.channel,
    lineUserId: customer.lineUserId,
    fbPsid: customer.fbPsid,
    igUsername: customer.igUsername,
    the1CardNumber: customer.the1CardNumber,
    the1Points: customer.the1Points || 0,
    the1Tier: customer.the1Tier || 'CLASSIC',

    ltv,
    aov,
    totalOrders: customer.quotations.length,
    paidOrderCount,
    purchaseFrequency,
    preferredChannel,
    customerEngagementScore,
    loyaltyTier,

    customerAgeDays,
    daysSinceLastActivity,
    lastActiveAt: lastActiveDate.toISOString(),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),

    orderHistory: customer.quotations.map((q) => ({
      id: q.id,
      quotationNumber: q.quotationNumber,
      status: q.status,
      grandTotal: Number(q.grandTotal),
      businessUnit: q.businessUnit,
      createdAt: q.createdAt.toISOString(),
      issuedAt: q.issuedAt ? new Date(q.issuedAt).toISOString() : null,
    })),
    caseCount: customer.cases.length,
    sessionCount: customer.sessions.length,
    avgCsat: avgCsat !== null ? Math.round(avgCsat * 10) / 10 : null,
  };
}

// =========================================================================
// Multi-Channel Identity Linking & Deterministic Merge
// =========================================================================

/**
 * 7. Consolidates customer identities across LINE, FB, IG, and Phone into a unified profile.
 * Implements deterministic deduplication and merging into the oldest canonical record on conflict.
 */
export async function linkCustomerIdentity(input: LinkIdentityInput) {
  const normPhone = input.phone?.trim() || input.the1Mobile?.trim() || undefined;
  const normLine = input.lineUserId?.trim() || undefined;
  const normFb = input.fbPsid?.trim() || undefined;
  const normIg = input.igUsername?.trim() || undefined;
  const inputCustomerId = input.customerId?.trim() || undefined;

  // 1. Find all existing candidate customer records matching any provided identifier
  const matchCriteria: any[] = [];
  if (inputCustomerId) matchCriteria.push({ id: inputCustomerId });
  if (normPhone) {
    matchCriteria.push({ phone: normPhone });
    matchCriteria.push({ the1Mobile: normPhone });
  }
  if (normLine) matchCriteria.push({ lineUserId: normLine });
  if (normFb) matchCriteria.push({ fbPsid: normFb });
  if (normIg) matchCriteria.push({ igUsername: normIg });

  if (matchCriteria.length === 0) {
    throw new Error('At least one identifier (phone, lineUserId, fbPsid, igUsername, or customerId) is required');
  }

  const existingCustomers = await prisma.customer.findMany({
    where: { OR: matchCriteria },
    orderBy: { createdAt: 'asc' }, // Oldest record first
  });

  // Case A: No existing record found -> Create fresh Customer record
  if (existingCustomers.length === 0) {
    const extId =
      normLine ||
      normFb ||
      normIg ||
      (normPhone ? `phone_${normPhone}` : `cust_${Date.now()}`);

    const newCustomer = await prisma.customer.create({
      data: {
        externalId: extId,
        channel: (input.channel as ChannelType) || ChannelType.LINE,
        displayName: input.displayName || input.name || `Customer ${normPhone ? normPhone.slice(-4) : 'User'}`,
        name: input.name || null,
        phone: normPhone || null,
        the1Mobile: normPhone || null,
        email: input.email || null,
        avatarUrl: input.avatarUrl || null,
        lineUserId: normLine || null,
        fbPsid: normFb || null,
        igUsername: normIg || null,
        the1CardNumber: input.the1CardNumber || null,
      },
    });

    await createAuditLog({
      caseId: null,
      actorId: input.actorId || null,
      actorName: 'IDENTITY_SERVICE',
      action: 'CUSTOMER_IDENTITY_LINKED',
      actionType: 'CUSTOMER_LINK',
      entityType: 'Customer',
      entityId: newCustomer.id,
      details: JSON.stringify({
        event: 'CUSTOMER_CREATED',
        customerId: newCustomer.id,
        phone: normPhone,
        channel: newCustomer.channel,
      }),
    });

    return newCustomer;
  }

  // Case B: Exactly one existing customer record found -> Enrich with new identifiers
  if (existingCustomers.length === 1) {
    const canonical = existingCustomers[0];
    const updateData: any = { updatedAt: new Date() };

    if (normPhone && !canonical.phone) {
      updateData.phone = normPhone;
      updateData.the1Mobile = normPhone;
    }
    if (normLine && !canonical.lineUserId) updateData.lineUserId = normLine;
    if (normFb && !canonical.fbPsid) updateData.fbPsid = normFb;
    if (normIg && !canonical.igUsername) updateData.igUsername = normIg;
    if (input.the1CardNumber && !canonical.the1CardNumber) updateData.the1CardNumber = input.the1CardNumber;
    if (input.avatarUrl && !canonical.avatarUrl) updateData.avatarUrl = input.avatarUrl;
    if (input.name && !canonical.name) updateData.name = input.name;
    if (input.email && !canonical.email) updateData.email = input.email;

    const updated = await prisma.customer.update({
      where: { id: canonical.id },
      data: updateData,
    });

    return updated;
  }

  // Case C: Multiple existing customer records found sharing an identifier (e.g. same Phone across LINE and FB)
  // Deterministic Merge:
  // - Canonical record C* = oldest record (first in existingCustomers sorted by createdAt ASC)
  // - All other records are subordinates merged into C*
  const canonical = existingCustomers[0];
  const subordinates = existingCustomers.slice(1);

  const mergedSocials: any = {
    lineUserId: canonical.lineUserId,
    fbPsid: canonical.fbPsid,
    igUsername: canonical.igUsername,
    phone: canonical.phone || normPhone,
    the1Mobile: canonical.the1Mobile || normPhone,
    the1CardNumber: canonical.the1CardNumber || input.the1CardNumber,
    avatarUrl: canonical.avatarUrl || input.avatarUrl,
    name: canonical.name || input.name,
    email: canonical.email || input.email,
  };

  for (const sub of subordinates) {
    // 1. Consolidate social IDs
    if (!mergedSocials.lineUserId && sub.lineUserId) mergedSocials.lineUserId = sub.lineUserId;
    if (!mergedSocials.fbPsid && sub.fbPsid) mergedSocials.fbPsid = sub.fbPsid;
    if (!mergedSocials.igUsername && sub.igUsername) mergedSocials.igUsername = sub.igUsername;
    if (!mergedSocials.phone && sub.phone) mergedSocials.phone = sub.phone;
    if (!mergedSocials.the1CardNumber && sub.the1CardNumber) mergedSocials.the1CardNumber = sub.the1CardNumber;
    if (!mergedSocials.avatarUrl && sub.avatarUrl) mergedSocials.avatarUrl = sub.avatarUrl;

    // 2. Re-link related records to canonical customer ID
    await prisma.case.updateMany({
      where: { customerId: sub.id },
      data: { customerId: canonical.id },
    });

    await prisma.quotation.updateMany({
      where: { customerId: sub.id },
      data: { customerId: canonical.id },
    });

    await prisma.sessionTraffic.updateMany({
      where: { customerId: sub.id },
      data: { customerId: canonical.id },
    });

    await prisma.cSATResponse.updateMany({
      where: { customerId: sub.id },
      data: { customerId: canonical.id },
    });

    // 3. Delete subordinate customer record
    await prisma.customer.delete({
      where: { id: sub.id },
    });

    // 4. Audit Log for merge event
    await createAuditLog({
      caseId: null,
      actorId: input.actorId || null,
      actorName: 'IDENTITY_MERGE_ENGINE',
      action: 'CUSTOMER_IDENTITIES_MERGED',
      actionType: 'CUSTOMER_MERGE',
      entityType: 'Customer',
      entityId: canonical.id,
      details: JSON.stringify({
        canonicalCustomerId: canonical.id,
        mergedSubordinateId: sub.id,
        matchedPhone: normPhone,
        mergedSocialIdentifiers: {
          lineUserId: sub.lineUserId,
          fbPsid: sub.fbPsid,
          igUsername: sub.igUsername,
        },
      }),
    });
  }

  // Update canonical record with all consolidated identities
  const updatedCanonical = await prisma.customer.update({
    where: { id: canonical.id },
    data: {
      lineUserId: mergedSocials.lineUserId,
      fbPsid: mergedSocials.fbPsid,
      igUsername: mergedSocials.igUsername,
      phone: mergedSocials.phone,
      the1Mobile: mergedSocials.the1Mobile,
      the1CardNumber: mergedSocials.the1CardNumber,
      avatarUrl: mergedSocials.avatarUrl,
      name: mergedSocials.name,
      email: mergedSocials.email,
      updatedAt: new Date(),
    },
  });

  return updatedCanonical;
}
