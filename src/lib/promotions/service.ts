/**
 * Promotion Management Hub Service
 * Path: src/lib/promotions/service.ts
 *
 * Implements Phase 2 R6 (Milestone M18):
 * - Centralized catalog of active promotional campaigns, promo codes, banners, and campaign validity.
 * - Promotion CRUD operations (create, get, list, update, archive, delete).
 * - RBAC authorization checks (Admin/Supervisor write, Frontline read-only).
 * - Quick-share promotion card generation for Zwiz chat composer.
 */

import { prisma } from '@/lib/db';
import { Promotion, PromotionDiscountType } from '@prisma/client';

export { PromotionDiscountType };
export type { Promotion };

export interface CreatePromotionInput {
  code: string;
  name: string;
  description?: string | null;
  discountType: PromotionDiscountType | 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  bannerUrl?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  isActive?: boolean;
  applicableBUs?: string[];
  metadata?: any;
}

export interface UpdatePromotionInput {
  code?: string;
  name?: string;
  description?: string | null;
  discountType?: PromotionDiscountType | 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  bannerUrl?: string | null;
  startDate?: Date | string;
  endDate?: Date | string;
  isActive?: boolean;
  applicableBUs?: string[];
  metadata?: any;
}

export interface ListPromotionsParams {
  bu?: string;
  businessUnit?: string;
  search?: string;
  q?: string;
  code?: string;
  isActive?: boolean | string;
  validNow?: boolean | string;
  page?: number | string;
  limit?: number | string;
}

export interface PromotionCardPayload {
  type: 'PROMOTION_CARD';
  promotionId: string;
  promoCode: string;
  title: string;
  name: string;
  description: string;
  bannerUrl: string | null;
  discountType: PromotionDiscountType;
  discountValue: number;
  discountSummary: string;
  startDate: string;
  endDate: string;
  validTo: string;
  applicableBUs: string[];
  actions: Array<{
    type: 'POSTBACK' | 'MESSAGE' | 'URI';
    label: string;
    data?: string;
    text?: string;
    url?: string;
  }>;
}

/**
 * Validates if a role is authorized to mutate (create/update/delete) promotions.
 * Privileged: ADMIN, SUPERVISOR.
 * Restricted: AGENT, AGENT_SALES, AGENT_EOR, AGENT_SOCIAL_MEDIA, AGENT_CS, AUDITOR, etc.
 */
export function canMutatePromotions(role?: string): boolean {
  const normalized = String(role || '').trim().toUpperCase();
  return normalized === 'ADMIN' || normalized === 'SUPERVISOR';
}

/**
 * Creates a new promotional campaign.
 */
export async function createPromotion(input: CreatePromotionInput): Promise<Promotion> {
  if (!input.code || !input.code.trim()) {
    throw new Error('Promotion code is required');
  }
  if (!input.name || !input.name.trim()) {
    throw new Error('Promotion name is required');
  }
  if (input.discountValue === undefined || input.discountValue === null || Number(input.discountValue) < 0) {
    throw new Error('Valid non-negative discount value is required');
  }

  const normalizedCode = input.code.trim().toUpperCase();

  const existing = await prisma.promotion.findUnique({
    where: { code: normalizedCode },
  });

  if (existing) {
    throw new Error(`Promotion with code ${normalizedCode} already exists`);
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Valid startDate and endDate are required');
  }

  return prisma.promotion.create({
    data: {
      code: normalizedCode,
      name: input.name.trim(),
      description: input.description || null,
      discountType: input.discountType as PromotionDiscountType,
      discountValue: Number(input.discountValue),
      bannerUrl: input.bannerUrl || null,
      startDate,
      endDate,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
      applicableBUs: input.applicableBUs || [],
      metadata: input.metadata || null,
    },
  });
}

/**
 * Fetches a single promotion by ID or Code.
 */
export async function getPromotionById(idOrCode: string): Promise<Promotion | null> {
  return prisma.promotion.findFirst({
    where: {
      OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }],
    },
  });
}

/**
 * Lists promotions with optional filters for BU, active status, validity window, and text search.
 */
