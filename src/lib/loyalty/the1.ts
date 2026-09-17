/**
 * The 1 Loyalty Integration Service
 * Path: src/lib/loyalty/the1.ts
 *
 * Provides customer loyalty lookups by phone number, card number, or customer ID.
 * Returns member profiles with tier, points balance, THB monetary value,
 * and handles point earnings and discount redemptions.
 */

import { prisma } from '@/lib/db';

export interface The1MemberProfile {
  memberId: string;
  the1CardNumber: string;
  cardNumber: string;
  name: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  phone: string;
  mobile: string;
  email?: string | null;
  tier: string;
  the1Tier: string;
  pointsBalance: number;
  availablePoints: number;
  pointsExpiringThisYear: number;
  pointsExpirationDate: string;
  pointsValueThb: number;
  customerId?: string | null;
  customer?: any;
  eligibleDiscounts?: Array<{
    code: string;
    name: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    value: number;
  }>;
}

export interface The1LookupParams {
  phone?: string | null;
  mobile?: string | null;
  cardNumber?: string | null;
  the1CardNumber?: string | null;
  customerId?: string | null;
  identifier?: string | null;
}

// Built-in loyalty test fixtures for The 1 loyalty simulation
const THE1_REGISTRY: Record<string, Partial<The1MemberProfile>> = {
  '0812345678': {
    memberId: 'T1-99887766',
    the1CardNumber: '880012345678',
    cardNumber: '880012345678',
    name: 'Somchai Suksan',
    displayName: 'K. Somchai Suksan',
    phone: '0812345678',
    mobile: '0812345678',
    email: 'somchai@example.com',
    tier: 'THE1_EXCLUSIVE',
    the1Tier: 'THE1_EXCLUSIVE',
    pointsBalance: 12500,
    availablePoints: 12500,
    pointsExpiringThisYear: 1500,
    pointsExpirationDate: '2026-12-31T23:59:59.000Z',
  },
  '880012345678': {
    memberId: 'T1-99887766',
    the1CardNumber: '880012345678',
    cardNumber: '880012345678',
    name: 'Somchai Suksan',
    displayName: 'K. Somchai Suksan',
    phone: '0812345678',
    mobile: '0812345678',
    email: 'somchai@example.com',
    tier: 'THE1_EXCLUSIVE',
    the1Tier: 'THE1_EXCLUSIVE',
    pointsBalance: 12500,
    availablePoints: 12500,
    pointsExpiringThisYear: 1500,
    pointsExpirationDate: '2026-12-31T23:59:59.000Z',
  },
  '0891112222': {
    memberId: 'T1-11223344',
    the1CardNumber: '880012340001',
    cardNumber: '880012340001',
    name: 'Somchai Classic',
    displayName: 'K. Somchai Classic',
    phone: '0891112222',
    mobile: '0891112222',
    email: 'somchai.classic@example.com',
    tier: 'CLASSIC',
    the1Tier: 'CLASSIC',
    pointsBalance: 2500,
    availablePoints: 2500,
    pointsExpiringThisYear: 200,
    pointsExpirationDate: '2026-12-31T23:59:59.000Z',
  },
  '880012340001': {
    memberId: 'T1-11223344',
    the1CardNumber: '880012340001',
    cardNumber: '880012340001',
    name: 'Somchai Classic',
    displayName: 'K. Somchai Classic',
    phone: '0891112222',
    mobile: '0891112222',
    email: 'somchai.classic@example.com',
    tier: 'CLASSIC',
    the1Tier: 'CLASSIC',
    pointsBalance: 2500,
    availablePoints: 2500,
    pointsExpiringThisYear: 200,
    pointsExpirationDate: '2026-12-31T23:59:59.000Z',
  },
  '0863334444': {
    memberId: 'T1-55667788',
    the1CardNumber: '880012340003',
    cardNumber: '880012340003',
    name: 'Arak Wongsuwan',
    displayName: 'Khun Arak VIP',
    phone: '0863334444',
    mobile: '0863334444',
    email: 'arak.vip@example.com',
    tier: 'VIP',
    the1Tier: 'VIP',
    pointsBalance: 120000,
    availablePoints: 120000,
    pointsExpiringThisYear: 10000,
    pointsExpirationDate: '2026-12-31T23:59:59.000Z',
  },
  '880012340003': {
    memberId: 'T1-55667788',
    the1CardNumber: '880012340003',
    cardNumber: '880012340003',
    name: 'Arak Wongsuwan',
    displayName: 'Khun Arak VIP',
    phone: '0863334444',
    mobile: '0863334444',
    email: 'arak.vip@example.com',
    tier: 'VIP',
    the1Tier: 'VIP',
    pointsBalance: 120000,
    availablePoints: 120000,
    pointsExpiringThisYear: 10000,
    pointsExpirationDate: '2026-12-31T23:59:59.000Z',
  },
};

