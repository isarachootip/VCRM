/**
 * Payment Gateway Multi-BU Routing Configuration
 * Path: src/lib/payments/config.ts
 */

import { BusinessUnit, PaymentMethod } from '@prisma/client';

export interface BuMerchantAccountConfig {
  merchantId: string;
  billerId: string;
  priority: number;
  businessUnit: string;
  prismaBU: BusinessUnit;
  settlementAccount: string;
  bankName: string;
  secretKey: string;
  displayName: string;
}

export const BU_MERCHANT_ACCOUNTS: Record<string, BuMerchantAccountConfig> = {
  MUJI: {
    merchantId: 'MERCHANT_MUJI_01',
    billerId: '010753600026902',
    priority: 1, // 1st Priority per spec
    businessUnit: 'Muji',
    prismaBU: BusinessUnit.MUJI,
    settlementAccount: '028-3-88990-2',
    bankName: 'SCB',
    secretKey: process.env.SECRET_PAY_MUJI_01 || 'SECRET_PAY_MUJI_01',
    displayName: 'Muji Retail Thailand',
  },
  SSP: {
    merchantId: 'MERCHANT_SSP_01',
    billerId: '010753600026903',
    priority: 2,
    businessUnit: 'SSP',
    prismaBU: BusinessUnit.SSP,
    settlementAccount: '101-2-66550-3',
    bankName: 'BBL',
    secretKey: process.env.SECRET_PAY_SSP_01 || 'SECRET_PAY_SSP_01',
    displayName: 'CRC Sports Ltd (Supersports)',
  },
  B2S: {
    merchantId: 'MERCHANT_B2S_01',
    billerId: '010753600026904',
    priority: 3,
    businessUnit: 'B2S',
    prismaBU: BusinessUnit.B2S,
    settlementAccount: '050-4-55440-4',
    bankName: 'KTB',
    secretKey: process.env.SECRET_PAY_B2S_01 || 'SECRET_PAY_B2S_01',
    displayName: 'B2S Company Ltd',
  },
};

// Aliases for case-insensitivity and alternative naming
BU_MERCHANT_ACCOUNTS['Muji'] = BU_MERCHANT_ACCOUNTS.MUJI;
BU_MERCHANT_ACCOUNTS['SUPERSPORTS'] = BU_MERCHANT_ACCOUNTS.SSP;

/**
 * Normalizes any business unit input string into a standardized uppercase key (MUJI, SSP, B2S).
 */
export function normalizeBusinessUnit(bu?: string | null): 'MUJI' | 'SSP' | 'B2S' {
  if (!bu) return 'MUJI';
  const clean = bu.toUpperCase().trim().replace(/[\s_-]+/g, '');
  if (clean === 'MUJI') return 'MUJI';
  if (clean === 'SSP' || clean === 'SUPERSPORTS') return 'SSP';
  if (clean === 'B2S') return 'B2S';
  return 'MUJI';
}

/**
 * Maps any business unit string to the Prisma BusinessUnit enum.
 */
export function toPrismaBusinessUnit(bu?: string | null): BusinessUnit {
  const norm = normalizeBusinessUnit(bu);
  switch (norm) {
    case 'MUJI':
      return BusinessUnit.MUJI;
    case 'SSP':
      return BusinessUnit.SSP;
    case 'B2S':
      return BusinessUnit.B2S;
    default:
      return BusinessUnit.MUJI;
  }
}

/**
 * Retrieves the merchant account configuration for a given business unit.
 */
export function getBuMerchantAccount(bu?: string | null): BuMerchantAccountConfig {
  const norm = normalizeBusinessUnit(bu);
  return BU_MERCHANT_ACCOUNTS[norm] || BU_MERCHANT_ACCOUNTS.MUJI;
}

/**
 * Resolves the business unit key from a merchant ID.
 */
export function getBuByMerchantId(merchantId?: string | null): BuMerchantAccountConfig | null {
  if (!merchantId) return null;
  const mid = merchantId.trim().toUpperCase();
  for (const config of Object.values(BU_MERCHANT_ACCOUNTS)) {
    if (config.merchantId.toUpperCase() === mid) {
      return config;
    }
  }
  return null;
}

/**
 * Maps payment method or gateway strings to Prisma PaymentMethod enum.
 */
export function mapPaymentMethod(method?: string | null): PaymentMethod {
  if (!method) return PaymentMethod.CREDIT_CARD;
  const upper = method.toUpperCase().trim();
  if (upper.includes('PROMPT') || upper === 'PP' || upper === 'QR') {
    return PaymentMethod.PROMPTPAY;
  }
  if (upper.includes('TRANSFER') || upper.includes('BANK') || upper === 'SLIP') {
    return PaymentMethod.BANK_TRANSFER;
  }
  return PaymentMethod.CREDIT_CARD;
}
