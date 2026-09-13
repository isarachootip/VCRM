/**
 * Shipping Fulfillment & Printable Label Service (R4 - Phase 2)
 * Path: src/lib/shipping/service.ts
 *
 * Implements:
 * - ShippingFulfillment management for PAID or PRINTED quotations
 * - Strict non-paid order protection (HTTP 400 ORDER_NOT_PAID)
 * - Complete address validation (HTTP 422 INCOMPLETE_ADDRESS)
 * - Carrier tracking assignment & regex validation (Kerry, Flash, Central Express)
 * - Printable label generation in Standard A4 and 4x6 Thermal formats
 */

import { prisma } from '@/lib/db';
import {
  ShippingCarrier,
  ShippingStatus,
  ShippingLabelFormat,
  QuotationStatus,
} from '@prisma/client';
import { createAuditLog } from '@/lib/audit/logger';
import {
  normalizeCarrier,
  validateTrackingNumber,
  assertValidTrackingNumber,
  generateTrackingNumber,
  getTrackingPortalUrl,
  generateBarcodeSvg,
  TrackingValidationError,
} from './courier';

// =========================================================================
// Error Classes
// =========================================================================

export class ShippingError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 400, code = 'SHIPPING_ERROR', details?: any) {
    super(message);
    this.name = 'ShippingError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class OrderNotPaidError extends ShippingError {
  constructor(quotationNumber: string, currentStatus: string) {
    super(
      `ORDER_NOT_PAID: Shipping fulfillment and labels can only be generated for PAID or PRINTED orders. Current status of ${quotationNumber} is ${currentStatus}.`,
      400,
      'ORDER_NOT_PAID',
      { quotationNumber, currentStatus }
    );
  }
}

export class IncompleteAddressError extends ShippingError {
  constructor(missingFields: string[]) {
    super(
      `INCOMPLETE_ADDRESS: Shipping address is missing required fields: ${missingFields.join(', ')}. Postal code, recipient name, phone, and street address are required for carrier routing.`,
      422,
      'INCOMPLETE_ADDRESS',
      { missingFields }
    );
  }
}

export class ShippingFulfillmentNotFoundError extends ShippingError {
  constructor(identifier: string) {
    super(`Shipping fulfillment record not found for: ${identifier}`, 404, 'SHIPPING_NOT_FOUND');
  }
}

// =========================================================================
// Interfaces
// =========================================================================

export interface CreateShippingInput {
  quotationId: string;
  carrier?: ShippingCarrier | string;
  trackingNumber?: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  postalCode: string;
  weightKg?: number;
  labelFormat?: ShippingLabelFormat | string;
  metadata?: any;
  createdById?: string;
}

export interface UpdateShippingInput {
  carrier?: ShippingCarrier | string;
  trackingNumber?: string;
  status?: ShippingStatus;
  labelFormat?: ShippingLabelFormat | string;
  weightKg?: number;
  metadata?: any;
}

// =========================================================================
// Service Implementation
// =========================================================================

/**
 * 1. Create or upsert shipping fulfillment for a PAID or PRINTED quotation.
 */
