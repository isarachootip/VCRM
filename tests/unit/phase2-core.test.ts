import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactCaseFields,
  isEorPrivilegedRole,
} from '../../src/lib/audit/redactor';
import {
  selectBestAgent,
} from '../../src/lib/agents/queue-routing';
import {
  evaluateCaseInactivity,
  evaluateAgentResponseWait,
  evaluateCaseSla,
  SlaPendingFlag,
} from '../../src/lib/cases/sla';
import {
  canMutatePromotions,
  formatDiscountSummary,
  generatePromotionCard,
} from '../../src/lib/promotions/service';

describe('Phase 2 Core Deliverables Unit Verification', () => {
  // =========================================================================
  // 1. M13: Team Workspaces & Field Masking (R1)
  // =========================================================================
  describe('M13: Field Masking & EOR Access Control', () => {
    const rawCase = {
      id: 'case_eor_101',
      caseNumber: 'CAS-EOR-001',
      title: 'EOR Purchase Chidlom',
      channel: 'LINE',
      status: 'OPEN',
      // EOR sensitive fields
      eorTicketNumber: 'TK-POS-99881',
      sellingStoreName: 'Central Chidlom',
      sellingStoreStaffId: 'STF-CHIDLOM-44',
      eorMetadata: { registerNo: 3, floor: '2F' },
    };

    test('isEorPrivilegedRole identifies privileged vs frontline roles', () => {
      assert.equal(isEorPrivilegedRole('ADMIN'), true);
      assert.equal(isEorPrivilegedRole('SUPERVISOR'), true);
      assert.equal(isEorPrivilegedRole('AUDITOR'), true);
      assert.equal(isEorPrivilegedRole('AGENT_EOR'), true);

      assert.equal(isEorPrivilegedRole('AGENT_SALES'), false);
      assert.equal(isEorPrivilegedRole('AGENT_SOCIAL_MEDIA'), false);
      assert.equal(isEorPrivilegedRole('AGENT_CS'), false);
      assert.equal(isEorPrivilegedRole('AGENT'), false);
      assert.equal(isEorPrivilegedRole(undefined), false);
    });

    test('Privileged roles (ADMIN, SUPERVISOR, AUDITOR, AGENT_EOR) see unmasked EOR fields', () => {
      const privilegedRoles = ['ADMIN', 'SUPERVISOR', 'AUDITOR', 'AGENT_EOR'];
      for (const role of privilegedRoles) {
        const result = redactCaseFields(rawCase, role);
        assert.equal(result.eorTicketNumber, 'TK-POS-99881', `${role} should see raw eorTicketNumber`);
        assert.equal(result.sellingStoreName, 'Central Chidlom', `${role} should see raw sellingStoreName`);
        assert.equal(result.sellingStoreStaffId, 'STF-CHIDLOM-44', `${role} should see raw sellingStoreStaffId`);
        assert.deepEqual(result.eorMetadata, { registerNo: 3, floor: '2F' }, `${role} should see raw eorMetadata`);
      }
    });

    test('Frontline roles (AGENT_SALES, AGENT_SOCIAL_MEDIA, AGENT_CS, AGENT) see masked EOR fields', () => {
      const restrictedRoles = ['AGENT_SALES', 'AGENT_SOCIAL_MEDIA', 'AGENT_CS', 'AGENT'];
      for (const role of restrictedRoles) {
        const result = redactCaseFields(rawCase, role);
        assert.equal(result.eorTicketNumber, '***-RESTRICTED-***', `${role} must have masked eorTicketNumber`);
        assert.equal(result.sellingStoreName, '***-RESTRICTED-***', `${role} must have masked sellingStoreName`);
        assert.equal(result.sellingStoreStaffId, '***-RESTRICTED-***', `${role} must have masked sellingStoreStaffId`);
        assert.equal(result.eorMetadata, '***-RESTRICTED-***', `${role} must have masked eorMetadata`);
        // Non-EOR fields remain intact
        assert.equal(result.caseNumber, 'CAS-EOR-001');
        assert.equal(result.title, 'EOR Purchase Chidlom');
      }
    });

    test('redactCaseFields handles nested case objects in response payloads', () => {
      const responsePayload = {
        success: true,
        case: { ...rawCase },
      };
      const result = redactCaseFields(responsePayload, 'AGENT_SALES');
      assert.equal(result.case.eorTicketNumber, '***-RESTRICTED-***');
      assert.equal(result.case.sellingStoreName, '***-RESTRICTED-***');
    });
  });

  // =========================================================================
  // 2. M14: Advanced Queue Routing Engine (R2)
  // =========================================================================
  describe('M14: Queue Routing Algorithms & Capacity Limits', () => {
    const t0 = new Date('2026-09-13T01:00:00Z');
    const t1 = new Date('2026-09-13T01:30:00Z');
    const t2 = new Date('2026-09-13T02:00:00Z');

    const agentSarah = {
      id: 'agent_sarah',
      name: 'Sarah (High Capacity)',
      maxConcurrentChats: 10,
      activeChatCount: 4, // Headroom = 6
      lastAssignedAt: t1,
    };

    const agentPloi = {
      id: 'agent_ploi',
      name: 'Ploi (Low Load)',
      maxConcurrentChats: 5,
      activeChatCount: 2, // Headroom = 3
      lastAssignedAt: t2,
    };

    const agentSomchai = {
      id: 'agent_somchai',
      name: 'Somchai (Tied Active)',
      maxConcurrentChats: 5,
      activeChatCount: 2, // Headroom = 3
      lastAssignedAt: t0, // Older assignment -> Longest idle
    };

    const agentFull = {
      id: 'agent_full',
      name: 'Full Agent',
      maxConcurrentChats: 5,
      activeChatCount: 5, // Headroom = 0 -> Disqualified!
      lastAssignedAt: t0,
    };

    test('LEAST_ACTIVE selects agent with lowest active chat count', () => {
      const pool = [{ ...agentSarah }, { ...agentPloi }];
      const selected = selectBestAgent(pool, 'LEAST_ACTIVE');
      assert.ok(selected);
      assert.equal(selected.id, 'agent_ploi', 'Ploi has activeChatCount=2 which is lower than Sarah=4');
    });

    test('LEAST_ACTIVE breaks tie with earliest lastAssignedAt ASC', () => {
      const pool = [{ ...agentPloi }, { ...agentSomchai }];
      const selected = selectBestAgent(pool, 'LEAST_ACTIVE');
      assert.ok(selected);
      assert.equal(selected.id, 'agent_somchai', 'Somchai has t0 (older assignment/longest idle) vs Ploi t2');
    });

    test('MOST_AVAILABLE selects agent with highest headroom', () => {
      const pool = [{ ...agentSarah }, { ...agentPloi }];
      const selected = selectBestAgent(pool, 'MOST_AVAILABLE');
      assert.ok(selected);
      assert.equal(selected.id, 'agent_sarah', 'Sarah has headroom 6 (10-4) > Ploi headroom 3 (5-2)');
    });

    test('MOST_AVAILABLE breaks tie on headroom using activeChatCount ASC', () => {
      const agentA = {
        id: 'agent_a',
        maxConcurrentChats: 10,
        activeChatCount: 5, // Headroom = 5
        lastAssignedAt: t1,
      };
      const agentB = {
        id: 'agent_b',
        maxConcurrentChats: 5,
        activeChatCount: 0, // Headroom = 5
        lastAssignedAt: t1,
      };

      const pool = [agentA, agentB];
      const selected = selectBestAgent(pool, 'MOST_AVAILABLE');
      assert.ok(selected);
      assert.equal(selected.id, 'agent_b', 'Agent B has activeChatCount 0 < 5, preferred on tie-break');
    });

    test('Strict capacity enforcement: excludes agent at max capacity (headroom <= 0)', () => {
      const pool = [{ ...agentFull }];
      const selected = selectBestAgent(pool, 'LEAST_ACTIVE');
      assert.equal(selected, null, 'Agent at full capacity must not be assigned');
    });

    test('Returns null / queue overflow when all agents are at max capacity', () => {
      const pool = [
        { ...agentFull },
        { id: 'agent_full2', maxConcurrentChats: 3, activeChatCount: 3 },
      ];
      const selectedLeast = selectBestAgent(pool, 'LEAST_ACTIVE');
      assert.equal(selectedLeast, null);

      const selectedMost = selectBestAgent(pool, 'MOST_AVAILABLE');
      assert.equal(selectedMost, null);
    });
  });

  // =========================================================================
  // 3. M14: SLA Inactivity & Agent Response Alerts (R2)
  // =========================================================================
  describe('M14: SLA Monitoring & Pending Flags', () => {
    const baseNow = new Date('2026-09-13T10:00:00Z');

    test('Inactivity: < 15 min customer silence flags NONE', () => {
      const messageTime = new Date('2026-09-13T09:50:00Z'); // 10 min ago
      const result = evaluateCaseInactivity(
        { lastCustomerMessageAt: messageTime, status: 'IN_PROGRESS' },
        baseNow
      );
      assert.equal(result.pendingFlag, SlaPendingFlag.NONE);
      assert.equal(Math.round(result.elapsedMinutes), 10);
    });

    test('Inactivity: >= 15 min customer silence flags PENDING_15M', () => {
      const messageTime = new Date('2026-09-13T09:42:00Z'); // 18 min ago
      const result = evaluateCaseInactivity(
        { lastCustomerMessageAt: messageTime, status: 'IN_PROGRESS' },
        baseNow
      );
      assert.equal(result.pendingFlag, SlaPendingFlag.PENDING_15M);
      assert.equal(Math.round(result.elapsedMinutes), 18);
    });

    test('Inactivity: >= 30 min customer silence flags PENDING_30M', () => {
      const messageTime = new Date('2026-09-13T09:25:00Z'); // 35 min ago
      const result = evaluateCaseInactivity(
        { lastCustomerMessageAt: messageTime, status: 'IN_PROGRESS' },
        baseNow
      );
      assert.equal(result.pendingFlag, SlaPendingFlag.PENDING_30M);
      assert.equal(Math.round(result.elapsedMinutes), 35);
    });

    test('Inactivity: Closed or resolved cases are exempt (NONE)', () => {
      const messageTime = new Date('2026-09-13T08:00:00Z'); // 2 hours ago
      const resultClosed = evaluateCaseInactivity(
        { lastCustomerMessageAt: messageTime, status: 'CLOSED' },
        baseNow
      );
      assert.equal(resultClosed.pendingFlag, SlaPendingFlag.NONE);

      const resultResolved = evaluateCaseInactivity(
        { lastCustomerMessageAt: messageTime, status: 'RESOLVED' },
        baseNow
      );
      assert.equal(resultResolved.pendingFlag, SlaPendingFlag.NONE);
    });

    test('Agent Response Wait: Breaches SLA when agent has not replied past threshold', () => {
      const inboundTime = new Date('2026-09-13T09:40:00Z'); // 20 min ago
      const result = evaluateAgentResponseWait(
        {
          lastCustomerMessageAt: inboundTime,
          lastAgentMessageAt: null, // No reply yet
          slaResponseMin: 15,
          status: 'OPEN',
        },
        baseNow
      );
      assert.equal(result.isBreached, true);
      assert.ok(result.slaBreachedAt);
      assert.equal(Math.round(result.elapsedMinutes), 20);
    });

    test('Agent Response Wait: Does not breach SLA when reply was timely', () => {
      const inboundTime = new Date('2026-09-13T09:40:00Z');
      const replyTime = new Date('2026-09-13T09:48:00Z'); // 8 min elapsed (<= 15 min)
      const result = evaluateAgentResponseWait(
        {
          lastCustomerMessageAt: inboundTime,
          lastAgentMessageAt: replyTime,
          slaResponseMin: 15,
          status: 'IN_PROGRESS',
        },
        baseNow
      );
      assert.equal(result.isBreached, false);
      assert.equal(result.slaBreachedAt, null);
    });

    test('evaluateCaseSla composite function returns accurate combined SLA metrics', () => {
      const inboundTime = new Date('2026-09-13T09:20:00Z'); // 40 min ago
      const caseData = {
        lastCustomerMessageAt: inboundTime,
        lastAgentMessageAt: null,
        status: 'IN_PROGRESS',
        queue: { slaResponseMin: 15 },
      };
      const composite = evaluateCaseSla(caseData, 15, baseNow);
      assert.equal(composite.pendingFlag, SlaPendingFlag.PENDING_30M);
      assert.equal(composite.isBreached, true);
      assert.ok(composite.slaBreachedAt);
    });
  });

  // =========================================================================
  // 4. M18: Promotion Management Hub & RBAC (R6)
  // =========================================================================
  describe('M18: Promotion Hub RBAC & Card Generation', () => {
    test('canMutatePromotions enforces RBAC for Admin/Supervisor vs Frontline Agents', () => {
      // Allowed
      assert.equal(canMutatePromotions('ADMIN'), true);
      assert.equal(canMutatePromotions('SUPERVISOR'), true);

      // Blocked (Frontline agents)
      assert.equal(canMutatePromotions('AGENT'), false);
      assert.equal(canMutatePromotions('AGENT_SALES'), false);
      assert.equal(canMutatePromotions('AGENT_EOR'), false);
      assert.equal(canMutatePromotions('AGENT_SOCIAL_MEDIA'), false);
      assert.equal(canMutatePromotions('AGENT_CS'), false);
      assert.equal(canMutatePromotions('AUDITOR'), false);
    });

    test('formatDiscountSummary formats percentage and fixed amounts', () => {
      assert.equal(formatDiscountSummary('PERCENTAGE', 15), 'ลด 15%');
      assert.equal(formatDiscountSummary('FIXED_AMOUNT', 500), 'ลด ฿500.00');
    });

    test('generatePromotionCard constructs valid Zwiz chat composer card payload', async () => {
      const mockPromo = {
        id: 'promo_beauty_10',
        code: 'BEAUTY10',
        name: 'Central Beauty Festival 10% Off',
        description: 'Special 10% discount on cosmetics above ฿2,000',
        discountType: 'PERCENTAGE' as any,
        discountValue: 10,
        bannerUrl: 'https://cdn.central.co.th/banner.jpg',
        startDate: new Date('2026-09-01T00:00:00Z'),
        endDate: new Date('2026-09-30T23:59:59Z'),
        isActive: true,
        applicableBUs: ['CENTRAL', 'CENTRAL_BEAUTY_CLUB'],
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const card = await generatePromotionCard(mockPromo, 'case_123');
      assert.equal(card.type, 'PROMOTION_CARD');
      assert.equal(card.promoCode, 'BEAUTY10');
      assert.equal(card.title, 'Central Beauty Festival 10% Off');
      assert.equal(card.discountSummary, 'ลด 10%');
      assert.ok(Array.isArray(card.actions));
      assert.ok(card.actions.length >= 2);
      assert.equal(card.actions[0].type, 'POSTBACK');
      assert.ok(card.actions[0].data?.includes('action=claim_promo'));
      assert.ok(card.actions[0].data?.includes('caseId=case_123'));
    });
  });
});
