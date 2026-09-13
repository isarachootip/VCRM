import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { CourierMockServer } from '../../mocks/courier-mock-server';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';
const COURIER_MOCK_URL = process.env.COURIER_MOCK_URL || 'http://127.0.0.1:4040';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 4.6: Phase 2 Real-World Multi-BU Operational Scenarios (R1 - R7)', () => {
  let courierServer: CourierMockServer | null = null;

  before(async () => {
    await globalSupervisor.startAll();
    try {
      const check = await fetch(`${COURIER_MOCK_URL}/health`);
      if (!check.ok) throw new Error();
    } catch {
      courierServer = new CourierMockServer(4040);
      await courierServer.start();
    }
  });

  after(async () => {
    if (courierServer) await courierServer.stop();
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
    await fetch(`${COURIER_MOCK_URL}/mock/courier/control/reset`, { method: 'DELETE' });
  });

  // =========================================================================
  // Scenario 4.6.1: Central Department Store Chidlom VIP Luxury EOR Journey
  // =========================================================================
  test('Scenario 4.6.1 - Central Chidlom VIP Luxury EOR Omnichannel Journey (EOR metadata, RBAC masking, Kerry 4x6 label, delivery webhook, Customer 360)', async () => {
    // 1. Inbound VIP chat on LINE for Central Department Store Chidlom
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_vip_eor_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_chidlom_luxury',
          pageName: 'Central Chidlom Luxury',
          businessUnit: 'Central',
          senderId: 'U_chidlom_vip_somchai_99',
          senderName: 'Khun Somchai Chidlom VIP'
        },
        session: { sessionId: `sess_chidlom_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_chidlom_${Date.now()}`,
          type: 'TEXT',
          text: 'สวัสดีครับ สนใจสั่งซื้อ Dyson V12 Detect Slim สาขาชิดลม มีสินค้าพร้อมส่งไหมครับ'
        }
      })
    });
    assert.equal(inboundRes.status, 200);
    const { caseId, customerId } = await inboundRes.json();
    assert.ok(caseId, 'Case ID must be returned');
    assert.ok(customerId, 'Customer ID must be returned');

    // 2. Dispatch case to EOR desk and stamp specialized EOR metadata
    const eorStampRes = await fetch(`${APP_URL}/api/cases/${caseId}/eor-fields?role=EOR_AGENT`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketNumber: 'TKT-EOR-CHIDLOM-9921',
        sellingStoreName: 'Central Department Store Chidlom (Store #001)',
        staffId: 'STF-CHIDLOM-8842',
        customMetadata: {
          department: 'Small Appliances & Luxury Home',
          requestedDeliveryDate: '2026-09-15',
          vipConcierge: 'Khun Praew'
        }
      })
    });
    assert.equal(eorStampRes.status, 200);
    const stampedEor = await eorStampRes.json();
    assert.equal(stampedEor.ticketNumber, 'TKT-EOR-CHIDLOM-9921');

    // 3. Verify Role-Based Field Masking:
    // Non-EOR frontline agent sees masked fields ('••••••••')
    const frontlineViewRes = await fetch(`${APP_URL}/api/cases/${caseId}?role=AGENT`);
    assert.equal(frontlineViewRes.status, 200);
    const frontlineCase = await frontlineViewRes.json();
    assert.ok(frontlineCase.eorDetails, 'eorDetails should be present');
    assert.equal(frontlineCase.eorDetails.ticketNumber, '••••••••');
    assert.equal(frontlineCase.eorDetails.sellingStoreName, '••••••••');
    assert.equal(frontlineCase.eorDetails.staffId, '••••••••');

    // EOR agent sees plain unmasked fields
    const eorViewRes = await fetch(`${APP_URL}/api/cases/${caseId}?role=EOR_AGENT`);
    assert.equal(eorViewRes.status, 200);
    const eorCase = await eorViewRes.json();
    assert.equal(eorCase.eorDetails.ticketNumber, 'TKT-EOR-CHIDLOM-9921');
    assert.equal(eorCase.eorDetails.sellingStoreName, 'Central Department Store Chidlom (Store #001)');

    // 4. Create Quotation for Dyson V12 (28,900 THB)
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        businessUnit: 'Central',
        items: [
          {
            sku: 'DYSON-V12-SLIM',
            productName: 'Dyson V12 Detect Slim Fluffy Extra',
            quantity: 1,
            unitPrice: 28900.00
          }
        ]
      })
    });
    assert.equal(quoteRes.status, 201);
    const { quotation } = await quoteRes.json();
    assert.equal(quotation.grandTotal, 28900.00);

    // 5. Send automated interactive Payment Link card via Zwiz API
    const templateRes = await fetch(`${APP_URL}/api/templates/interactive/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: 'U_chidlom_vip_somchai_99',
        channel: 'LINE',
        type: 'PAYMENT_LINK',
        title: 'Central Chidlom - ยืนยันคำสั่งซื้อ Dyson V12',
        description: 'ยอดชำระ 28,900.00 บาท กรุณากดลิงก์ด้านล่างเพื่อชำระเงินอย่างปลอดภัย',
        paymentUrl: `https://payment.central.co.th/pay/${quotation.id}`,
        amount: quotation.grandTotal
      })
    });
    assert.equal(templateRes.status, 200);

    // Verify captured template in Zwiz Mock
    const zwizInspectRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/templates`);
    assert.equal(zwizInspectRes.status, 200);
    const zwizTemplates = await zwizInspectRes.json();
    const payTemplate = zwizTemplates.find((t: any) => t.recipientId === 'U_chidlom_vip_somchai_99');
    assert.ok(payTemplate, 'Payment template must be captured in Zwiz mock');
    assert.equal(payTemplate.type, 'PAYMENT_LINK');

    // 6. Customer completes payment via 2C2P Credit Card webhook
    const payWebhookRes = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: '2C2P',
        channel: 'CREDIT_CARD',
        transactionNumber: `TXN-VIP-${Date.now()}`,
        quotationId: quotation.id,
        amount: quotation.grandTotal,
        status: 'PAID'
      })
    });
    assert.equal(payWebhookRes.status, 200);

    // 7. Generate automated Kerry Express 4x6 thermal shipping label
    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'KERRY',
        labelFormat: 'THERMAL_4X6',
        recipientName: 'Khun Somchai Chidlom VIP',
        recipientPhone: '0812345678',
        shippingAddress: '1027 Ploenchit Road, Lumpini, Pathumwan, Bangkok 10330'
      })
    });
    assert.equal(labelRes.status, 201);
    const { label } = await labelRes.json();
    assert.ok(label.trackingNumber.startsWith('KEX'), 'Kerry tracking number must start with KEX');
    assert.equal(label.labelFormat, 'THERMAL_4X6');
    assert.ok(label.printableHtml.includes('@page { size: 100mm 150mm; }'), 'Must include 4x6 thermal CSS layout');
    assert.ok(label.printableHtml.includes('Kerry Express'), 'Must indicate Kerry Express carrier');

    // 8. Mock courier delivery webhook progression (IN_TRANSIT -> DELIVERED)
    const deliverWebhookRes = await fetch(`${COURIER_MOCK_URL}/mock/courier/v1/simulate/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber: label.trackingNumber,
        status: 'DELIVERED',
        carrier: 'KERRY',
        location: 'Bangkok Chidlom Hub',
        notes: 'Signed by customer Khun Somchai'
      })
    });
    assert.equal(deliverWebhookRes.status, 200);

    // Forward courier webhook to CRM
    const crmWebhookRes = await fetch(`${APP_URL}/api/webhooks/shipping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber: label.trackingNumber,
        status: 'DELIVERED',
        carrier: 'KERRY',
        notes: 'Signed by customer Khun Somchai'
      })
    });
    assert.equal(crmWebhookRes.status, 200);

    // 9. Inspect Customer 360 Consolidated Profile
    const c360Res = await fetch(`${APP_URL}/api/customers/${customerId}/360`);
    assert.equal(c360Res.status, 200);
    const c360 = await c360Res.json();
    assert.equal(c360.totalSpend, 28900.00, 'Omnichannel LTV must reflect luxury order');
    assert.equal(c360.totalOrders, 1);
    assert.equal(c360.preferredChannel, 'LINE');
    assert.ok(c360.engagementScore >= 50, 'Engagement score must reflect recent high-value purchase');
  });

  // =========================================================================
  // Scenario 4.6.2: Central Beauty Club Flash Sale Promotion & Payment Lifecycle
  // =========================================================================
  test('Scenario 4.6.2 - Beauty Club Flash Sale Interactive Promotion & Automated Payment Lifecycle (RBAC, interactive carousel, coupon discount, payment notifications)', async () => {
    // 1. Inbound Facebook Messenger chat for Central Beauty Club
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_beauty_fb_${Date.now()}`,
        source: {
          channel: 'FACEBOOK',
          pageId: 'central_beauty_club_th',
          pageName: 'Central Beauty Club',
          businessUnit: 'Central',
          senderId: 'fb_nisa_beauty_queen',
          senderName: 'Khun Nisa Beauty'
        },
        session: { sessionId: `sess_beauty_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_beauty_${Date.now()}`,
          type: 'TEXT',
          text: 'มีโปรโมชั่นเซรั่มหรือคูปองส่วนลดสำหรับ Beauty Club ไหมคะ'
        }
      })
    });
    const { caseId } = await inboundRes.json();

    // 2. Fetch promotion catalog and verify RBAC security
    const promoListRes = await fetch(`${APP_URL}/api/promotions`);
    assert.equal(promoListRes.status, 200);
    const promoList = await promoListRes.json();
    const beautyPromo = promoList.find((p: any) => p.code === 'BEAUTY10');
    assert.ok(beautyPromo, 'BEAUTY10 promotion must be available in catalog');

    // Unauthorized mutation attempt by frontline agent rejected with HTTP 403 Forbidden
    const illegalUpdateRes = await fetch(`${APP_URL}/api/promotions/${beautyPromo.id}?role=AGENT`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountValue: 50.0 })
    });
    assert.equal(illegalUpdateRes.status, 403, 'Frontline AGENT must be blocked from modifying promotions');

    // 3. Quick-share promotion card directly to chat composer
    const shareRes = await fetch(`${APP_URL}/api/promotions/${beautyPromo.id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        recipientId: 'fb_nisa_beauty_queen',
        channel: 'FACEBOOK'
      })
    });
    assert.equal(shareRes.status, 200);
    const sharePayload = await shareRes.json();
    assert.ok(sharePayload.chatCard, 'Promotion card must be generated for chat');
    assert.equal(sharePayload.chatCard.type, 'PROMOTION_CARD');

    // 4. Send interactive cosmetics Carousel template via Zwiz API
    const carouselRes = await fetch(`${APP_URL}/api/templates/interactive/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: 'fb_nisa_beauty_queen',
        channel: 'FACEBOOK',
        type: 'CAROUSEL',
        items: [
          {
            title: 'Lancôme Advanced Génifique 50ml',
            description: 'เซรั่มฟื้นบำรุงผิว ลดริ้วรอย พิเศษ 4,200 บ.',
            imageUrl: 'https://images.central.co.th/lancome.jpg',
            actions: [{ label: 'เลือกสินค้านี้', value: 'SELECT_LANCOME' }]
          },
          {
            title: 'Estée Lauder Advanced Night Repair 50ml',
            description: 'เซรั่มฟื้นบำรุงผิวยามค่ำคืน พิเศษ 4,500 บ.',
            imageUrl: 'https://images.central.co.th/esteelauder.jpg',
            actions: [{ label: 'เลือกสินค้านี้', value: 'SELECT_ESTEE' }]
          }
        ]
      })
    });
    assert.equal(carouselRes.status, 200);

    // 5. Customer chooses Lancôme and applies BEAUTY10 coupon
    const promoValidateRes = await fetch(`${APP_URL}/api/promotions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'BEAUTY10', subtotal: 4200.00 })
    });
    assert.equal(promoValidateRes.status, 200);
    const promoValidation = await promoValidateRes.json();
    assert.equal(promoValidation.discountAmount, 420.00); // 10% of 4200

    // Create quotation applying discount
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        businessUnit: 'Central',
        items: [
          {
            sku: 'LANCOME-GEN-50',
            productName: 'Lancôme Advanced Génifique 50ml',
            quantity: 1,
            unitPrice: 4200.00,
            discount: 420.00
          }
        ],
        discountTotal: 420.00
      })
    });
    assert.equal(quoteRes.status, 201);
    const { quotation } = await quoteRes.json();
    assert.equal(quotation.subtotal, 3780.00);

    // 6. Payment reminder notification triggered
    const reminderRes = await fetch(`${APP_URL}/api/notifications/payment-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        eventType: 'PAYMENT_REMINDER',
        recipientId: 'fb_nisa_beauty_queen',
        channel: 'FACEBOOK'
      })
    });
    assert.equal(reminderRes.status, 200);

    // 7. Customer pays via PromptPay QR webhook
    const payWebhookRes = await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: 'PROMPTPAY',
        channel: 'PROMPTPAY_QR',
        transactionNumber: `TXN-PROMPT-${Date.now()}`,
        quotationId: quotation.id,
        amount: quotation.grandTotal,
        status: 'PAID'
      })
    });
    assert.equal(payWebhookRes.status, 200);

    // 8. Automated payment confirmation notice sent
    const confirmNoticeRes = await fetch(`${APP_URL}/api/notifications/payment-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        eventType: 'PAYMENT_SUCCESS',
        recipientId: 'fb_nisa_beauty_queen',
        channel: 'FACEBOOK'
      })
    });
    assert.equal(confirmNoticeRes.status, 200);
  });

  // =========================================================================
  // Scenario 4.6.3: Muji Home Furniture Multi-Piece Delivery & Identity Linking
  // =========================================================================
  test('Scenario 4.6.3 - Muji Home Furniture Multi-Piece Delivery & Cross-Channel Identity Linking (MOST_AVAILABLE routing, Flash A4 manifest, phone merge, Customer 360)', async () => {
    // 1. Inbound Instagram Direct message for Muji Thailand
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_muji_ig_${Date.now()}`,
        source: {
          channel: 'INSTAGRAM',
          pageId: 'muji_thailand',
          pageName: 'Muji Thailand Official',
          businessUnit: 'Muji',
          senderId: 'ig_arak_muji_fan',
          senderName: 'Khun Arak Muji'
        },
        session: { sessionId: `sess_muji_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_muji_${Date.now()}`,
          type: 'TEXT',
          text: 'สนใจสั่งซื้อโต๊ะ Oak Living Dining Table และเก้าอี้ 2 ตัว จัดส่งต่างจังหวัดคิดค่าส่งอย่างไรครับ'
        }
      })
    });
    const { caseId, customerId: igCustomerId } = await inboundRes.json();

    // 2. Route case via MOST_AVAILABLE headroom strategy
    const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, strategy: 'MOST_AVAILABLE' })
    });
    assert.equal(dispatchRes.status, 200);
    const dispatchData = await dispatchRes.json();
    assert.ok(dispatchData.assignedAgentId, 'Case must be assigned to available agent');

    // 3. Create Quotation for multi-piece furniture
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        businessUnit: 'Muji',
        items: [
          {
            sku: 'MUJI-OAK-TABLE',
            productName: 'Oak Living Dining Table 150cm',
            quantity: 1,
            unitPrice: 18900.00
          },
          {
            sku: 'MUJI-OAK-CHAIR',
            productName: 'Oak Living Dining Chair',
            quantity: 2,
            unitPrice: 3500.00
          }
        ]
      })
    });
    assert.equal(quoteRes.status, 201);
    const { quotation } = await quoteRes.json();
    assert.equal(quotation.grandTotal, 25900.00); // 18900 + 7000

    // 4. Customer pays quotation
    await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: '2C2P',
        channel: 'CREDIT_CARD',
        transactionNumber: `TXN-MUJI-${Date.now()}`,
        quotationId: quotation.id,
        amount: quotation.grandTotal,
        status: 'PAID'
      })
    });

    // 5. Cross-Channel Identity Linking: Customer provides The 1 mobile phone number
    // Customer previously shopped on LINE with phone 0891234567
    const linkRes = await fetch(`${APP_URL}/api/customers/${igCustomerId}/identities/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'LINE',
        channelId: 'U_arak_line_vip_001',
        phoneNumber: '0891234567'
      })
    });
    assert.equal(linkRes.status, 200);
    const linkResult = await linkRes.json();
    assert.ok(linkResult.customer, 'Merged customer must be returned');

    // Verify Customer 360 profile reflects omnichannel channels
    const c360Res = await fetch(`${APP_URL}/api/customers/${igCustomerId}/360`);
    assert.equal(c360Res.status, 200);
    const c360 = await c360Res.json();
    assert.ok(c360.channels.includes('INSTAGRAM'), 'Must include INSTAGRAM');
    assert.ok(c360.channels.includes('LINE'), 'Must include linked LINE identity');
    assert.equal(c360.totalSpend, 25900.00);

    // 6. Generate Flash Express Standard A4 Shipping Manifest
    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'FLASH',
        labelFormat: 'A4',
        recipientName: 'Khun Arak Muji',
        recipientPhone: '0891234567',
        shippingAddress: '45/8 Moo 3, Tambon Suthep, Amphoe Mueang, Chiang Mai 50200'
      })
    });
    assert.equal(labelRes.status, 201);
    const { label } = await labelRes.json();
    assert.ok(label.trackingNumber.startsWith('TH'), 'Flash Express tracking number must start with TH');
    assert.equal(label.labelFormat, 'A4');
    assert.ok(label.printableHtml.includes('Flash Express'), 'Must specify Flash Express carrier');
    assert.ok(label.printableHtml.includes('Oak Living Dining Table 150cm'), 'Must itemize multi-piece order in manifest');
  });

  // =========================================================================
  // Scenario 4.6.4: Supersports Inquiry Inactivity SLA Breach & Courier Flow
  // =========================================================================
  test('Scenario 4.6.4 - Supersports Inquiry Inactivity SLA Breach, Supervisor Escalation & Courier Dispatch (15m/30m flags, Central Express label)', async () => {
    // 1. Inbound LINE chat for Supersports
    const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_sports_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'supersports_online',
          pageName: 'Supersports Official',
          businessUnit: 'Supersports',
          senderId: 'U_sports_golfer_77',
          senderName: 'Khun Witthaya Golfer'
        },
        session: { sessionId: `sess_sports_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_sports_${Date.now()}`,
          type: 'TEXT',
          text: 'สอบถามชุดไม้กอล์ฟ TaylorMade Stealth 2 มีโปรโมชั่นหรือของแถมไหมครับ'
        }
      })
    });
    const { caseId } = await inboundRes.json();

    // 2. Customer goes silent for 15 minutes -> evaluate SLA
    const sla15Res = await fetch(`${APP_URL}/api/cases/sla/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerSilenceMinutes: 16
      })
    });
    assert.equal(sla15Res.status, 200);
    const sla15Data = await sla15Res.json();
    assert.equal(sla15Data.inactivityFlag, 'PENDING_15M', '15m inactivity flag must be assigned');

    // 3. Customer remains silent past 30 minutes -> evaluate SLA escalation
    const sla30Res = await fetch(`${APP_URL}/api/cases/sla/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerSilenceMinutes: 32
      })
    });
    assert.equal(sla30Res.status, 200);
    const sla30Data = await sla30Res.json();
    assert.equal(sla30Data.inactivityFlag, 'PENDING_30M', '30m inactivity flag must be escalated');

    // Verify supervisor alert was logged
    const alertsRes = await fetch(`${APP_URL}/api/sla/alerts`);
    assert.equal(alertsRes.status, 200);
    const alerts = await alertsRes.json();
    const caseAlert = alerts.find((a: any) => a.caseId === caseId);
    assert.ok(caseAlert, 'Supervisor SLA alert must be created for 30m silence');
    assert.equal(caseAlert.severity, 'HIGH');

    // 4. Customer replies back -> inactivity flags automatically cleared
    const customerReplyRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_sports_reply_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'supersports_online',
          pageName: 'Supersports Official',
          businessUnit: 'Supersports',
          senderId: 'U_sports_golfer_77',
          senderName: 'Khun Witthaya Golfer'
        },
        session: { sessionId: `sess_sports_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: {
          messageId: `msg_sports_reply_${Date.now()}`,
          type: 'TEXT',
          text: 'ขอโทษที่ตอบช้าครับ ยืนยันรับชุดไม้กอล์ฟ TaylorMade ครับ'
        }
      })
    });
    assert.equal(customerReplyRes.status, 200);

    // Verify flags are cleared on case
    const caseCheckRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseCheck = await caseCheckRes.json();
    assert.equal(caseCheck.pendingFlag, null, 'Customer message must clear pending inactivity flag');

    // 5. Create Quotation for TaylorMade Golf Set (35,000 THB)
    const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        businessUnit: 'Supersports',
        items: [
          {
            sku: 'TM-STEALTH-SET',
            productName: 'TaylorMade Stealth 2 Complete Golf Set',
            quantity: 1,
            unitPrice: 35000.00
          }
        ]
      })
    });
    assert.equal(quoteRes.status, 201);
    const { quotation } = await quoteRes.json();

    // 6. Complete payment
    await fetch(`${APP_URL}/api/webhooks/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: '2C2P',
        channel: 'CREDIT_CARD',
        transactionNumber: `TXN-GOLF-${Date.now()}`,
        quotationId: quotation.id,
        amount: quotation.grandTotal,
        status: 'PAID'
      })
    });

    // 7. Generate Central Express delivery label
    const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotationId: quotation.id,
        carrier: 'CENTRAL_EXPRESS',
        labelFormat: 'THERMAL_4X6',
        recipientName: 'Khun Witthaya Golfer',
        recipientPhone: '0855554433',
        shippingAddress: '88/1 Moo 2, Bangna-Trad KM 14, Bang Chalong, Bang Phli, Samut Prakan 10540'
      })
    });
    assert.equal(labelRes.status, 201);
    const { label } = await labelRes.json();
    assert.ok(label.trackingNumber.startsWith('CTX'), 'Central Express tracking number must start with CTX');
    assert.equal(label.carrier, 'CENTRAL_EXPRESS');

    // 8. Track shipment
    const trackRes = await fetch(`${APP_URL}/api/shipping/track/${label.trackingNumber}`);
    assert.equal(trackRes.status, 200);
    const trackData = await trackRes.json();
    assert.equal(trackData.trackingNumber, label.trackingNumber);
    assert.equal(trackData.carrier, 'CENTRAL_EXPRESS');
  });
});