/**
 * Standard point redemption conversion:
 * 8 Points = 1 THB cash discount (e.g. 800 points = 100 THB)
 */
export function calculatePointsValueThb(points: number): number {
  return Math.round((points / 8) * 100) / 100;
}

/**
 * Calculates points needed for a given discount amount in THB:
 * 1 THB discount = 8 Points
 */
export function calculatePointsNeededForDiscount(discountThb: number): number {
  return Math.round(discountThb * 8);
}

/**
 * Calculates loyalty points earned on a purchase:
 * Standard rule: 25 THB spent = 1 Point earned
 */
export function calculatePointsEarned(grandTotal: number): number {
  if (!grandTotal || grandTotal <= 0) return 0;
  return Math.floor(grandTotal / 25);
}

/**
 * Look up a The 1 Loyalty member by phone number, card number, or customer ID.
 */
export async function lookupThe1Profile(params: The1LookupParams): Promise<The1MemberProfile | null> {
  const query = (
    params.identifier ||
    params.phone ||
    params.mobile ||
    params.cardNumber ||
    params.the1CardNumber ||
    params.customerId ||
    ''
  ).trim();

  if (!query) {
    throw new Error('MISSING_IDENTIFIER: Please provide phone number, card number, or customer ID.');
  }

  // Sanitize query
  const cleanPhone = query.replace(/[^0-9]/g, '');

  // 1. Search database Customer table
  let dbCustomer: any = null;

  if (params.customerId || query.startsWith('cust_') || query.length > 20) {
    dbCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: query },
          { externalId: query },
        ],
      },
    });
  }

  if (!dbCustomer) {
    dbCustomer = await (prisma.customer as any).findFirst({
      where: {
        OR: [
          ...(cleanPhone ? [{ phone: cleanPhone }, { phone: query }, { the1Mobile: cleanPhone }, { the1Mobile: query }] : []),
          { the1CardNumber: query },
          { externalId: query },
        ],
      },
    });
  }

  // 2. Resolve or fallback to The 1 registry profile
  const registryEntry = THE1_REGISTRY[query] || THE1_REGISTRY[cleanPhone] || (dbCustomer?.phone ? THE1_REGISTRY[dbCustomer.phone] : null);

  if (!dbCustomer && !registryEntry) {
    return null;
  }

  const rawCard = dbCustomer?.the1CardNumber || registryEntry?.the1CardNumber || (cleanPhone ? `8800${cleanPhone.slice(-8)}` : '880012345678');
  const rawMobile = dbCustomer?.the1Mobile || dbCustomer?.phone || registryEntry?.mobile || query;
  const rawTier = dbCustomer?.the1Tier || registryEntry?.tier || 'CLASSIC';
  const rawPoints = dbCustomer?.the1Points ?? registryEntry?.pointsBalance ?? 0;
  const rawName = dbCustomer?.name || dbCustomer?.displayName || registryEntry?.name || 'Valued Customer';

  const pointsValueThb = calculatePointsValueThb(rawPoints);

  // Sync back to database customer if customer exists and loyalty not yet set
  if (dbCustomer && (!dbCustomer.the1CardNumber || !dbCustomer.the1SyncedAt)) {
    try {
      await (prisma.customer as any).update({
        where: { id: dbCustomer.id },
        data: {
          the1CardNumber: rawCard,
          the1Mobile: rawMobile,
          the1Points: rawPoints,
          the1Tier: rawTier,
          the1SyncedAt: new Date(),
        },
      });
    } catch {
      // Ignore background sync errors
    }
  }

  const eligibleDiscounts = [];
  if (rawTier === 'THE1_EXCLUSIVE' || rawTier === 'The 1 Exclusive') {
    eligibleDiscounts.push({
      code: 'T1_EXCL_10',
      name: '10% The 1 Exclusive Member Discount',
      discountType: 'PERCENTAGE' as const,
      value: 10,
    });
  } else if (rawTier === 'VIP') {
    eligibleDiscounts.push({
      code: 'T1_VIP_15',
      name: '15% The 1 VIP Member Discount',
      discountType: 'PERCENTAGE' as const,
      value: 15,
    });
  }

  return {
    memberId: registryEntry?.memberId || `T1-${rawCard.slice(-8)}`,
    the1CardNumber: rawCard,
    cardNumber: rawCard,
    name: rawName,
    displayName: dbCustomer?.displayName || rawName,
    phone: rawMobile,
    mobile: rawMobile,
    email: dbCustomer?.email || registryEntry?.email || null,
    tier: rawTier,
    the1Tier: rawTier,
    pointsBalance: rawPoints,
    availablePoints: rawPoints,
    pointsExpiringThisYear: registryEntry?.pointsExpiringThisYear || 0,
    pointsExpirationDate: registryEntry?.pointsExpirationDate || '2026-12-31T23:59:59.000Z',
    pointsValueThb,
    customerId: dbCustomer?.id || null,
    customer: dbCustomer || null,
    eligibleDiscounts,
  };
}
