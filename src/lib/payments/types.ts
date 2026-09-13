/**
 * Payment Gateway & Reconciliation Type Definitions
 * Path: src/lib/payments/types.ts
 */

import { PaymentMethod, PaymentStatus, BusinessUnit } from '@prisma/client';

export type PaymentGatewayType = 'CREDIT_CARD' | 'PROMPTPAY' | 'BANK_TRANSFER' | string;

export interface CardDetails {
  brand?: string;
  maskedPan?: string;
  authCode?: string;
  bankIssuer?: string;
}

export interface PromptPayDetails {
  billerId?: string;
  referenceNo1?: string;
  referenceNo2?: string;
  slipHash?: string;
}

export interface PaymentWebhookPayload {
  gateway: PaymentGatewayType;
  merchantId: string;
  businessUnit?: string;
  transactionNumber: string;
  quotationNumber?: string;
  quotationId?: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  cardDetails?: CardDetails;
  promptPayDetails?: PromptPayDetails;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | string;
  paidAt?: string;
  gatewayReference?: string;
  [key: string]: any;
}

export interface RecordPaymentInput {
  quotationId?: string;
  quotationNumber?: string;
  amount: number;
  paymentMethod: PaymentMethod | 'CREDIT_CARD' | 'PROMPTPAY' | 'BANK_TRANSFER' | string;
  businessUnit?: string;
  slipUrl?: string;
  referenceNo?: string;
  gatewayReference?: string;
  transactionNumber?: string;
  merchantId?: string;
  notes?: string;
  paidAt?: Date | string;
  status?: PaymentStatus | string;
}

export interface VerifySlipInput {
  action?: 'APPROVE' | 'REJECT' | string;
  approved?: boolean;
  verifiedById?: string;
  rejectionReason?: string;
  discrepancyNote?: string;
}

export interface PaymentFilterParams {
  businessUnit?: string;
  bu?: string;
  status?: string;
  quotationId?: string;
  paymentMethod?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number | string;
  limit?: number | string;
}

export interface FormattedPayment {
  id: string;
  transactionNumber: string | null;
  quotationId: string;
  businessUnit: string | null;
  paymentMethod: string;
  amount: number;
  status: string;
  referenceNo: string | null;
  gatewayReference: string | null;
  slipUrl: string | null;
  slipVerifiedAt: string | null;
  verifiedById: string | null;
  discrepancyNote: string | null;
  paidAt: string | null;
  currency: string;
  merchantId: string | null;
  channel: string | null;
  expectedAmount: number | null;
  amountDiff?: number | null;
  createdAt: string;
  updatedAt: string;
  quotation?: any;
  verifiedBy?: any;
}

export interface PaymentProcessResult {
  success: boolean;
  idempotent?: boolean;
  status: 'PAID' | 'DISCREPANCY' | 'ALREADY_PROCESSED' | 'FAILED' | string;
  reconciliationStatus?: 'PAID' | 'DISCREPANCY' | string;
  discrepancy?: boolean;
  discrepancyReason?: string;
  paymentId?: string;
  transactionNumber?: string | null;
  quotationStatus?: string;
  quotationId?: string;
  expectedAmount?: number;
  receivedAmount?: number;
  amountDiff?: number;
  message?: string;
  payment?: FormattedPayment;
}
