/**
 * Interactive Zwiz.AI Template Builders and Validators (R3 - Phase 2)
 * Path: src/lib/zwiz/templates.ts
 *
 * Implements:
 * - BUTTONS card template (1-4 action buttons, title, subtitle, thumbnail)
 * - QUICK_REPLIES message template (1-13 quick reply chips)
 * - CAROUSEL template (2-10 uniform cards, 1-3 actions per card)
 * - Template validators with strict constraint validation
 * - Specialized builders for Quotation Lifecycle chat notifications
 */

export type ButtonActionType = 'URI' | 'POSTBACK' | 'MESSAGE';

export interface ButtonAction {
  type: ButtonActionType;
  label: string;
  url?: string;
  data?: string;
  text?: string;
}

export interface ButtonCardPayload {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  actions: ButtonAction[];
}

export interface QuickReplyItem {
  label: string;
  action?: 'POSTBACK' | 'MESSAGE' | 'URI' | string;
  data?: string;
  text?: string;
  url?: string;
  value?: string;
}

export interface QuickRepliesMessagePayload {
  messageType: 'TEXT' | string;
  content: {
    text: string;
  };
  quickReplies: QuickReplyItem[];
}

export interface CarouselCardItem {
  title: string;
  description?: string;
  imageUrl?: string;
  actions: ButtonAction[];
}

export interface CarouselPayload {
  items: CarouselCardItem[];
}

export class TemplateValidationError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 422, code = 'TEMPLATE_VALIDATION_ERROR', details?: any) {
    super(message);
    this.name = 'TemplateValidationError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Validates a BUTTON action item.
 */
export function validateButtonAction(action: ButtonAction, index?: number): void {
  if (!action || typeof action !== 'object') {
    throw new TemplateValidationError(
      `Invalid action${index !== undefined ? ` at index ${index}` : ''}: must be an object`,
      422,
      'INVALID_ACTION'
    );
  }

  const label = typeof action.label === 'string' ? action.label.trim() : '';
  if (!label || label.length > 20) {
    throw new TemplateValidationError(
      'Invalid BUTTONS action: label must be 1-20 characters',
      422,
      'INVALID_ACTION_LABEL',
      { action, index }
    );
  }

  const hasTarget = Boolean(
    (action.url && action.url.trim().length > 0) ||
    (action.data && action.data.trim().length > 0) ||
    (action.text && action.text.trim().length > 0)
  );

  if (!hasTarget) {
    throw new TemplateValidationError(
      'Invalid BUTTONS action: target url, data, or text is required',
      422,
      'MISSING_ACTION_TARGET',
      { action, index }
    );
  }

  if (action.type === 'URI' && action.url) {
    try {
      new URL(action.url);
    } catch {
      throw new TemplateValidationError(
        `Invalid URI format for action '${label}': ${action.url}`,
        422,
        'INVALID_URI_FORMAT',
        { action, index }
      );
    }
  }
}

/**
 * Validates a BUTTONS / BUTTON_CARD template.
 * Constraints:
 * - Title: 1-160 characters.
 * - Subtitle: max 200 characters.
 * - Actions: 1-4 buttons.
 * - Action labels: 1-20 characters.
 */
export function validateButtonCard(card: ButtonCardPayload): void {
  if (!card || typeof card !== 'object') {
    throw new TemplateValidationError('Card payload must be an object', 422, 'INVALID_CARD');
  }

  const title = typeof card.title === 'string' ? card.title.trim() : '';
  if (!title) {
    throw new TemplateValidationError(
      'Invalid BUTTONS card: title is required and cannot be empty',
      422,
      'MISSING_TITLE'
    );
  }
  if (title.length > 160) {
    throw new TemplateValidationError(
      'Invalid BUTTONS card: title exceeds 160 characters',
      422,
      'TITLE_TOO_LONG'
    );
  }

  if (card.subtitle && card.subtitle.length > 200) {
    throw new TemplateValidationError(
      'Invalid BUTTONS card: subtitle exceeds 200 characters',
      422,
      'SUBTITLE_TOO_LONG'
    );
  }

  const actions = card.actions;
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > 4) {
    throw new TemplateValidationError(
      'Invalid BUTTONS template: requires 1-4 actions with valid labels and targets',
      422,
      'INVALID_BUTTONS_TEMPLATE',
      { actualActionsCount: Array.isArray(actions) ? actions.length : 0 }
    );
  }

