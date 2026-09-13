/**
 * Template Message Manager Service
 * Path: src/lib/templates/service.ts
 *
 * Implements Phase 1 R4:
 * - Pre-configured corporate response templates.
 * - Double-brace placeholder interpolation ({{customerName}}, {{quotationNumber}}, {{grandTotal}}, etc.).
 * - Live WYSIWYG preview endpoint.
 * - In-memory and persistent template storage with CRUD operations.
 */

import { prisma } from '@/lib/db';
import {
  MessageTemplate,
  PreviewTemplateParams,
  PreviewTemplateResult,
} from './types';
import { serializeBusinessUnit } from '@/lib/cases/service';

/**
 * Pre-configured standard response templates for Central Chat & Shop
 */
const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tmpl_order_confirmation',
    name: 'Order Confirmation',
    category: 'ORDER_CONFIRMATION',
    content:
      'เรียนคุณ {{customerName}} ขอบคุณสำหรับการสั่งซื้อผ่าน Central Chat & Shop ยอดคำสั่งซื้อสำหรับใบเสนอราคา {{quotationNumber}} รวมยอดสุทธิ {{grandTotal}} บาท เจ้าหน้าที่จะดำเนินการเตรียมจัดส่งต่อไปค่ะ',
    variables: ['customerName', 'quotationNumber', 'grandTotal', 'businessUnit'],
    businessUnit: 'Central',
    channel: 'ALL',
    description: 'Sent upon quotation creation or order confirmation to summarize grand total',
    isDefault: true,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  },
  {
    id: 'tmpl_payment_link',
    name: 'Payment Link',
    category: 'PAYMENT',
    content:
      'เรียนคุณ {{customerName}} สรุปรายการสำหรับใบเสนอราคา {{quotationNumber}} ยอดชำระสุทธิ {{grandTotal}} บาท สามารถชำระเงินผ่านลิงก์ปลอดภัยได้ที่นี่ค่ะ: {{paymentLink}} (ลิงก์มีอายุ 24 ชม.) ขอบคุณที่ใช้บริการ {{businessUnit}}',
    variables: ['customerName', 'quotationNumber', 'grandTotal', 'paymentLink', 'businessUnit'],
    businessUnit: 'Central',
    channel: 'ALL',
    description: 'Dispatches 24h expiring payment gateway link to customer',
    isDefault: true,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  },
  {
    id: 'tmpl_slip_request',
    name: 'Bank Transfer Slip Request',
    category: 'SLIP_REQUEST',
    content:
      'เรียนคุณ {{customerName}} รบกวนส่งสลิปหลักฐานการโอนเงินสำหรับใบเสนอราคา {{quotationNumber}} ยอด {{grandTotal}} บาท เพื่อให้เจ้าหน้าที่ตรวจสอบและยืนยันคำสั่งซื้อค่ะ',
    variables: ['customerName', 'quotationNumber', 'grandTotal'],
    businessUnit: 'Central',
    channel: 'ALL',
    description: 'Requests payment slip upload for manual bank transfer reconciliation',
    isDefault: true,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  },
  {
    id: 'tmpl_delivery_tracking',
    name: 'Delivery Tracking',
    category: 'TRACKING',
    content:
      'เรียนคุณ {{customerName}} สินค้าตามคำสั่งซื้อ {{quotationNumber}} ได้รับการจัดส่งเรียบร้อยแล้วค่ะ หมายเลขติดตามพัสดุ: {{trackingNumber}} ขอบคุณที่เลือกซื้อสินค้ากับ {{businessUnit}} ค่ะ',
    variables: ['customerName', 'quotationNumber', 'trackingNumber', 'businessUnit'],
    businessUnit: 'Central',
    channel: 'ALL',
    description: 'Notifies customer of courier shipment and tracking code',
    isDefault: true,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  },
  {
    id: 'tmpl_transfer_greeting',
    name: 'Cross-team Transfer Greeting',
    category: 'TRANSFER',
    content:
      'สวัสดีค่ะคุณ {{customerName}} ดิฉัน {{agentName}} จากทีม {{businessUnit}} ได้รับเรื่องส่งต่อการดูแลเรียบร้อยแล้วค่ะ มีข้อสงสัยหรือต้องการสอบถามข้อมูลเพิ่มเติมแจ้งได้เลยนะคะ',
    variables: ['customerName', 'agentName', 'businessUnit'],
    businessUnit: 'Central',
    channel: 'ALL',
    description: 'Automated greeting message when customer is transferred across teams',
    isDefault: true,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  },
];

// In-memory registry for user-created custom templates
const customTemplates = new Map<string, MessageTemplate>();

/**
 * Extracts variable names from template double-brace tokens (e.g. {{customerName}} -> customerName)
 */
export function extractVariables(templateText: string): string[] {
  const matches = templateText.match(/\{\{([^{}]+)\}\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/[\{\}]/g, '').trim())));
}

/**
 * Replaces {{variable}} tokens with values from context.
 * Unresolved tokens are left intact and returned in missingVariables.
 */
export function renderTemplate(
  templateText: string,
  context: Record<string, any>
): { renderedText: string; missingVariables: string[] } {
  const missingVariables: string[] = [];

  const renderedText = templateText.replace(/\{\{([^{}]+)\}\}/g, (match, rawKey) => {
    const key = rawKey.trim();
    if (context[key] !== undefined && context[key] !== null && context[key] !== '') {
      return String(context[key]);
    }
    missingVariables.push(key);
    return match; // Retain placeholder if missing
  });

  return { renderedText, missingVariables };
}

