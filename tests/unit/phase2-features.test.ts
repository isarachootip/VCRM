import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildButtonCardTemplate,
  buildQuickRepliesMessage,
  buildCarouselTemplate,
  validateButtonCard,
  validateQuickReplies,
  validateCarousel,
  buildQuotationCreatedTemplate,
  buildPaymentReminderTemplate,
  buildPaymentConfirmedTemplate,
  buildQuotationExpiredTemplate,
  TemplateValidationError,
} from '../../src/lib/zwiz/templates';
import {
  validateTrackingNumber,
  generateTrackingNumber,
  getTrackingPortalUrl,
  generateBarcodeSvg,
  TrackingValidationError,
} from '../../src/lib/shipping/courier';
import {
  OrderNotPaidError,
  IncompleteAddressError,
  generateShippingLabelHtml,
} from '../../src/lib/shipping/service';
import {
  calculateLtv,
  calculateAov,
  calculatePurchaseFrequency,
  determinePreferredChannel,
  calculateCustomerEngagementScore,
} from '../../src/lib/customers/analytics';
import { QuotationStatus, ShippingCarrier } from '@prisma/client';

describe('Phase 2 Features Unit Verification (M15, M16, M17)', () => {
  // =========================================================================
  // 1. M15: Interactive Zwiz Templates & Quotation Notifications (R3)
  // =========================================================================
  describe('M15: Zwiz Interactive Templates & Builders', () => {
    test('buildButtonCardTemplate generates valid 1-4 buttons template', () => {
      const card = buildButtonCardTemplate(
        'สรุปรายการคำสั่งซื้อ #QT-2026-101',
        'ยอดชำระ ฿2,500.00 (รวม VAT 7%)',
        [
          { type: 'URI', label: 'ชำระเงินทันที', url: 'https://pay.central.co.th/pay/QT-2026-101' },
          { type: 'POSTBACK', label: 'ขอใบกำกับภาษี', data: 'action=tax_invoice&quote=QT-2026-101' },
          { type: 'MESSAGE', label: 'สอบถามข้อมูล', text: 'สอบถามข้อมูลใบเสนอราคา' },
        ],
        { thumbnailUrl: 'https://cdn.central.co.th/img/banner.jpg' }
      );

      assert.equal(card.messageType, 'BUTTON_CARD');
      assert.equal(card.card.title, 'สรุปรายการคำสั่งซื้อ #QT-2026-101');
      assert.equal(card.card.actions.length, 3);
      assert.equal(card.template.templateType, 'BUTTONS');
      assert.equal(card.card.actions[0].url, 'https://pay.central.co.th/pay/QT-2026-101');
    });

    test('validateButtonCard rejects card with 0 buttons or > 4 buttons', () => {
      // 0 buttons
      assert.throws(
        () => validateButtonCard({ title: 'Test', actions: [] }),
        (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_BUTTONS_TEMPLATE'
      );

      // 5 buttons (exceeds limit 4)
      const fiveActions = [
        { type: 'MESSAGE' as const, label: 'Btn 1', text: '1' },
        { type: 'MESSAGE' as const, label: 'Btn 2', text: '2' },
        { type: 'MESSAGE' as const, label: 'Btn 3', text: '3' },
        { type: 'MESSAGE' as const, label: 'Btn 4', text: '4' },
        { type: 'MESSAGE' as const, label: 'Btn 5', text: '5' },
      ];
      assert.throws(
        () => validateButtonCard({ title: 'Test', actions: fiveActions }),
        (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_BUTTONS_TEMPLATE'
      );
    });

    test('validateButtonCard rejects invalid action labels and missing targets', () => {
      // Empty label
      assert.throws(
        () => validateButtonCard({ title: 'Test', actions: [{ type: 'MESSAGE', label: '', text: 'hi' }] }),
        (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_ACTION_LABEL'
      );

      // Label exceeding 20 chars
      assert.throws(
        () =>
          validateButtonCard({
            title: 'Test',
            actions: [{ type: 'MESSAGE', label: 'This action label is definitely way too long', text: 'hi' }],
          }),
        (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_ACTION_LABEL'
      );

      // Missing target (no url, data, or text)
      assert.throws(
        () => validateButtonCard({ title: 'Test', actions: [{ type: 'POSTBACK', label: 'Click me' }] }),
        (err: any) => err instanceof TemplateValidationError && err.code === 'MISSING_ACTION_TARGET'
      );
    });

    test('buildQuickRepliesMessage generates 1-13 chips', () => {
      const qrs = buildQuickRepliesMessage('กรุณาเลือกวิธีการจัดส่งค่ะ', [
        { label: 'Kerry Express', action: 'POSTBACK', data: 'carrier=KERRY' },
        { label: 'Flash Express', action: 'POSTBACK', data: 'carrier=FLASH' },
        { label: 'รับที่สาขาชิดลม', action: 'POSTBACK', data: 'pickup=CHIDLOM' },
      ]);

      assert.equal(qrs.messageType, 'TEXT');
      assert.equal(qrs.content.text, 'กรุณาเลือกวิธีการจัดส่งค่ะ');
      assert.equal(qrs.quickReplies.length, 3);
      assert.equal(qrs.quickReplies[0].label, 'Kerry Express');
      assert.equal(qrs.quickReplies[0].data, 'carrier=KERRY');
    });

    test('validateQuickReplies rejects empty list or > 13 chips', () => {
      // 0 chips
      assert.throws(
        () => validateQuickReplies([]),
        (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_QUICK_REPLIES_TEMPLATE'
      );

      // 14 chips
      const fourteenChips = Array.from({ length: 14 }, (_, i) => ({
        label: `Chip ${i + 1}`,
        action: 'POSTBACK',
      }));
      assert.throws(
        () => validateQuickReplies(fourteenChips),
        (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_QUICK_REPLIES_TEMPLATE'
      );
    });

    test('buildCarouselTemplate generates 2-10 uniform cards', () => {
      const carousel = buildCarouselTemplate([
        {
          title: 'Lancôme Advanced Génifique 50ml',
          description: 'เซรั่มฟื้นบำรุงผิว ฿4,500',
          actions: [
            { type: 'URI', label: 'สั่งซื้อทันที', url: 'https://pay.central.co.th/p1' },
            { type: 'POSTBACK', label: 'ดูรายละเอียด', data: 'item=LANCOME50' },
          ],
        },
        {
          title: 'Estée Lauder ANR Synchronized 50ml',
          description: 'เซรั่มอันดับ 1 ฟื้นฟูผิวยามค่ำคืน ฿4,800',
          actions: [
            { type: 'URI', label: 'สั่งซื้อทันที', url: 'https://pay.central.co.th/p2' },
            { type: 'POSTBACK', label: 'ดูรายละเอียด', data: 'item=ESTEE50' },
          ],
        },
      ]);

      assert.equal(carousel.messageType, 'CAROUSEL');
      assert.equal(carousel.carousel.items.length, 2);
      assert.equal(carousel.carousel.items[0].actions.length, 2);
      assert.equal(carousel.carousel.items[1].actions.length, 2);
    });

    test('validateCarousel rejects non-uniform action count across cards', () => {
      // Card 0 has 2 actions, Card 1 has 1 action -> NON_UNIFORM_CAROUSEL_ACTIONS
      assert.throws(
        () =>
          validateCarousel([
            {
              title: 'Card 1',
              actions: [
                { type: 'MESSAGE', label: 'Action 1', text: '1' },
                { type: 'MESSAGE', label: 'Action 2', text: '2' },
              ],
            },
            {
              title: 'Card 2',
              actions: [{ type: 'MESSAGE', label: 'Action 1', text: '1' }],
            },
          ]),
        (err: any) => err instanceof TemplateValidationError && err.code === 'NON_UNIFORM_CAROUSEL_ACTIONS'
      );
    });

    test('Quotation lifecycle builders produce valid templates', () => {
      // 1. Quotation Created
      const createdCard = buildQuotationCreatedTemplate({
        quotationNumber: 'QT-2026-9901',
        grandTotal: 3500.0,
        paymentLinkUrl: 'https://pay.central.co.th/pay/QT-2026-9901',
        items: [{ sku: 'SKU-1', productName: 'Dress', quantity: 1, unitPrice: 3500 }],
      });
      assert.equal(createdCard.messageType, 'BUTTON_CARD');
      assert.ok(createdCard.card.title.includes('QT-2026-9901'));
      assert.equal(createdCard.card.actions[0].url, 'https://pay.central.co.th/pay/QT-2026-9901');

      // 2. Payment Reminder (urgent)
      const reminderCard = buildPaymentReminderTemplate(
        {
          quotationNumber: 'QT-2026-9901',
          grandTotal: 3500.0,
          paymentLinkUrl: 'https://pay.central.co.th/pay/QT-2026-9901',
        },
        true
      );
      assert.ok(reminderCard.card.title.includes('ด่วน'));
      assert.equal(reminderCard.card.actions[0].label, 'ชำระเงินด่วน');

      // 3. Payment Confirmed
      const confirmedCard = buildPaymentConfirmedTemplate(
        {
          quotationNumber: 'QT-2026-9901',
          grandTotal: 3500.0,
        },
        {
          transactionNumber: 'TX-BANK-2026-001',
          amount: 3500.0,
        }
      );
      assert.ok(confirmedCard.card.title.includes('ยืนยัน'));
      assert.ok(confirmedCard.card.subtitle?.includes('TX-BANK-2026-001'));

      // 4. Quotation Expired
      const expiredCard = buildQuotationExpiredTemplate({
        quotationNumber: 'QT-2026-9901',
      });
      assert.ok(expiredCard.card.title.includes('หมดอายุ'));
      assert.equal(expiredCard.card.actions[0].label, 'ขอออกใบเสนอราคาใหม่');
    });
  });

  // =========================================================================
  // 2. M16: Automated Shipping Label Generation & Courier Tracking (R4)
  // =========================================================================
  describe('M16: Courier Tracking & Printable Labels', () => {
    test('validateTrackingNumber validates Kerry, Flash, and Central Express regexes', () => {
      // Kerry: KEX/SHP/KER + 8-12 alphanumeric + TH, or 10-13 digits
      assert.equal(validateTrackingNumber('KERRY', 'KEX102938475TH'), true);
      assert.equal(validateTrackingNumber('KERRY', 'SHP9921004412'), true);
      assert.equal(validateTrackingNumber('KERRY', '123456789012'), true);
      assert.equal(validateTrackingNumber('KERRY', 'KEX123!!TH'), false);
      assert.equal(validateTrackingNumber('KERRY', 'ABC12345'), false);

      // Flash: TH or FLS + 10-14 alphanumeric
      assert.equal(validateTrackingNumber('FLASH', 'TH01029384756A'), true);
      assert.equal(validateTrackingNumber('FLASH', 'FLS8839201948'), true);
      assert.equal(validateTrackingNumber('FLASH', '12345'), false);
      assert.equal(validateTrackingNumber('FLASH', 'FLASH001'), false);

      // Central Express: CTEX-[year]-[6-8 digits]TH or CTEX + 8-12 alphanumeric
      assert.equal(validateTrackingNumber('CENTRAL_EXPRESS', 'CTEX-2026-009182TH'), true);
      assert.equal(validateTrackingNumber('CENTRAL_EXPRESS', 'CTEX98210344'), true);
      assert.equal(validateTrackingNumber('CENTRAL_EXPRESS', 'CTEX'), false);
      assert.equal(validateTrackingNumber('CENTRAL_EXPRESS', 'INVALID'), false);
    });

    test('generateTrackingNumber generates compliant tracking numbers', () => {
      const kerryTrack = generateTrackingNumber(ShippingCarrier.KERRY);
      assert.equal(validateTrackingNumber(ShippingCarrier.KERRY, kerryTrack), true, `Kerry tracking ${kerryTrack} must be valid`);

      const flashTrack = generateTrackingNumber(ShippingCarrier.FLASH);
      assert.equal(validateTrackingNumber(ShippingCarrier.FLASH, flashTrack), true, `Flash tracking ${flashTrack} must be valid`);

      const ctexTrack = generateTrackingNumber(ShippingCarrier.CENTRAL_EXPRESS);
      assert.equal(validateTrackingNumber(ShippingCarrier.CENTRAL_EXPRESS, ctexTrack), true, `CTEX tracking ${ctexTrack} must be valid`);
    });

    test('getTrackingPortalUrl formats carrier tracking links', () => {
      const kerryUrl = getTrackingPortalUrl(ShippingCarrier.KERRY, 'KEX102938475TH');
      assert.ok(kerryUrl.includes('th.kerryexpress.com'));
      assert.ok(kerryUrl.includes('KEX102938475TH'));

      const flashUrl = getTrackingPortalUrl(ShippingCarrier.FLASH, 'TH01029384756A');
      assert.ok(flashUrl.includes('flashexpress.co.th'));
      assert.ok(flashUrl.includes('TH01029384756A'));

      const ctexUrl = getTrackingPortalUrl(ShippingCarrier.CENTRAL_EXPRESS, 'CTEX-2026-009182TH');
      assert.ok(ctexUrl.includes('delivery.central.co.th'));
      assert.ok(ctexUrl.includes('CTEX-2026-009182TH'));
    });

    test('generateBarcodeSvg produces valid SVG Code 128 markup', () => {
      const svg = generateBarcodeSvg('KEX102938475TH', 40, true);
      assert.ok(svg.startsWith('<svg'));
      assert.ok(svg.includes('</svg>'));
      assert.ok(svg.includes('<rect'));
      assert.ok(svg.includes('KEX102938475TH'));
    });

    test('OrderNotPaidError guards non-paid quotation fulfillment', () => {
      const err = new OrderNotPaidError('QT-2026-001', 'DRAFT');
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'ORDER_NOT_PAID');
      assert.ok(err.message.includes('PAID or PRINTED'));
    });

    test('IncompleteAddressError checks missing address fields', () => {
      const err = new IncompleteAddressError(['postalCode', 'shippingAddress']);
      assert.equal(err.statusCode, 422);
      assert.equal(err.code, 'INCOMPLETE_ADDRESS');
      assert.deepEqual(err.details.missingFields, ['postalCode', 'shippingAddress']);
    });
  });

  // =========================================================================
  // 3. M17: Customer 360 & Behavioral Analytics (R5)
  // =========================================================================
  describe('M17: Customer 360 Behavioral Analytics', () => {
    test('calculateLtv sums grandTotal across PAID, PRINTED, COMPLETED quotations', () => {
      const quotations = [
        { status: QuotationStatus.PAID, grandTotal: 2500.0 },
        { status: QuotationStatus.PRINTED, grandTotal: 1500.0 },
        { status: QuotationStatus.COMPLETED, grandTotal: 5000.0 },
        // These should be excluded:
        { status: QuotationStatus.DRAFT, grandTotal: 9999.0 },
        { status: QuotationStatus.PENDING_PAYMENT, grandTotal: 4000.0 },
        { status: QuotationStatus.CANCEL, grandTotal: 1000.0 },
        { status: QuotationStatus.VOID, grandTotal: 2000.0 },
        { status: QuotationStatus.EXPIRED, grandTotal: 3000.0 },
      ];

      const ltv = calculateLtv(quotations);
      // 2500 + 1500 + 5000 = 9000
      assert.equal(ltv, 9000.0);
    });

    test('calculateLtv returns 0.00 for empty or unpaid customer orders', () => {
      assert.equal(calculateLtv([]), 0.0);
      assert.equal(
        calculateLtv([
          { status: QuotationStatus.DRAFT, grandTotal: 1000 },
          { status: QuotationStatus.EXPIRED, grandTotal: 2000 },
        ]),
        0.0
      );
    });

    test('calculateAov handles zero-order divide-by-zero gracefully', () => {
      // Divide-by-zero protection
      assert.equal(calculateAov(0.0, 0), 0.0);
      assert.equal(calculateAov(10000.0, 0), 0.0);

      // Normal division: ฿9,000 across 3 orders = ฿3,000.00
      assert.equal(calculateAov(9000.0, 3), 3000.0);
      // Floating division rounding: ฿10,000 across 3 orders = ฿3,333.33
      assert.equal(calculateAov(10000.0, 3), 3333.33);
    });

    test('calculatePurchaseFrequency computes orders per 30 days', () => {
      const now = new Date();
      // Customer created 60 days ago (2 thirty-day periods)
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400 * 1000);

      // 4 orders in 60 days = 2.0 orders per 30 days
      const freq = calculatePurchaseFrequency(4, sixtyDaysAgo);
      assert.equal(freq, 2.0);

      // Zero orders = 0.0
      assert.equal(calculatePurchaseFrequency(0, sixtyDaysAgo), 0.0);

      // Customer created today (day 0/1) with 1 order
      assert.equal(calculatePurchaseFrequency(1, now), 1.0);
    });

    test('determinePreferredChannel resolves dominant channel with tie-breaker', () => {
      const cases = [
        { channel: 'LINE', createdAt: new Date('2026-09-10T10:00:00Z') },
        { channel: 'LINE', createdAt: new Date('2026-09-11T10:00:00Z') },
        { channel: 'FB', createdAt: new Date('2026-09-12T10:00:00Z') },
      ];
      const sessions = [
        { channel: 'LINE', startDateTime: new Date('2026-09-10T10:00:00Z') },
        { channel: 'FACEBOOK', startDateTime: new Date('2026-09-12T15:00:00Z') },
      ];

      // LINE count: 2 cases + 1 session = 3
      // FB count: 1 case + 1 session = 2
      const preferred = determinePreferredChannel(cases, sessions);
      assert.equal(preferred, 'LINE');

      // Tie test: 2 LINE vs 2 FB, but FB was most recent
      const tiedCases = [
        { channel: 'LINE', createdAt: new Date('2026-09-10T10:00:00Z') },
        { channel: 'FB', createdAt: new Date('2026-09-12T18:00:00Z') },
      ];
      const tiedSessions = [
        { channel: 'LINE', startDateTime: new Date('2026-09-11T10:00:00Z') },
        { channel: 'FB', startDateTime: new Date('2026-09-12T19:00:00Z') },
      ];
      const tiedWinner = determinePreferredChannel(tiedCases, tiedSessions);
      assert.equal(tiedWinner, 'FACEBOOK');
    });

    test('calculateCustomerEngagementScore computes 0-100 index and assigns loyalty tier', () => {
      // 1. Platinum Customer: high spend, frequent, recent, high CSAT
      const platinum = calculateCustomerEngagementScore({
        daysSinceLastActivity: 2, // recent (< 90 days)
        sessionCount: 8,
        paidOrderCount: 6,
        ltv: 120000, // > 100k
        csatScores: [5, 5, 4],
      });
      assert.ok(platinum.score >= 85, `Score should be >= 85, got ${platinum.score}`);
      assert.equal(platinum.tier, 'PLATINUM');

      // 2. Gold Customer
      const gold = calculateCustomerEngagementScore({
        daysSinceLastActivity: 10,
        sessionCount: 4,
        paidOrderCount: 3,
        ltv: 45000, // 30k-100k
        csatScores: [4, 4],
      });
      assert.ok(gold.score >= 70, `Score should be >= 70, got ${gold.score}`);
      assert.equal(gold.tier, 'GOLD');

      // 3. Bronze Customer: dormant, 0 spend
      const bronze = calculateCustomerEngagementScore({
        daysSinceLastActivity: 120, // dormant > 90 days
        sessionCount: 0,
        paidOrderCount: 0,
        ltv: 0,
        csatScores: [],
      });
      assert.ok(bronze.score < 50, `Score should be < 50, got ${bronze.score}`);
      assert.equal(bronze.tier, 'BRONZE');

      // Score clamped to [0, 100]
      assert.ok(platinum.score <= 100);
      assert.ok(bronze.score >= 0);
    });
  });
});
