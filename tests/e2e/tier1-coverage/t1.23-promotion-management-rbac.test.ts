import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.23: Promotion Management Hub & RBAC Guardrails (R6 / Phase 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T1.23.1 - Active promotions catalog listing supports BU and date filtering', async () => {
    const res = await fetch(`${APP_URL}/api/promotions?bu=Central`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.promotions.length >= 1, 'Should find seeded Central active promotions');

    const promo = data.promotions.find((p: any) => p.promoCode === 'BEAUTY10');
    assert.ok(promo, 'BEAUTY10 promo must be present');
    assert.equal(promo.discountType, 'PERCENTAGE');
    assert.equal(promo.discountValue, 10);
  });

  test('T1.23.2 - Frontline sales agent mutation attempt returns HTTP 403 Forbidden', async () => {
    const attemptRes = await fetch(`${APP_URL}/api/promotions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'AGENT',
      },
      body: JSON.stringify({
        promoCode: 'UNAUTHORIZED_DISCOUNT',
        title: 'Hacked 90% Off',
        discountType: 'PERCENTAGE',
        discountValue: 90,
      })
    });

    assert.equal(attemptRes.status, 403, 'Frontline agent mutation must be blocked with HTTP 403');
    const errData = await attemptRes.json();
    assert.equal(errData.code, 'PROMOTION_MUTATION_RESTRICTED');
    assert.equal(errData.attemptedRole, 'AGENT');
  });

  test('T1.23.3 - Admin and Supervisor can create, update, and archive campaigns', async () => {
    // 1. Supervisor creates campaign
    const createRes = await fetch(`${APP_URL}/api/promotions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'SUPERVISOR',
      },
      body: JSON.stringify({
        promoCode: 'SUPERVISOR_SPECIAL_500',
        title: 'Supervisor 500 THB Voucher',
        discountType: 'FIXED_AMOUNT',
        discountValue: 500,
        minPurchaseAmount: 3000,
        validFrom: '2026-09-01T00:00:00.000Z',
        validTo: '2026-10-31T23:59:59.000Z',
      })
    });

    assert.equal(createRes.status, 201, 'Supervisor should create promo with 201 Created');
    const createdData = await createRes.json();
    assert.equal(createdData.promotion.promoCode, 'SUPERVISOR_SPECIAL_500');

    // 2. Admin updates campaign
    const updateRes = await fetch(`${APP_URL}/api/promotions/${createdData.promotion.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        discountValue: 600,
      })
    });
    assert.equal(updateRes.status, 200);
    const updatedData = await updateRes.json();
    assert.equal(updatedData.promotion.discountValue, 600);

    // 3. Admin archives campaign
    const deleteRes = await fetch(`${APP_URL}/api/promotions/${createdData.promotion.id}`, {
      method: 'DELETE',
      headers: {
        'x-user-role': 'ADMIN',
      }
    });
    assert.equal(deleteRes.status, 200);
    const deletedData = await deleteRes.json();
    assert.equal(deletedData.archived, true);
    assert.equal(deletedData.promotion.isActive, false);
  });

  test('T1.23.4 - Quick-share promotion card formats rich card payload for active chat composer', async () => {
    const shareRes = await fetch(`${APP_URL}/api/promotions/BEAUTY10/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.equal(shareRes.status, 200);
    const shareData = await shareRes.json();
    assert.equal(shareData.success, true);
    assert.equal(shareData.promotionCard.type, 'PROMOTION_CARD');
    assert.equal(shareData.promotionCard.promoCode, 'BEAUTY10');
    assert.ok(shareData.promotionCard.actions.length >= 1);
  });

  test('T1.23.5 - Promotion code validation validates cart minimums and campaign validity', async () => {
    // 1. Valid application: BEAUTY10 with subtotal 3,000 (min 2,500)
    const validRes = await fetch(`${APP_URL}/api/promotions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promoCode: 'BEAUTY10',
        subtotal: 3000,
        businessUnit: 'Central'
      })
    });
    assert.equal(validRes.status, 200);
    const validData = await validRes.json();
    assert.equal(validData.valid, true);
    assert.equal(validData.discountAmount, 300); // 10% of 3000
    assert.equal(validData.finalTotal, 2700);

    // 2. Subtotal below minimum threshold: BEAUTY10 with subtotal 1,500 (min 2,500)
    const invalidSubtotalRes = await fetch(`${APP_URL}/api/promotions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promoCode: 'BEAUTY10',
        subtotal: 1500,
        businessUnit: 'Central'
      })
    });
    assert.equal(invalidSubtotalRes.status, 400);
    const invalidSubtotalData = await invalidSubtotalRes.json();
    assert.equal(invalidSubtotalData.error, 'PROMOTION_MIN_SUBTOTAL_NOT_MET');

    // 3. Expired promotion code
    const expiredRes = await fetch(`${APP_URL}/api/promotions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promoCode: 'EXPIRED99',
        subtotal: 5000,
        businessUnit: 'Central'
      })
    });
    assert.equal(expiredRes.status, 400);
    const expiredData = await expiredRes.json();
    assert.equal(expiredData.error, 'PROMOTION_EXPIRED');
  });
});