export async function createShippingFulfillment(input: CreateShippingInput) {
  // Find quotation
  const quotation = await prisma.quotation.findFirst({
    where: {
      OR: [{ id: input.quotationId }, { quotationNumber: input.quotationId }],
    },
    include: {
      items: true,
      case: true,
      customer: true,
      shippingFulfillment: true,
    },
  });

  if (!quotation) {
    throw new ShippingError(`Quotation ${input.quotationId} not found`, 404, 'QUOTATION_NOT_FOUND');
  }

  // Guard against non-paid orders:
  // Fulfillments can ONLY be generated for PAID, PRINTED, or COMPLETED quotations.
  const eligibleStatuses: QuotationStatus[] = [QuotationStatus.PAID, QuotationStatus.PRINTED, QuotationStatus.COMPLETED];
  if (!eligibleStatuses.includes(quotation.status)) {
    throw new OrderNotPaidError(quotation.quotationNumber, quotation.status);
  }

  // Validate address completeness
  const missingFields: string[] = [];
  if (!input.recipientName || input.recipientName.trim().length === 0) missingFields.push('recipientName');
  if (!input.recipientPhone || input.recipientPhone.trim().length === 0) missingFields.push('recipientPhone');
  if (!input.shippingAddress || input.shippingAddress.trim().length === 0) missingFields.push('shippingAddress');
  if (!input.postalCode || input.postalCode.trim().length === 0) missingFields.push('postalCode');

  if (missingFields.length > 0) {
    throw new IncompleteAddressError(missingFields);
  }

  // Resolve carrier
  const resolvedCarrier: ShippingCarrier = input.carrier
    ? normalizeCarrier(input.carrier)
    : ShippingCarrier.CENTRAL_EXPRESS;

  // Resolve tracking number
  let trackingNumber = input.trackingNumber?.trim();
  if (trackingNumber) {
    // Assert carrier regex validity; throws TrackingValidationError (HTTP 422) if invalid
    assertValidTrackingNumber(resolvedCarrier, trackingNumber);
  } else {
    trackingNumber = generateTrackingNumber(resolvedCarrier);
  }

  // Resolve label format
  const resolvedFormat: ShippingLabelFormat =
    String(input.labelFormat).toUpperCase() === 'A4'
      ? ShippingLabelFormat.A4
      : ShippingLabelFormat.THERMAL_4X6;

  const trackingUrl = getTrackingPortalUrl(resolvedCarrier, trackingNumber);
  const labelUrl = `/api/shipping/${quotation.id}/label?format=${resolvedFormat}`;

  // Upsert fulfillment record (1:1 with quotation)
  const fulfillment = await (prisma.shippingFulfillment as any).upsert({
    where: { quotationId: quotation.id },
    create: {
      quotationId: quotation.id,
      carrier: resolvedCarrier,
      trackingNumber,
      recipientName: input.recipientName.trim(),
      recipientPhone: input.recipientPhone.trim(),
      shippingAddress: input.shippingAddress.trim(),
      postalCode: input.postalCode.trim(),
      weightKg: Number(input.weightKg) || 1.0,
      status: ShippingStatus.LABEL_GENERATED,
      labelFormat: resolvedFormat,
      labelUrl,
      trackingUrl,
      metadata: input.metadata || null,
    },
    update: {
      carrier: resolvedCarrier,
      trackingNumber,
      recipientName: input.recipientName.trim(),
      recipientPhone: input.recipientPhone.trim(),
      shippingAddress: input.shippingAddress.trim(),
      postalCode: input.postalCode.trim(),
      weightKg: Number(input.weightKg) || 1.0,
      status: ShippingStatus.LABEL_GENERATED,
      labelFormat: resolvedFormat,
      labelUrl,
      trackingUrl,
      metadata: input.metadata || null,
      updatedAt: new Date(),
    },
    include: {
      quotation: {
        include: { items: true, customer: true, case: true },
      },
    },
  });

  // Stamp Audit Log
  await createAuditLog({
    caseId: quotation.caseId,
    actorId: input.createdById || null,
    actorName: 'LOGISTICS_SERVICE',
    action: 'SHIPPING_LABEL_GENERATED',
    actionType: 'SHIPPING_FULFILLMENT',
    entityType: 'ShippingFulfillment',
    entityId: fulfillment.id,
    details: JSON.stringify({
      quotationNumber: quotation.quotationNumber,
      carrier: resolvedCarrier,
      trackingNumber,
      format: resolvedFormat,
      recipientName: input.recipientName,
      postalCode: input.postalCode,
    }),
  });

  return fulfillment;
}

/**
 * 2. Get shipping fulfillment by ID, quotation ID, or tracking number.
 */