  actions.forEach((act, idx) => validateButtonAction(act, idx));
}

/**
 * Validates a QUICK_REPLIES chip array.
 * Constraints:
 * - Count: 1-13 chips.
 * - Chip label: 1-20 characters.
 */
export function validateQuickReplies(quickReplies: QuickReplyItem[]): void {
  if (!Array.isArray(quickReplies) || quickReplies.length < 1 || quickReplies.length > 13) {
    throw new TemplateValidationError(
      'Invalid QUICK_REPLIES template: requires 1-13 quick reply items',
      422,
      'INVALID_QUICK_REPLIES_TEMPLATE',
      { actualCount: Array.isArray(quickReplies) ? quickReplies.length : 0 }
    );
  }

  quickReplies.forEach((item, idx) => {
    const label = item?.label || (item as any)?.action?.label;
    if (!label || typeof label !== 'string' || label.trim().length === 0 || label.length > 20) {
      throw new TemplateValidationError(
        'Invalid QUICK_REPLIES item: label must be 1-20 characters',
        422,
        'INVALID_QUICK_REPLY_LABEL',
        { item, index: idx }
      );
    }
  });
}

/**
 * Validates a CAROUSEL template.
 * Constraints:
 * - Items: 2-10 cards.
 * - Each item: 1-3 actions.
 * - All cards must have uniform action count.
 */
export function validateCarousel(items: CarouselCardItem[]): void {
  if (!Array.isArray(items) || items.length < 2 || items.length > 10) {
    throw new TemplateValidationError(
      'Invalid CAROUSEL template: requires 2-10 items with uniform action count',
      422,
      'INVALID_CAROUSEL_COUNT',
      { actualCount: Array.isArray(items) ? items.length : 0 }
    );
  }

  const standardActionCount = items[0]?.actions?.length ?? 0;
  if (standardActionCount < 1 || standardActionCount > 3) {
    throw new TemplateValidationError(
      'Invalid CAROUSEL item: each item requires 1-3 actions',
      422,
      'INVALID_CAROUSEL_ACTIONS_COUNT',
      { standardActionCount }
    );
  }

  for (let i = 0; i < items.length; i++) {
    const card = items[i];
    if (!card || typeof card !== 'object') {
      throw new TemplateValidationError(
        `Invalid CAROUSEL item at index ${i}: item must be an object`,
        422,
        'INVALID_CAROUSEL_ITEM'
      );
    }

    const title = typeof card.title === 'string' ? card.title.trim() : '';
    if (!title) {
      throw new TemplateValidationError(
        `Invalid CAROUSEL item at index ${i}: title is required`,
        422,
        'MISSING_CAROUSEL_TITLE'
      );
    }

    const colActionCount = card.actions?.length ?? 0;
    if (colActionCount !== standardActionCount) {
      throw new TemplateValidationError(
        `Invalid CAROUSEL template: items must have uniform action count (item 0 has ${standardActionCount}, item ${i} has ${colActionCount})`,
        422,
        'NON_UNIFORM_CAROUSEL_ACTIONS',
        { itemIndex: i, colActionCount, standardActionCount }
      );
    }

    card.actions.forEach((act, actIdx) => validateButtonAction(act, actIdx));
  }
}

// =========================================================================
// Template Message Builders
// =========================================================================

/**
 * Builds a validated BUTTON_CARD / BUTTONS template payload.
 */