export async function listPromotions(params: ListPromotionsParams = {}): Promise<{
  promotions: Promotion[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, parseInt(String(params.page || '1'), 10));
  const limit = Math.max(1, Math.min(100, parseInt(String(params.limit || '50'), 10)));
  const skip = (page - 1) * limit;

  const where: any = {};

  // Active status filter
  if (params.isActive !== undefined) {
    const isActiveBool =
      params.isActive === true ||
      params.isActive === 'true' ||
      params.isActive === '1';
    where.isActive = isActiveBool;
  }

  // Validity window (valid now)
  const isValidNow =
    params.validNow === true ||
    params.validNow === 'true' ||
    params.validNow === '1';

  if (isValidNow) {
    const now = new Date();
    where.isActive = true;
    where.startDate = { lte: now };
    where.endDate = { gte: now };
  }

  // BU filter: applicable to specific BU or empty array (applies to all BUs)
  const bu = (params.bu || params.businessUnit || '').trim().toUpperCase();
  if (bu) {
    where.OR = [
      { applicableBUs: { has: bu } },
      { applicableBUs: { isEmpty: true } },
    ];
  }

  // Search filter
  const search = (params.search || params.q || params.code || '').trim();
  if (search) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const [total, promotions] = await Promise.all([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ isActive: 'desc' }, { endDate: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  return {
    promotions,
    total,
    page,
    limit,
  };
}

/**
 * Updates an existing promotion record.
 */
export async function updatePromotion(
  idOrCode: string,
  input: UpdatePromotionInput
): Promise<Promotion> {
  const existing = await getPromotionById(idOrCode);
  if (!existing) {
    throw new Error(`Promotion ${idOrCode} not found`);
  }

  const data: any = {};

  if (input.code !== undefined && input.code.trim()) {
    data.code = input.code.trim().toUpperCase();
  }
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description;
  if (input.discountType !== undefined) data.discountType = input.discountType as PromotionDiscountType;
  if (input.discountValue !== undefined) data.discountValue = Number(input.discountValue);
  if (input.bannerUrl !== undefined) data.bannerUrl = input.bannerUrl;
  if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) data.endDate = new Date(input.endDate);
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  if (input.applicableBUs !== undefined) data.applicableBUs = input.applicableBUs;
  if (input.metadata !== undefined) data.metadata = input.metadata;

  return prisma.promotion.update({
    where: { id: existing.id },
    data,
  });
}

/**
 * Archives a promotion by setting isActive = false.
 */
export async function archivePromotion(idOrCode: string): Promise<Promotion> {
  const existing = await getPromotionById(idOrCode);
  if (!existing) {
    throw new Error(`Promotion ${idOrCode} not found`);
  }

  return prisma.promotion.update({
    where: { id: existing.id },
    data: {
      isActive: false,
    },
  });
}

/**
 * Deletes a promotion record.
 */
export async function deletePromotion(idOrCode: string): Promise<Promotion> {
  const existing = await getPromotionById(idOrCode);
  if (!existing) {
    throw new Error(`Promotion ${idOrCode} not found`);
  }

  return prisma.promotion.delete({
    where: { id: existing.id },
  });
}

/**
 * Formats a human-readable discount summary.
 */
export function formatDiscountSummary(
  discountType: PromotionDiscountType | string,
  discountValue: number
): string {
  if (discountType === 'PERCENTAGE') {
    return `ลด ${discountValue}%`;
  }
  return `ลด ฿${Number(discountValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates a rich Promotion Card payload (type: 'PROMOTION_CARD')
 * ready for the Zwiz chat composer.
 */
export async function generatePromotionCard(
  promotionOrId: Promotion | string,
  caseId?: string
): Promise<PromotionCardPayload> {
  let promo: Promotion | null = null;
  if (typeof promotionOrId === 'string') {
    promo = await getPromotionById(promotionOrId);
  } else {
    promo = promotionOrId;
  }

  if (!promo) {
    throw new Error('Promotion not found for card generation');
  }

  const discountSummary = formatDiscountSummary(promo.discountType, promo.discountValue);

  return {
    type: 'PROMOTION_CARD',
    promotionId: promo.id,
    promoCode: promo.code,
    title: promo.name,
    name: promo.name,
    description: promo.description || `รับสิทธิ์ส่วนลดพิเศษ ${discountSummary} ด้วยโค้ด ${promo.code}`,
    bannerUrl: promo.bannerUrl || null,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    discountSummary,
    startDate: promo.startDate.toISOString(),
    endDate: promo.endDate.toISOString(),
    validTo: promo.endDate.toISOString(),
    applicableBUs: promo.applicableBUs,
    actions: [
      {
        type: 'POSTBACK',
        label: 'เก็บคูปองนี้',
        data: `action=claim_promo&promoCode=${promo.code}${caseId ? `&caseId=${caseId}` : ''}`,
      },
      {
        type: 'MESSAGE',
        label: `ใช้โค้ด ${promo.code}`,
        text: `ใช้โค้ดส่วนลด ${promo.code}`,
      },
    ],
  };
}