export async function getShippingFulfillment(identifier: string) {
  const fulfillment = await prisma.shippingFulfillment.findFirst({
    where: {
      OR: [
        { id: identifier },
        { quotationId: identifier },
        { trackingNumber: identifier },
        { quotation: { quotationNumber: identifier } },
      ],
    },
    include: {
      quotation: {
        include: {
          items: true,
          customer: true,
          case: true,
        },
      },
    },
  });

  return fulfillment;
}

/**
 * 3. List shipping fulfillments with filtering.
 */
export async function listShippingFulfillments(params: {
  status?: string;
  carrier?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
} = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.status) {
    where.status = params.status as ShippingStatus;
  }
  if (params.carrier) {
    where.carrier = normalizeCarrier(params.carrier);
  }
  if (params.search) {
    const s = params.search.trim();
    where.OR = [
      { trackingNumber: { contains: s, mode: 'insensitive' } },
      { recipientName: { contains: s, mode: 'insensitive' } },
      { recipientPhone: { contains: s, mode: 'insensitive' } },
      { quotation: { quotationNumber: { contains: s, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.shippingFulfillment.count({ where }),
    prisma.shippingFulfillment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        quotation: {
          include: { customer: true, case: true },
        },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 4. Update shipping fulfillment status or tracking details.
 */
export async function updateShippingStatus(
  identifier: string,
  updates: UpdateShippingInput,
  options: { actorId?: string; actorName?: string } = {}
) {
  const existing = await getShippingFulfillment(identifier);
  if (!existing) {
    throw new ShippingFulfillmentNotFoundError(identifier);
  }

  const data: any = { updatedAt: new Date() };

  if (updates.status) {
    data.status = updates.status;
  }

  if (updates.carrier) {
    data.carrier = normalizeCarrier(updates.carrier);
  }

  if (updates.trackingNumber) {
    const carrier = data.carrier || existing.carrier;
    assertValidTrackingNumber(carrier, updates.trackingNumber);
    data.trackingNumber = updates.trackingNumber.trim();
    data.trackingUrl = getTrackingPortalUrl(carrier, data.trackingNumber);
  }

  if (updates.weightKg !== undefined) {
    data.weightKg = Number(updates.weightKg);
  }

  if (updates.labelFormat) {
    data.labelFormat =
      String(updates.labelFormat).toUpperCase() === 'A4'
        ? ShippingLabelFormat.A4
        : ShippingLabelFormat.THERMAL_4X6;
    data.labelUrl = `/api/shipping/${existing.quotationId}/label?format=${data.labelFormat}`;
  }

  const updated = await prisma.shippingFulfillment.update({
    where: { id: existing.id },
    data,
    include: {
      quotation: {
        include: { items: true, customer: true, case: true },
      },
    },
  });

  await createAuditLog({
    caseId: existing.quotation?.caseId || null,
    actorId: options.actorId || null,
    actorName: options.actorName || 'LOGISTICS_SERVICE',
    action: 'SHIPPING_STATUS_UPDATED',
    actionType: 'SHIPPING_FULFILLMENT',
    entityType: 'ShippingFulfillment',
    entityId: existing.id,
    details: JSON.stringify({
      oldStatus: existing.status,
      newStatus: updated.status,
      trackingNumber: updated.trackingNumber,
    }),
  });

  return updated;
}

// =========================================================================
// Printable HTML Label Generators (Standard A4 & 4x6 Thermal)
// =========================================================================

/**
 * 5. Generates high-fidelity printable HTML for A4 Manifest or 4x6 Thermal Label.
 */
export async function generateShippingLabelHtml(
  identifier: string,
  formatOverride?: 'A4' | 'THERMAL_4X6' | string
): Promise<string> {
  const fulfillment = await getShippingFulfillment(identifier);

  let q: any;
  let f: any = fulfillment;

  if (fulfillment) {
    q = fulfillment.quotation;
  } else {
    // If fulfillment not found, try to look up quotation directly
    q = await prisma.quotation.findFirst({
      where: { OR: [{ id: identifier }, { quotationNumber: identifier }] },
      include: { items: true, customer: true, case: true },
    });

    if (!q) {
      throw new ShippingError(`Quotation or Fulfillment '${identifier}' not found`, 404, 'NOT_FOUND');
    }

    if (q.status !== QuotationStatus.PAID && q.status !== QuotationStatus.PRINTED && q.status !== QuotationStatus.COMPLETED) {
      throw new OrderNotPaidError(q.quotationNumber, q.status);
    }

    // Generate simulated fallback fulfillment for label preview
    const customer = q.customer;
    const carrier = ShippingCarrier.CENTRAL_EXPRESS;
    const trackingNo = generateTrackingNumber(carrier);
    f = {
      id: 'preview_fulfillment',
      carrier,
      trackingNumber: trackingNo,
      recipientName: customer?.displayName || customer?.name || 'Customer Recipient',
      recipientPhone: customer?.phone || '081-000-0000',
      shippingAddress: '1027 Ploenchit Road, Lumpini, Pathumwan',
      postalCode: '10330',
      weightKg: 1.25,
      status: ShippingStatus.LABEL_GENERATED,
      trackingUrl: getTrackingPortalUrl(carrier, trackingNo),
    };
  }

  const format = String(formatOverride || f.labelFormat || 'THERMAL_4X6').toUpperCase();

  if (format === 'A4') {
    return renderA4ShippingLabelHtml(q, f);
  } else {
    return renderThermal4x6LabelHtml(q, f);
  }
}

/**
 * Renders Standard A4 Shipping Manifest & Packing Slip HTML layout.
 */
function renderA4ShippingLabelHtml(quotation: any, fulfillment: any): string {
  const barcodeSvg = generateBarcodeSvg(fulfillment.trackingNumber, 48, true);
  const items = quotation.items || [];
  const grandTotal = Number(quotation.grandTotal || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const vatAmount = Number(quotation.vatAmount || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const subtotal = Number(quotation.subtotal || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const carrierName =
    fulfillment.carrier === ShippingCarrier.KERRY
      ? 'Kerry Express (Thailand)'
      : fulfillment.carrier === ShippingCarrier.FLASH
      ? 'Flash Express (Thailand)'
      : 'Central Express Logistics';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>Shipping Manifest - ${quotation.quotationNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1a202c;
      margin: 0;
      padding: 0;
      background: #fff;
      font-size: 13px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #e53e3e;
      letter-spacing: -0.5px;
    }
    .doc-type {
      font-size: 14px;
      font-weight: 600;
      color: #4a5568;
    }
    .meta-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
      padding: 12px;
      background: #f7fafc;
      border: 1px solid #edf2f7;
      border-radius: 6px;
    }
    .meta-col h4 {
      margin: 0 0 6px 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #718096;
    }
    .manifest-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .manifest-table th, .manifest-table td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      text-align: left;
    }
    .manifest-table th {
      background: #edf2f7;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
    }
    .financials {
      width: 280px;
      margin-left: auto;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 10px;
      background: #fafafa;
    }
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 12px;
    }
    .financial-row.grand {
      font-weight: 800;
      font-size: 14px;
      color: #2b6cb0;
      border-top: 1px solid #cbd5e0;
      padding-top: 6px;
      margin-top: 4px;
    }
    .cut-line {
      border-top: 2px dashed #cbd5e0;
      margin: 24px 0;
      position: relative;
      text-align: center;
    }
    .cut-line span {
      position: absolute;
      top: -9px;
      background: #fff;
      padding: 0 10px;
      font-size: 10px;
      color: #718096;
      font-weight: 600;
      text-transform: uppercase;
      transform: translateX(-50%);
    }
    .label-box {
      border: 2px solid #2d3748;
      border-radius: 8px;
      padding: 16px;
      background: #fff;
    }
    .barcode-container {
      text-align: center;
      margin: 12px 0;
    }
    .courier-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 12px;
      background: #2b6cb0;
      color: #fff;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-title">CENTRAL RETAIL</div>
      <div class="doc-type">ใบส่งสินค้าและใบปะหน้าพัสดุ (Packing Slip &amp; Shipping Manifest)</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 700; font-size: 14px;"># ${quotation.quotationNumber}</div>
      <div style="color: #718096; font-size: 11px;">วันที่: ${new Date().toLocaleDateString('th-TH')}</div>
    </div>
  </div>

  <!-- Sender & Recipient Information -->
  <div class="meta-box">
    <div class="meta-col">
      <h4>ผู้ส่ง (Ship From)</h4>
      <div style="font-weight: 700;">Central Department Store (E-Ordering Hub)</div>
      <div>1027 ถนนเพลินจิต แขวงลุมพินี เขตปทุมวัน</div>
      <div>กรุงเทพมหานคร 10330</div>
      <div>โทร: 02-793-7000 (Central Customer Care)</div>
    </div>
    <div class="meta-col">
      <h4>ผู้รับ (Ship To)</h4>
      <div style="font-weight: 700;">${fulfillment.recipientName}</div>
      <div>${fulfillment.shippingAddress}</div>
      <div>รหัสไปรษณีย์: <strong>${fulfillment.postalCode}</strong></div>
      <div>โทรศัพท์: <strong>${fulfillment.recipientPhone}</strong></div>
    </div>
  </div>

  <!-- Packing List Table -->
  <table class="manifest-table">
    <thead>
      <tr>
        <th style="width: 50px;">ลำดับ</th>
        <th style="width: 120px;">รหัสสินค้า (SKU)</th>
        <th>รายการสินค้า</th>
        <th style="width: 60px; text-align: center;">จำนวน</th>
        <th style="width: 90px; text-align: right;">ราคา/หน่วย</th>
        <th style="width: 100px; text-align: right;">ราคารวม</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item: any, idx: number) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace;">${item.sku}</td>
          <td>${item.productName || item.sku}</td>
          <td style="text-align: center; font-weight: 700;">${item.quantity}</td>
          <td style="text-align: right;">฿${Number(item.unitPrice).toFixed(2)}</td>
          <td style="text-align: right;">฿${Number(item.totalPrice).toFixed(2)}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <!-- Financial Breakdown -->
  <div class="financials">
    <div class="financial-row">
      <span>มูลค่าสินค้ารวม:</span>
      <span>฿${subtotal}</span>
    </div>
    <div class="financial-row">
      <span>ภาษีมูลค่าเพิ่ม 7%:</span>
      <span>฿${vatAmount}</span>
    </div>
    <div class="financial-row grand">
      <span>ยอดสุทธิ (ชำระแล้ว):</span>
      <span>฿${grandTotal}</span>
    </div>
  </div>

  <!-- Cut Line for Courier Label -->
  <div class="cut-line">
    <span>✂ ตัดตามรอยประเพื่อติดบนกล่องพัสดุ (Courier Waybill)</span>
  </div>

  <!-- Courier Label Cutout -->
  <div class="label-box">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span class="courier-badge">${carrierName}</span>
        <div style="font-size: 11px; color: #718096;">Tracking: <strong style="font-family: monospace; font-size: 14px; color: #1a202c;">${fulfillment.trackingNumber}</strong></div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 26px; font-weight: 900; letter-spacing: 2px;">${fulfillment.postalCode}</span>
        <div style="font-size: 10px; color: #718096;">DESTINATION HUB</div>
      </div>
    </div>

    <div class="barcode-container">
      ${barcodeSvg}
    </div>

    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-top: 8px; font-size: 12px;">
      <div>
        <strong>ผู้รับ:</strong> ${fulfillment.recipientName}<br>
        ${fulfillment.shippingAddress}<br>
        โทร: ${fulfillment.recipientPhone}
      </div>
      <div style="text-align: right; border-left: 1px solid #e2e8f0; padding-left: 12px;">
        <div style="font-weight: 800; color: #38a169;">ชำระเงินแล้ว (NON-COD)</div>
        <div style="font-size: 11px; color: #718096; margin-top: 4px;">น้ำหนัก: ${fulfillment.weightKg || 1.0} KG</div>
        <div style="font-size: 10px; color: #718096; margin-top: 2px;">Order: ${quotation.quotationNumber}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Renders High-Contrast 4x6 Thermal Label HTML (100mm x 150mm @ 203 DPI).
 */
function renderThermal4x6LabelHtml(quotation: any, fulfillment: any): string {
  const barcodeSvg = generateBarcodeSvg(fulfillment.trackingNumber, 52, true);

  const carrierName =
    fulfillment.carrier === ShippingCarrier.KERRY
      ? 'KERRY EXPRESS'
      : fulfillment.carrier === ShippingCarrier.FLASH
      ? 'FLASH EXPRESS'
      : 'CENTRAL EXPRESS';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>Thermal Label - ${fulfillment.trackingNumber}</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    body {
      width: 100mm;
      height: 150mm;
      margin: 0;
      padding: 5mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-wrapper {
      width: 100%;
      height: 100%;
      border: 3px solid #000;
      padding: 3mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header-row {
      border-bottom: 2px solid #000;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .carrier-title {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .routing-code {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 1px;
      text-align: right;
    }
    .barcode-section {
      text-align: center;
      padding: 2mm 0;
      border-bottom: 2px solid #000;
      margin-bottom: 2mm;
    }
    .recipient-section {
      border-bottom: 2px solid #000;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
      flex: 1;
    }
    .section-tag {
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      background: #000;
      color: #fff;
      padding: 1px 4px;
      display: inline-block;
      margin-bottom: 2px;
    }
    .recipient-name {
      font-size: 14px;
      font-weight: 900;
      margin-bottom: 2px;
    }
    .recipient-address {
      font-size: 11px;
      font-weight: 600;
      line-height: 1.3;
    }
    .recipient-phone {
      font-size: 12px;
      font-weight: 900;
      margin-top: 3px;
    }
    .sender-section {
      font-size: 9px;
      color: #222;
      border-bottom: 1px solid #000;
      padding-bottom: 1.5mm;
      margin-bottom: 1.5mm;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 10px;
    }
    .status-badge {
      font-size: 14px;
      font-weight: 900;
      border: 2px solid #000;
      padding: 2px 6px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="label-wrapper">
    <!-- Header: Carrier & Zip Code -->
    <div class="header-row">
      <div>
        <div class="carrier-title">${carrierName}</div>
        <div style="font-size: 9px; font-weight: bold;">CENTRAL CHAT &amp; SHOP</div>
      </div>
      <div>
        <div class="routing-code">${fulfillment.postalCode}</div>
        <div style="font-size: 8px; text-align: right; font-weight: bold;">DESTINATION ZIP</div>
      </div>
    </div>

    <!-- Barcode Section -->
    <div class="barcode-section">
      ${barcodeSvg}
    </div>

    <!-- Ship To Recipient -->
    <div class="recipient-section">
      <span class="section-tag">ผู้รับ / SHIP TO:</span>
      <div class="recipient-name">${fulfillment.recipientName}</div>
      <div class="recipient-address">${fulfillment.shippingAddress}</div>
      <div class="recipient-phone">TEL: ${fulfillment.recipientPhone}</div>
    </div>

    <!-- Ship From Sender -->
    <div class="sender-section">
      <strong>ผู้ส่ง (FROM):</strong> Central Department Store (Chidlom Hub)<br>
      1027 Ploenchit Rd, Lumpini, Pathumwan, Bangkok 10330<br>
      Tel: 02-793-7000
    </div>

    <!-- Footer: Non-COD & Order Reference -->
    <div class="footer-row">
      <div>
        <div class="status-badge">NON-COD / ชำระแล้ว</div>
      </div>
      <div style="text-align: right;">
        <div><strong>WT:</strong> ${fulfillment.weightKg || 1.0} KG</div>
        <div style="font-family: monospace; font-size: 11px;"># ${quotation.quotationNumber}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