export function buildButtonCardTemplate(
  title: string,
  subtitle = '',
  actions: ButtonAction[] = [],
  options: { thumbnailUrl?: string; templateType?: string } = {}
) {
  const card: ButtonCardPayload = {
    title,
    subtitle,
    thumbnailUrl: options.thumbnailUrl,
    actions,
  };

  validateButtonCard(card);

  return {
    messageType: 'BUTTON_CARD',
    card,
    template: {
      templateType: options.templateType || 'BUTTONS',
      title,
      subtitle,
      thumbnailUrl: options.thumbnailUrl,
      actions,
    },
    actions, // Direct actions array for mock server fallback
  };
}

/**
 * Builds a validated QUICK_REPLIES message payload.
 */
export function buildQuickRepliesMessage(text: string, quickReplies: QuickReplyItem[]) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new TemplateValidationError('Message text cannot be empty for quick replies', 422, 'EMPTY_TEXT');
  }

  validateQuickReplies(quickReplies);

  const formattedQuickReplies = quickReplies.map((qr) => ({
    label: qr.label,
    action: qr.action || 'POSTBACK',
    data: qr.data || qr.value || `action=${encodeURIComponent(qr.label)}`,
    text: qr.text || qr.label,
    url: qr.url,
  }));

  return {
    messageType: 'TEXT',
    content: {
      text,
    },
    quickReplies: formattedQuickReplies,
  };
}

/**
 * Builds a validated CAROUSEL template payload.
 */
export function buildCarouselTemplate(items: CarouselCardItem[]) {
  validateCarousel(items);

  return {
    messageType: 'CAROUSEL',
    carousel: {
      items,
    },
    template: {
      templateType: 'CAROUSEL',
      columns: items,
      items,
    },
  };
}

// =========================================================================
// Specialized Quotation Lifecycle Template Builders
// =========================================================================

/**
 * 1. Quotation Created: secure payment link button card.
 */
export function buildQuotationCreatedTemplate(quotation: {
  quotationNumber: string;
  grandTotal: number | string;
  paymentLinkUrl?: string | null;
  expiresAt?: Date | string | null;
  items?: Array<{ productName?: string; sku: string; quantity: number; unitPrice: number }>;
}) {
  const total = Number(quotation.grandTotal).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const paymentUrl =
    quotation.paymentLinkUrl ||
    `https://pay.central.co.th/pay/${encodeURIComponent(quotation.quotationNumber)}`;

  const itemCount = quotation.items?.length || 1;
  const subtitle = `ยอดชำระสุทธิ ฿${total} (${itemCount} รายการ) • ลิงก์ชำระเงินมีอายุ 24 ชม.`;

  const actions: ButtonAction[] = [
    {
      type: 'URI',
      label: 'ชำระเงินทันที',
      url: paymentUrl,
    },
    {
      type: 'POSTBACK',
      label: 'ขอใบเสนอราคาฉบับย่อ',
      data: `action=view_summary&quote=${quotation.quotationNumber}`,
    },
    {
      type: 'MESSAGE',
      label: 'สอบถามข้อมูลเพิ่มเติม',
      text: `สอบถามข้อมูลใบเสนอราคา ${quotation.quotationNumber}`,
    },
  ];

  return buildButtonCardTemplate(
    `ใบเสนอราคา #${quotation.quotationNumber}`,
    subtitle,
    actions,
    {
      templateType: 'PAYMENT_LINK',
      thumbnailUrl: 'https://cdn.central.co.th/media/quotation-card-banner.png',
    }
  );
}

/**
 * 2. Payment Reminder: pending quotation reminder card.
 */