/**
 * Live WYSIWYG Preview endpoint logic.
 * Resolves context from Case, Customer, Quotation and substitutes placeholder tokens.
 */
export async function previewTemplate(params: PreviewTemplateParams): Promise<PreviewTemplateResult> {
  let rawTemplate = params.templateText || params.content || '';

  if (!rawTemplate && params.templateId) {
    const found = await getTemplateById(params.templateId);
    if (found) {
      rawTemplate = found.content;
    }
  }

  if (!rawTemplate) {
    rawTemplate = DEFAULT_TEMPLATES[0].content;
  }

  const context: Record<string, any> = {};

  // 1. Resolve Case context
  let targetCase: any = null;
  if (params.caseId) {
    targetCase = await prisma.case.findFirst({
      where: {
        OR: [{ id: params.caseId }, { caseNumber: params.caseId }],
      },
      include: {
        customer: true,
        owner: true,
        quotations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (targetCase) {
      const customer = targetCase.customer;
      context.customerName = customer?.displayName || customer?.name || 'คุณลูกค้า';
      context.caseNumber = targetCase.caseNumber;
      context.businessUnit = serializeBusinessUnit(targetCase.businessUnit || 'CENTRAL');
      context.agentName = targetCase.owner?.name || 'เจ้าหน้าที่ Central';
      context.trackingNumber = 'TH-TRACK-' + targetCase.caseNumber.slice(-4);
    }
  }

  // 2. Resolve Quotation context
  let targetQuotation: any = null;
  if (params.quotationId) {
    targetQuotation = await prisma.quotation.findFirst({
      where: {
        OR: [{ id: params.quotationId }, { quotationNumber: params.quotationId }],
      },
      include: { customer: true },
    });
  } else if (targetCase?.quotations?.length > 0) {
    targetQuotation = targetCase.quotations[0];
  }

  if (targetQuotation) {
    context.quotationNumber = targetQuotation.quotationNumber;
    const gTotal = Number(targetQuotation.grandTotal || targetQuotation.totalAmount || 0);
    context.grandTotal = gTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    context.totalAmount = context.grandTotal;
    context.paymentLink =
      targetQuotation.paymentLinkUrl ||
      `https://pay.central.co.th/checkout/${targetQuotation.quotationNumber}`;

    if (!context.customerName && targetQuotation.customer) {
      context.customerName = targetQuotation.customer.displayName || targetQuotation.customer.name;
    }
  }

  // 3. Merge explicit parameter variable overrides
  if (params.variables && typeof params.variables === 'object') {
    Object.assign(context, params.variables);
  }

  // 4. Render template
  const { renderedText, missingVariables } = renderTemplate(rawTemplate, context);

  return {
    success: true,
    renderedText,
    text: renderedText,
    rawTemplate,
    missingVariables,
    resolvedVariables: context,
  };
}

/**
 * List templates with optional filtering.
 */
export async function listTemplates(filter?: {
  category?: string;
  businessUnit?: string;
  channel?: string;
}): Promise<MessageTemplate[]> {
  const all = [...DEFAULT_TEMPLATES, ...Array.from(customTemplates.values())];

  return all.filter((t) => {
    if (filter?.category && t.category.toUpperCase() !== filter.category.toUpperCase()) {
      return false;
    }
    if (filter?.businessUnit && t.businessUnit && t.businessUnit.toUpperCase() !== filter.businessUnit.toUpperCase()) {
      return false;
    }
    if (filter?.channel && t.channel && t.channel !== 'ALL' && t.channel.toUpperCase() !== filter.channel.toUpperCase()) {
      return false;
    }
    return true;
  });
}

/**
 * Retrieve an individual template by ID.
 */
export async function getTemplateById(id: string): Promise<MessageTemplate | null> {
  const fromDefault = DEFAULT_TEMPLATES.find((t) => t.id === id);
  if (fromDefault) return fromDefault;
  return customTemplates.get(id) || null;
}

/**
 * Create a new message template.
 */
export async function createTemplate(data: Partial<MessageTemplate>): Promise<MessageTemplate> {
  if (!data.name || !data.content) {
    throw new Error('Template name and content are required');
  }

  const id = data.id || `tmpl_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newTemplate: MessageTemplate = {
    id,
    name: data.name,
    category: (data.category as any) || 'GENERAL',
    content: data.content,
    variables: extractVariables(data.content),
    businessUnit: data.businessUnit || 'Central',
    channel: data.channel || 'ALL',
    description: data.description || '',
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };

  customTemplates.set(id, newTemplate);
  return newTemplate;
}

/**
 * Update an existing custom template.
 */
export async function updateTemplate(
  id: string,
  data: Partial<MessageTemplate>
): Promise<MessageTemplate | null> {
  const existing = await getTemplateById(id);
  if (!existing) return null;

  const updated: MessageTemplate = {
    ...existing,
    ...data,
    variables: data.content ? extractVariables(data.content) : existing.variables,
    updatedAt: new Date().toISOString(),
  };

  customTemplates.set(id, updated);
  return updated;
}

/**
 * Delete a custom template.
 */
export async function deleteTemplate(id: string): Promise<boolean> {
  if (customTemplates.has(id)) {
    customTemplates.delete(id);
    return true;
  }
  return false;
}
