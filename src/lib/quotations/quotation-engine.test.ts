/**
 * Unit & Integration Test Suite for Quotation & E-Ordering Engine
 * Path: src/lib/quotations/quotation-engine.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinancials,
  QuotationError,
  QuotationLockedError,
  QuotationAlreadyPrintedError,
  InvalidStateTransitionError,
} from './service';
import {
  calculatePointsEarned,
  calculatePointsValueThb,
  calculatePointsNeededForDiscount,
  lookupThe1Profile,
} from '../loyalty/the1';

describe('R1: E-Ordering & Quotation Engine — Financial Calculations', () => {
  it('calculates line item total, 7% VAT, and grandTotal correctly', () => {
    const items = [
      { sku: 'DYS-V12', productName: 'Dyson V12 Detect Slim', quantity: 1, unitPrice: 25000, discount: 1000 },
      { sku: 'DYS-ACC', productName: 'Accessory Kit', quantity: 2, unitPrice: 1500, discount: 0 },
    ];
    // Subtotal = (25000 - 1000) + (1500 * 2) = 24000 + 3000 = 27000
    // VAT 7% = 27000 * 0.07 = 1890
    // Grand Total = 27000 + 1890 - 1000 = 27890
    const fin = calculateFinancials(items, 0, 1000, 0);

    assert.equal(fin.subtotal, 27000);
    assert.equal(fin.vatAmount, 1890);
    assert.equal(fin.grandTotal, 27890);
    assert.equal(fin.items.length, 2);
    assert.equal(fin.items[0].totalPrice, 24000);
    assert.equal(fin.items[1].totalPrice, 3000);
  });

  it('calculates The 1 point discount deduction properly', () => {
    const items = [{ sku: 'PROD-01', productName: 'Item A', quantity: 1, unitPrice: 1000, discount: 0 }];
    // Subtotal = 1000
    // VAT 7% = 70
    // Grand Total = 1000 + 70 - 100 (The 1 discount) = 970
    const fin = calculateFinancials(items, 0, 0, 100);

    assert.equal(fin.subtotal, 1000);
    assert.equal(fin.vatAmount, 70);
    assert.equal(fin.grandTotal, 970);
    assert.equal(fin.the1Discount, 100);
  });

  it('rejects empty items array', () => {
    assert.throws(
      () => calculateFinancials([]),
      (err: any) => err instanceof QuotationError && err.code === 'INVALID_ITEMS'
    );
  });

  it('rejects non-positive quantity', () => {
    assert.throws(
      () => calculateFinancials([{ sku: 'SKU-01', unitPrice: 500, quantity: 0 }]),
      (err: any) => err instanceof QuotationError && err.code === 'INVALID_QUANTITY'
    );
  });

  it('rejects negative unit price', () => {
    assert.throws(
      () => calculateFinancials([{ sku: 'SKU-01', unitPrice: -50, quantity: 1 }]),
      (err: any) => err instanceof QuotationError && err.code === 'INVALID_PRICE'
    );
  });
});

describe('R1: The 1 Loyalty Points & Conversions', () => {
  it('calculates points earned at 25 THB = 1 point', () => {
    assert.equal(calculatePointsEarned(25000), 1000);
    assert.equal(calculatePointsEarned(27890), 1115);
    assert.equal(calculatePointsEarned(24), 0);
    assert.equal(calculatePointsEarned(0), 0);
  });

  it('calculates THB monetary value at 8 points = 1 THB', () => {
    assert.equal(calculatePointsValueThb(800), 100);
    assert.equal(calculatePointsValueThb(12500), 1562.5);
    assert.equal(calculatePointsValueThb(0), 0);
  });

  it('calculates points needed for THB discount (1 THB = 8 points)', () => {
    assert.equal(calculatePointsNeededForDiscount(100), 800);
    assert.equal(calculatePointsNeededForDiscount(50), 400);
  });

  it('looks up mock The 1 profile by phone number', async () => {
    const profile = await lookupThe1Profile({ phone: '0812345678' });
    assert.ok(profile);
    assert.equal(profile.the1CardNumber, '880012345678');
    assert.equal(profile.tier, 'THE1_EXCLUSIVE');
    assert.equal(profile.pointsBalance, 12500);
    assert.equal(profile.pointsValueThb, 1562.5);
  });

  it('looks up mock The 1 profile by card number', async () => {
    const profile = await lookupThe1Profile({ cardNumber: '880012340003' });
    assert.ok(profile);
    assert.equal(profile.phone, '0863334444');
    assert.equal(profile.tier, 'VIP');
    assert.equal(profile.pointsBalance, 120000);
  });

  it('returns null for unknown identifier', async () => {
    const profile = await lookupThe1Profile({ phone: '0999999999' });
    assert.equal(profile, null);
  });
});

describe('R1: Quotation Error Semantics', () => {
  it('QuotationLockedError carries HTTP 423', () => {
    const err = new QuotationLockedError();
    assert.equal(err.statusCode, 423);
    assert.equal(err.code, 'QUOTATION_LOCKED');
  });

  it('QuotationAlreadyPrintedError carries HTTP 403 and single-print details', () => {
    const err = new QuotationAlreadyPrintedError('QT-2026-1001', '2026-09-13T03:00:00Z', 1);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'QUOTATION_ALREADY_PRINTED');
    assert.equal(err.details.quotationNumber, 'QT-2026-1001');
    assert.equal(err.details.printCount, 1);
  });

  it('InvalidStateTransitionError carries HTTP 400', () => {
    const err = new InvalidStateTransitionError('DRAFT', 'PRINTED');
    assert.equal(err.statusCode, 400);
    assert.equal(err.code, 'INVALID_STATUS_TRANSITION');
  });
});