export function buildPaymentReminderTemplate(
  quotation: {
    quotationNumber: string;
    grandTotal: number | string;
    paymentLinkUrl?: string | null;
    expiresAt?: Date | string | null;
  },
  urgent = false
) {
  const total = Number(quotation.grandTotal).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const paymentUrl =
    quotation.paymentLinkUrl ||
    `https://pay.central.co.th/pay/${encodeURIComponent(quotation.quotationNumber)}`;

  const title = urgent
    ? `⚠️ แจ้งเตือนด่วน: ใบเสนอราคาใกล้หมดอายุ #${quotation.quotationNumber}`
    : `⏰ แจ้งเตือนการชำระเงิน #${quotation.quotationNumber}`;

  const subtitle = urgent
    ? `ยอดชำระ ฿${total} ลิงก์ชำระเงินจะหมดอายุในอีก 2 ชั่วโมง กรุณาชำระเงินเพื่อยืนยันรายการ`
    : `ยอดชำระ ฿${total} ท่านสามารถกดชำระเงินผ่านลิงก์ปลอดภัยด้านล่างได้ทันที`;

  const actions: ButtonAction[] = [
    {
      type: 'URI',
      label: urgent ? 'ชำระเงินด่วน' : 'ชำระเงินทันที',
      url: paymentUrl,
    },
    {
      type: 'MESSAGE',
      label: 'ติดต่อเจ้าหน้าที่',
      text: `ต้องการความช่วยเหลือในการชำระเงินสำหรับใบเสนอราคา ${quotation.quotationNumber}`,
    },
  ];

  return buildButtonCardTemplate(title, subtitle, actions, {
    templateType: 'PAYMENT_REMINDER',
    thumbnailUrl: urgent
      ? 'https://cdn.central.co.th/media/urgent-reminder-banner.png'
      : 'https://cdn.central.co.th/media/reminder-banner.png',
  });
}

/**
 * 3. Payment Confirmed: payment receipt confirmation with order summary.
 */
export function buildPaymentConfirmedTemplate(
  quotation: {
    quotationNumber: string;
    grandTotal: number | string;
    businessUnit?: string;
  },
  payment?: {
    transactionNumber?: string;
    paymentMethod?: string;
    amount?: number | string;
  }
) {
  const amount = Number(payment?.amount ?? quotation.grandTotal).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const txNo = payment?.transactionNumber || 'AUTO_RECONCILED';
  const title = `✅ ยืนยันการชำระเงินเรียบร้อยแล้ว`;
  const subtitle = `คำสั่งซื้อ #${quotation.quotationNumber} • ยอดที่ชำระ ฿${amount} (Ref: ${txNo}) • เจ้าหน้าที่กำลังจัดเตรียมสินค้าเพื่อจัดส่ง`;

  const actions: ButtonAction[] = [
    {
      type: 'POSTBACK',
      label: 'ดูสถานะการจัดส่ง',
      data: `action=track_shipping&quote=${quotation.quotationNumber}`,
    },
    {
      type: 'MESSAGE',
      label: 'แจ้งข้อมูลใบกำกับภาษี',
      text: `ต้องการขอใบกำกับภาษีเต็มรูปสำหรับคำสั่งซื้อ ${quotation.quotationNumber}`,
    },
  ];

  return buildButtonCardTemplate(title, subtitle, actions, {
    templateType: 'PAYMENT_CONFIRMATION',
    thumbnailUrl: 'https://cdn.central.co.th/media/payment-success-banner.png',
  });
}

/**
 * 4. Quotation Expired: payment expired notice.
 */
export function buildQuotationExpiredTemplate(quotation: {
  quotationNumber: string;
  grandTotal?: number | string;
}) {
  const title = `⌛ ใบเสนอราคาหมดอายุแล้ว`;
  const subtitle = `ใบเสนอราคา #${quotation.quotationNumber} หมดอายุการชำระเงินแล้ว ท่านสามารถติดต่อเจ้าหน้าที่เพื่อขอออกใบเสนอราคาใหม่`;

  const actions: ButtonAction[] = [
    {
      type: 'MESSAGE',
      label: 'ขอออกใบเสนอราคาใหม่',
      text: `ต้องการขอออกใบเสนอราคาใหม่สำหรับ #${quotation.quotationNumber}`,
    },
    {
      type: 'MESSAGE',
      label: 'สอบถามเจ้าหน้าที่',
      text: `สอบถามสินค้าจากใบเสนอราคาเดิม #${quotation.quotationNumber}`,
    },
  ];

  return buildButtonCardTemplate(title, subtitle, actions, {
    templateType: 'BUTTONS',
    thumbnailUrl: 'https://cdn.central.co.th/media/quotation-expired-banner.png',
  });
}
