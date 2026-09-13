import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  canMutatePromotions,
  formatDiscountSummary,
} from '../../../src/lib/promotions/service';
import {
  POST as createPromotionRoute,
} from '../../../src/app/api/promotions/route';
import {
  PUT as updatePromotionPutRoute,
  PATCH as updatePromotionPatchRoute,
  DELETE as deletePromotionRoute,
} from '../../../src/app/api/promotions/[id]/route';
import {
  getUserRole,
  isPrivilegedRole,
  isEorPrivilegedRole,
  redactCaseFields,
  redactCase,
  redactAuditLog,
  redactMessage,
} from '../../../src/lib/audit/redactor';
import {
  calculateLtv,
  calculateAov,
  calculatePurchaseFrequency,
  determinePreferredChannel,
  calculateCustomerEngagementScore,
  linkCustomerIdentity,
} from '../../../src/lib/customers/analytics';
import { QuotationStatus, ChannelType } from '@prisma/client';

describe('Tier 5.5: Adversarial Verification — RBAC, Field Masking, Customer 360 & Identity Linking', () => {

  // =========================================================================
  // Challenge 1: Promotion RBAC Guardrails
  // Frontline roles (AGENT, AGENT_SALES, AGENT_SOCIAL_MEDIA, AGENT_CS)
  // must strictly receive HTTP 403 PROMOTION_MUTATION_RESTRICTED on POST/PUT/PATCH/DELETE
  // =========================================================================
  describe('Challenge 1: Promotion RBAC Guardrails & Frontline Restriction', () => {
    const frontlineRoles = [
      'AGENT',
      'AGENT_SALES',
      'AGENT_SOCIAL_MEDIA',
      'AGENT_CS',
      'AGENT_COL',
      'AGENT_EOR',
    ];

    test('CH1.1 - canMutatePromotions strictly rejects all frontline roles', () => {
      for (const role of frontlineRoles) {
        const allowed = canMutatePromotions(role);
        assert.equal(
          allowed,
          false,
          `Frontline role '${role}' must NOT be allowed to mutate promotions`
        );
      }

      // Also verify unauthenticated, empty, or unknown roles
      assert.equal(canMutatePromotions(undefined), false, 'undefined role must be rejected');
      assert.equal(canMutatePromotions(''), false, 'empty role must be rejected');
      assert.equal(canMutatePromotions('AUDITOR'), false, 'AUDITOR role must be read-only');
      assert.equal(canMutatePromotions('GUEST'), false, 'unknown role must be rejected');
    });

    test('CH1.2 - canMutatePromotions permits only ADMIN and SUPERVISOR', () => {
      assert.equal(canMutatePromotions('ADMIN'), true, 'ADMIN must be allowed');
      assert.equal(canMutatePromotions('SUPERVISOR'), true, 'SUPERVISOR must be allowed');
      assert.equal(canMutatePromotions('  admin  '), true, 'Case and whitespace must be normalized');
      assert.equal(canMutatePromotions('supervisor'), true, 'Lowercase supervisor must be normalized');
    });

    test('CH1.3 - POST /api/promotions returns HTTP 403 PROMOTION_MUTATION_RESTRICTED for all frontline roles', async () => {
      for (const role of frontlineRoles) {
        const req = new NextRequest('http://localhost:3000/api/promotions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': role,
          },
          body: JSON.stringify({
            code: `MALICIOUS_PROMO_${role}`,
            name: 'Unauthorized Frontline Discount',
            discountType: 'PERCENTAGE',
            discountValue: 90,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 86400000).toISOString(),
          }),
        });

        const res = await createPromotionRoute(req);
        assert.equal(
          res.status,
          403,
          `POST /api/promotions with role '${role}' must return HTTP 403 Forbidden`
        );

        const body = await res.json();
        assert.equal(
          body.error,
          'PROMOTION_MUTATION_RESTRICTED',
          `Role '${role}' must receive PROMOTION_MUTATION_RESTRICTED error code`
        );
        assert.ok(
          body.message?.includes('read-only'),
          `Error message for role '${role}' must state read-only access`
        );
      }
    });

    test('CH1.4 - PUT /api/promotions/[id] returns HTTP 403 PROMOTION_MUTATION_RESTRICTED for all frontline roles', async () => {
      for (const role of frontlineRoles) {
        const req = new NextRequest('http://localhost:3000/api/promotions/promo_123', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': role,
          },
          body: JSON.stringify({
            discountValue: 99,
          }),
        });

        const res = await updatePromotionPutRoute(req, { params: { id: 'promo_123' } });
        assert.equal(
          res.status,
          403,
          `PUT /api/promotions/promo_123 with role '${role}' must return HTTP 403 Forbidden`
        );

        const body = await res.json();
        assert.equal(
          body.error,
          'PROMOTION_MUTATION_RESTRICTED',
          `PUT must return PROMOTION_MUTATION_RESTRICTED for role '${role}'`
        );
      }
    });

    test('CH1.5 - PATCH /api/promotions/[id] returns HTTP 403 PROMOTION_MUTATION_RESTRICTED for all frontline roles', async () => {
      for (const role of frontlineRoles) {
        const req = new NextRequest('http://localhost:3000/api/promotions/promo_123', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': role,
          },
          body: JSON.stringify({
            discountValue: 80,
          }),
        });

        const res = await updatePromotionPatchRoute(req, { params: { id: 'promo_123' } });
        assert.equal(
          res.status,
          403,
          `PATCH /api/promotions/promo_123 with role '${role}' must return HTTP 403 Forbidden`
        );

        const body = await res.json();
        assert.equal(
          body.error,
          'PROMOTION_MUTATION_RESTRICTED',
          `PATCH must return PROMOTION_MUTATION_RESTRICTED for role '${role}'`
        );
      }
    });

    test('CH1.6 - DELETE /api/promotions/[id] returns HTTP 403 PROMOTION_MUTATION_RESTRICTED for all frontline roles', async () => {
      for (const role of frontlineRoles) {
        const req = new NextRequest('http://localhost:3000/api/promotions/promo_123', {
          method: 'DELETE',
          headers: {
            'x-user-role': role,
          },
        });

        const res = await deletePromotionRoute(req, { params: { id: 'promo_123' } });
        assert.equal(
          res.status,
          403,
          `DELETE /api/promotions/promo_123 with role '${role}' must return HTTP 403 Forbidden`
        );

        const body = await res.json();
        assert.equal(
          body.error,
          'PROMOTION_MUTATION_RESTRICTED',
          `DELETE must return PROMOTION_MUTATION_RESTRICTED for role '${role}'`
        );
      }
    });

    test('CH1.7 - Missing or spoofed role headers default to AGENT and are rejected with 403', async () => {
      // 1. Completely missing role header
      const reqMissing = new NextRequest('http://localhost:3000/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'TEST_NO_ROLE', name: 'No Role', discountType: 'PERCENTAGE', discountValue: 10 }),
      });
      const resMissing = await createPromotionRoute(reqMissing);
      assert.equal(resMissing.status, 403, 'Missing role header must default to AGENT and return HTTP 403');

      // 2. Spoofed header variations
      const reqSpoofed = new NextRequest('http://localhost:3000/api/promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'FRONTEND_USER',
        },
        body: JSON.stringify({ code: 'SPOOFED', name: 'Spoofed', discountType: 'PERCENTAGE', discountValue: 10 }),
      });
      const resSpoofed = await createPromotionRoute(reqSpoofed);
      assert.equal(resSpoofed.status, 403, 'Unknown/spoofed role must return HTTP 403');
    });
  });

  // =========================================================================
  // Challenge 2: Field Masking & EOR Access Control
  // Non-EOR frontline roles cannot access or mutate EOR fields:
  // - Masked as '***-RESTRICTED-***' on read
  // - HTTP 403 on PATCH
  // =========================================================================
  describe('Challenge 2: Field Masking & EOR Access Control Guardrails', () => {
    const rawEorCase = {
      id: 'case_adv_eor_001',
      caseNumber: 'CAS-2026-EOR-999',
      title: 'Customer Inquiry EOR Chidlom',
      status: 'IN_PROGRESS',
      businessUnit: 'Central',
      channel: 'LINE',
      // Sensitive EOR fields
      eorTicketNumber: 'TK-POS-889900',
      sellingStoreName: 'Central Chidlom',
      sellingStoreStaffId: 'STF-BANGKOK-007',
      eorMetadata: { posMachineId: 'POS-04', registerLane: 2, cashierPin: '9988' },
      // Other non-EOR fields
      resolutionNotes: 'Standard customer inquiry',
    };

    test('CH2.1 - isEorPrivilegedRole accurately segregates privileged from non-privileged roles', () => {
      // Privileged roles
      assert.equal(isEorPrivilegedRole('ADMIN'), true);
      assert.equal(isEorPrivilegedRole('SUPERVISOR'), true);
      assert.equal(isEorPrivilegedRole('AUDITOR'), true);
      assert.equal(isEorPrivilegedRole('AGENT_EOR'), true);

      // Non-privileged frontline roles
      assert.equal(isEorPrivilegedRole('AGENT'), false);
      assert.equal(isEorPrivilegedRole('AGENT_SALES'), false);
      assert.equal(isEorPrivilegedRole('AGENT_SOCIAL_MEDIA'), false);
      assert.equal(isEorPrivilegedRole('AGENT_CS'), false);
      assert.equal(isEorPrivilegedRole('AGENT_COL'), false);
      assert.equal(isEorPrivilegedRole(undefined), false);
      assert.equal(isEorPrivilegedRole(''), false);
    });

    test('CH2.2 - Non-EOR frontline roles receive ***-RESTRICTED-*** for all 4 EOR fields on read', () => {
      const frontlineRoles = ['AGENT', 'AGENT_SALES', 'AGENT_SOCIAL_MEDIA', 'AGENT_CS', 'AGENT_COL'];

      for (const role of frontlineRoles) {
        const redacted = redactCaseFields(rawEorCase, role);

        assert.equal(
          redacted.eorTicketNumber,
          '***-RESTRICTED-***',
          `eorTicketNumber must be masked as '***-RESTRICTED-***' for role '${role}'`
        );
        assert.equal(
          redacted.sellingStoreName,
          '***-RESTRICTED-***',
          `sellingStoreName must be masked as '***-RESTRICTED-***' for role '${role}'`
        );
        assert.equal(
          redacted.sellingStoreStaffId,
          '***-RESTRICTED-***',
          `sellingStoreStaffId must be masked as '***-RESTRICTED-***' for role '${role}'`
        );
        assert.equal(
          redacted.eorMetadata,
          '***-RESTRICTED-***',
          `eorMetadata must be masked as '***-RESTRICTED-***' for role '${role}'`
        );

        // Verify non-EOR fields are strictly unmasked
        assert.equal(redacted.id, 'case_adv_eor_001');
        assert.equal(redacted.caseNumber, 'CAS-2026-EOR-999');
        assert.equal(redacted.title, 'Customer Inquiry EOR Chidlom');
        assert.equal(redacted.status, 'IN_PROGRESS');
      }
    });

    test('CH2.3 - EOR-privileged roles (ADMIN, SUPERVISOR, AUDITOR, AGENT_EOR) receive unmasked raw values', () => {
      const privilegedRoles = ['ADMIN', 'SUPERVISOR', 'AUDITOR', 'AGENT_EOR'];

      for (const role of privilegedRoles) {
        const unmasked = redactCaseFields(rawEorCase, role);

        assert.equal(unmasked.eorTicketNumber, 'TK-POS-889900');
        assert.equal(unmasked.sellingStoreName, 'Central Chidlom');
        assert.equal(unmasked.sellingStoreStaffId, 'STF-BANGKOK-007');
        assert.deepEqual(unmasked.eorMetadata, { posMachineId: 'POS-04', registerLane: 2, cashierPin: '9988' });
      }
    });

    test('CH2.4 - redactCaseFields handles nested case wrappers and empty fields gracefully', () => {
      // 1. Nested { case: { ... } } wrapper
      const nestedWrapper = {
        success: true,
        case: { ...rawEorCase },
      };
      const redactedNested = redactCaseFields(nestedWrapper, 'AGENT_SALES');
      assert.equal(redactedNested.case.eorTicketNumber, '***-RESTRICTED-***');
      assert.equal(redactedNested.case.sellingStoreName, '***-RESTRICTED-***');

      // 2. Null/undefined fields should not turn into masks
      const caseWithNulls = {
        id: 'case_nulls',
        caseNumber: 'CAS-NULL',
        eorTicketNumber: null,
        sellingStoreName: undefined,
      };
      const redactedNulls = redactCaseFields(caseWithNulls, 'AGENT_CS');
      assert.equal(redactedNulls.eorTicketNumber, null, 'null eorTicketNumber should remain null');
      assert.equal(redactedNulls.sellingStoreName, undefined, 'undefined sellingStoreName should remain undefined');
    });

    test('CH2.5 - Full case redactor (redactCase) redacts audit logs and whisper notes alongside EOR fields', () => {
      const fullCase = {
        ...rawEorCase,
        auditLogs: [
          { action: 'FRAUD_FLAGGED', details: 'Suspicious card used', oldValue: '100', newValue: '500' },
          { action: 'STATUS_UPDATED', details: 'Status changed to Open' },
        ],
        messages: [
          { isInternal: true, content: { text: '[CONFIDENTIAL] Fraud review in progress' } },
          { isInternal: false, content: { text: 'Hello customer' } },
        ],
      };

      const redacted = redactCase(fullCase, 'AGENT_SALES');
      // EOR masked
      assert.equal(redacted.eorTicketNumber, '***-RESTRICTED-***');
      // Confidential audit log redacted
      assert.equal(redacted.auditLogs[0].details, '[RESTRICTED - SUPERVISOR ONLY]');
      assert.equal(redacted.auditLogs[0].isRedacted, true);
      // Non-confidential audit log unchanged
      assert.equal(redacted.auditLogs[1].details, 'Status changed to Open');
      // Whisper confidential note masked
      assert.equal(redacted.messages[0].text, '[CONFIDENTIAL - RESTRICTED ACCESS]');
      assert.equal(redacted.messages[0].isRedacted, true);
      // Customer message unchanged
      assert.equal(redacted.messages[1].content.text, 'Hello customer');
    });
  });

  // =========================================================================
  // Challenge 3: Customer 360 Edge Cases (LTV/AOV Calculations)
  // - 0 orders (no divide-by-zero, accurate totals)
  // - Mixed paid and unpaid orders
  // - Cancelled orders
  // - Frequency, preferred channel, engagement score edge cases
  // =========================================================================
  describe('Challenge 3: Customer 360 & Behavioral Analytics Edge Cases', () => {
    test('CH3.1 - 0 orders returns LTV = 0.0, AOV = 0.0 without divide-by-zero', () => {
      const ltvEmpty = calculateLtv([]);
      assert.equal(ltvEmpty, 0.0, 'LTV for empty quotations array must be 0.0');

      const aovEmpty = calculateAov(ltvEmpty, 0);
      assert.equal(aovEmpty, 0.0, 'AOV for 0 orders must be 0.0 without divide-by-zero');
      assert.ok(!isNaN(aovEmpty), 'AOV must not be NaN');
      assert.ok(isFinite(aovEmpty), 'AOV must be finite');

      const freqZero = calculatePurchaseFrequency(0, new Date());
      assert.equal(freqZero, 0.0, 'Purchase frequency for 0 orders must be 0.0');
    });

    test('CH3.2 - All unpaid / non-eligible orders produce LTV = 0.0 and AOV = 0.0', () => {
      const nonEligibleQuotations = [
        { id: 'q1', status: QuotationStatus.DRAFT, grandTotal: 25000.00 },
        { id: 'q2', status: QuotationStatus.PENDING_PAYMENT, grandTotal: 50000.00 },
        { id: 'q3', status: QuotationStatus.CANCEL, grandTotal: 100000.00 },
        { id: 'q4', status: QuotationStatus.VOID, grandTotal: 75000.00 },
        { id: 'q5', status: QuotationStatus.EXPIRED, grandTotal: 30000.00 },
      ];

      const ltv = calculateLtv(nonEligibleQuotations);
      assert.equal(ltv, 0.0, 'All non-paid statuses must contribute 0 to LTV');

      const aov = calculateAov(ltv, 0);
      assert.equal(aov, 0.0, 'AOV with 0 paid orders must be 0.0');
    });

    test('CH3.3 - Cancelled orders are strictly excluded from LTV and AOV', () => {
      const mixedWithCancelled = [
        { id: 'q1', status: QuotationStatus.PAID, grandTotal: 4000.00 },
        { id: 'q2', status: QuotationStatus.CANCEL, grandTotal: 50000.00 },
        { id: 'q3', status: QuotationStatus.VOID, grandTotal: 20000.00 },
        { id: 'q4', status: QuotationStatus.COMPLETED, grandTotal: 6000.00 },
      ];

      const ltv = calculateLtv(mixedWithCancelled);
      assert.equal(ltv, 10000.00, 'LTV must only sum PAID (4000) and COMPLETED (6000) = 10000');

      const paidCount = 2; // PAID + COMPLETED
      const aov = calculateAov(ltv, paidCount);
      assert.equal(aov, 5000.00, 'AOV must be 10000 / 2 = 5000.00');
    });

    test('CH3.4 - Mixed paid and unpaid orders calculates exact mathematical totals and cents rounding', () => {
      const mixedQuotations = [
        { id: 'q1', status: QuotationStatus.PAID, grandTotal: 1250.33 },
        { id: 'q2', status: QuotationStatus.PRINTED, grandTotal: 2499.67 },
        { id: 'q3', status: QuotationStatus.COMPLETED, grandTotal: 5000.00 },
        { id: 'q4', status: QuotationStatus.DRAFT, grandTotal: 99999.00 },
        { id: 'q5', status: QuotationStatus.PENDING_PAYMENT, grandTotal: 88888.00 },
      ];

      const ltv = calculateLtv(mixedQuotations);
      // 1250.33 + 2499.67 + 5000.00 = 8750.00
      assert.equal(ltv, 8750.00, 'LTV must be exact sum of PAID, PRINTED, COMPLETED');

      const paidOrderCount = 3;
      const aov = calculateAov(ltv, paidOrderCount);
      // 8750.00 / 3 = 2916.66666... -> 2916.67
      assert.equal(aov, 2916.67, 'AOV must round to nearest cent (2916.67)');
    });

    test('CH3.5 - Purchase frequency handles new customers (< 30 days) and old customers correctly', () => {
      const now = new Date();

      // Brand new customer: created today (diffDays = 1) -> max(1, 1/30) = 1 period of 30 days
      const freqNew = calculatePurchaseFrequency(3, now);
      assert.equal(freqNew, 3.0, '3 orders in first period must yield 3.0 frequency');

      // 60-day-old customer: diffDays = 60 -> 60 / 30 = 2 periods -> 4 orders / 2 = 2.0
      const created60DaysAgo = new Date(now.getTime() - 60 * 86400 * 1000);
      const freq60 = calculatePurchaseFrequency(4, created60DaysAgo);
      assert.equal(freq60, 2.0, '4 orders over 60 days must yield 2.0 orders/30d');
    });

    test('CH3.6 - Preferred channel resolves ties using the most recent interaction timestamp', () => {
      const tOld = new Date('2026-09-01T10:00:00Z');
      const tNew = new Date('2026-09-12T15:00:00Z');

      // LINE has 2 interactions (older)
      const cases = [
        { channel: 'LINE', createdAt: tOld },
        { channel: 'LINE', createdAt: tOld },
      ];

      // FB has 2 interactions (newer)
      const sessions = [
        { channel: 'FB', startDateTime: tOld },
        { channel: 'FACEBOOK', startDateTime: tNew },
      ];

      // Both have count = 2. FB has newer timestamp.
      const preferred = determinePreferredChannel(cases, sessions, 'LINE');
      assert.equal(preferred, 'FACEBOOK', 'Tie between LINE and FB must resolve to FACEBOOK due to newer timestamp');
    });

    test('CH3.7 - Customer Engagement Score (CES) and Loyalty Tier boundary transitions', () => {
      // 1. Zero activity customer -> Bronze
      const cesZero = calculateCustomerEngagementScore({
        daysSinceLastActivity: 120, // decayed to 0
        sessionCount: 0,
        paidOrderCount: 0,
        ltv: 0,
        csatScores: [],
      });
      // Recency = 0, Freq = 0, Monetary = 0, CSAT baseline = 70 -> 0.2 * 70 = 14
      assert.equal(cesZero.score, 14);
      assert.equal(cesZero.tier, 'BRONZE');

      // 2. High VIP customer -> Platinum (LTV >= 100,000)
      const cesVip = calculateCustomerEngagementScore({
        daysSinceLastActivity: 5,
        sessionCount: 10,
        paidOrderCount: 8,
        ltv: 120000,
        csatScores: [5, 5, 5],
      });
      assert.equal(cesVip.tier, 'PLATINUM');
      assert.ok(cesVip.score >= 85, 'VIP score should be >= 85');

      // 3. Gold boundary customer
      const cesGold = calculateCustomerEngagementScore({
        daysSinceLastActivity: 10,
        sessionCount: 4,
        paidOrderCount: 3,
        ltv: 40000,
        csatScores: [4, 4],
      });
      assert.equal(cesGold.tier, 'GOLD', 'Customer with 40k LTV must qualify for GOLD tier');
    });
  });

  // =========================================================================
  // Challenge 4: Multi-Channel Identity Linking Logic & Invariants
  // - Input validation: identifier requirement
  // - Deterministic canonical election (oldest record)
  // - Deduplication criteria
  // =========================================================================
  describe('Challenge 4: Multi-Channel Identity Linking Invariants', () => {
    test('CH4.1 - linkCustomerIdentity rejects calls with zero identifiers', async () => {
      await assert.rejects(
        async () => {
          await (linkCustomerIdentity as any)({});
        },
        (err: any) => {
          assert.ok(
            err.message.includes('At least one identifier'),
            'Must throw error when no identifier provided'
          );
          return true;
        }
      );
    });

    test('CH4.2 - Multi-channel identity deterministic merge algorithm preserves canonical priority', () => {
      // Simulate deterministic candidate ordering by createdAt
      const olderCustomer = {
        id: 'cust_canonical_older',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        lineUserId: 'line_user_original',
        phone: null,
        fbPsid: null,
        igUsername: null,
      };

      const newerCustomer = {
        id: 'cust_subordinate_newer',
        createdAt: new Date('2026-09-01T00:00:00Z'),
        lineUserId: null,
        phone: '0812345678',
        fbPsid: 'fb_psid_newer',
        igUsername: 'ig_handle_newer',
      };

      const candidates = [olderCustomer, newerCustomer].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      // Invariant 1: Canonical record C* is strictly candidates[0] (the oldest)
      const canonical = candidates[0];
      const subordinates = candidates.slice(1);
      assert.equal(canonical.id, 'cust_canonical_older', 'Oldest customer must be chosen as canonical');
      assert.equal(subordinates.length, 1);
      assert.equal(subordinates[0].id, 'cust_subordinate_newer');

      // Invariant 2: Consolidated profile merges social IDs into canonical without losing existing IDs
      const mergedSocials: any = {
        lineUserId: canonical.lineUserId,
        fbPsid: canonical.fbPsid,
        igUsername: canonical.igUsername,
        phone: canonical.phone || subordinates[0].phone,
      };
      for (const sub of subordinates) {
        if (!mergedSocials.lineUserId && sub.lineUserId) mergedSocials.lineUserId = sub.lineUserId;
        if (!mergedSocials.fbPsid && sub.fbPsid) mergedSocials.fbPsid = sub.fbPsid;
        if (!mergedSocials.igUsername && sub.igUsername) mergedSocials.igUsername = sub.igUsername;
        if (!mergedSocials.phone && sub.phone) mergedSocials.phone = sub.phone;
      }

      assert.equal(mergedSocials.lineUserId, 'line_user_original', 'Original LINE ID preserved');
      assert.equal(mergedSocials.fbPsid, 'fb_psid_newer', 'FB PSID merged from subordinate');
      assert.equal(mergedSocials.igUsername, 'ig_handle_newer', 'IG handle merged from subordinate');
      assert.equal(mergedSocials.phone, '0812345678', 'Phone merged from subordinate');
    });
  });
});
