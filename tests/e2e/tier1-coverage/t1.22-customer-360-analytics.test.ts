import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.22: Customer 360 Profile & Behavioral Analytics (R5 / Phase 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createCustomerWithOrders() {
    // 1. Inbound message to create customer and case
    const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_c360_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_department_store',
          pageName: 'Central Department Store',
          businessUnit: 'Central',
          senderId: `U_360_cust_${Date.now()}`,
          senderName: 'Khun Napat 360'
        },
        session: { sessionId: `sess_360_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'สั่งซื้อสินค้าครับ' }
      })
    });
    const { caseId } = await caseRes.json();

    const caseDetailRes = await fetch(`${APP_URL}/api/cases/${caseId}`);
    const caseDetail = await caseDetailRes.json();
    const customerId = caseDetail.customerId;

    // 2. Order 1: 15,000 THB -> PAID
    const q1Res = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId,
        businessUnit: 'Central',
        items: [{ sku: 'SKU-01', productName: 'Item A', quantity: 1, unitPrice: 15000, discount: 0 }]
      })
    });
    const q1Data = await q1Res.json();
    await fetch(`${APP_URL}/api/quotations/${q1Data.quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 3. Order 2: 25,000 THB -> PAID
    const q2Res = await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId,
        businessUnit: 'Central',
        items: [{ sku: 'SKU-02', productName: 'Item B', quantity: 1, unitPrice: 25000, discount: 0 }]
      })
    });
    const q2Data = await q2Res.json();
    await fetch(`${APP_URL}/api/quotations/${q2Data.quotation.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' })
    });

    // 4. Order 3: 10,000 THB -> DRAFT (should NOT count towards LTV)
    await fetch(`${APP_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        customerId,
        businessUnit: 'Central',
        items: [{ sku: 'SKU-03', productName: 'Item C', quantity: 1, unitPrice: 10000, discount: 0 }]
      })
    });

    return customerId;
  }

  test('T1.22.1 - Customer 360 calculates exact LTV and AOV across only paid/completed orders', async () => {
    const customerId = await createCustomerWithOrders();

    const res = await fetch(`${APP_URL}/api/customers/${customerId}/360`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.totalOrders, 2, 'Only 2 orders are in PAID status');
    assert.equal(data.totalLtv, 40000, 'LTV must equal 15,000 + 25,000 = 40,000 THB');
    assert.equal(data.aov, 20000, 'AOV must equal 40,000 / 2 = 20,000 THB');
  });

  test('T1.22.2 - Customer purchase frequency metric is calculated and normalized', async () => {
    const customerId = await createCustomerWithOrders();

    const res = await fetch(`${APP_URL}/api/customers/${customerId}/360`);
    const data = await res.json();

    assert.ok(data.purchaseFrequency > 0, 'Purchase frequency must be a positive number');
    assert.equal(typeof data.purchaseFrequency, 'number');
  });

  test('T1.22.3 - Preferred communication channel is algorithmically determined', async () => {
    const customerId = await createCustomerWithOrders();

    const res = await fetch(`${APP_URL}/api/customers/${customerId}/360`);
    const data = await res.json();

    assert.equal(data.preferredChannel, 'LINE', 'Channel should resolve to LINE for this customer');
  });

  test('T1.22.4 - Customer Engagement Score (CES) and Loyalty Tier are computed deterministically', async () => {
    const customerId = await createCustomerWithOrders();

    const res = await fetch(`${APP_URL}/api/customers/${customerId}/360`);
    const data = await res.json();

    assert.ok(data.engagementScore >= 0 && data.engagementScore <= 100, 'CES must be between 0 and 100');
    assert.ok(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'].includes(data.loyaltyTier), 'Loyalty tier must be valid');
    // With LTV of 40,000, customer qualifies for GOLD or higher
    assert.ok(data.loyaltyTier === 'GOLD' || data.loyaltyTier === 'PLATINUM');
  });

  test('T1.22.5 - Multi-channel identity linking resolves LINE, FB, and Phone into canonical profile', async () => {
    const customerId = await createCustomerWithOrders();

    const linkRes = await fetch(`${APP_URL}/api/customers/${customerId}/identities/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineUserId: 'U_napat_official_line',
        fbPsid: 'FB_PSID_987654321',
        phone: '0898765432'
      })
    });

    assert.equal(linkRes.status, 200);
    const linkData = await linkRes.json();
    assert.equal(linkData.success, true);

    // Verify 360 profile reflects linked identities
    const res = await fetch(`${APP_URL}/api/customers/${customerId}/360`);
    const data = await res.json();
    assert.equal(data.linkedIdentities.lineUserId, 'U_napat_official_line');
    assert.equal(data.linkedIdentities.fbPsid, 'FB_PSID_987654321');
    assert.equal(data.linkedIdentities.phone, '0898765432');
  });
});
