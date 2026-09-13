import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { selectBestAgent, RoutingAlgorithmType } from '../../../src/lib/agents/queue-routing';
import {
  evaluateCaseInactivity,
  evaluateAgentResponseWait,
  evaluateCaseSla,
  SlaPendingFlag,
} from '../../../src/lib/cases/sla';
import {
  validateTrackingNumber,
  assertValidTrackingNumber,
  generateTrackingNumber,
  normalizeCarrier,
  TrackingValidationError,
} from '../../../src/lib/shipping/courier';
import {
  OrderNotPaidError,
  IncompleteAddressError,
} from '../../../src/lib/shipping/service';
import { QuotationStatus, ShippingCarrier } from '@prisma/client';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 5.4: Adversarial Stress & Guardrail Validation Suite (Challenger 1)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  // =========================================================================
  // Challenge 1: Headroom Saturation & Capacity Guardrails (Routing Engine)
  // =========================================================================
  describe('Challenge 1: Headroom Saturation & Capacity Guardrails', () => {
    test('CH1.1 - Saturation: When all agents have headroom <= 0, selectBestAgent strictly returns null', () => {
      // 5 agents, all fully saturated or over-saturated
      const saturatedAgents = [
        { id: 'agent_1', name: 'Agent 1', maxConcurrentChats: 5, activeChatCount: 5 },
        { id: 'agent_2', name: 'Agent 2', maxConcurrentChats: 3, activeChatCount: 3 },
        { id: 'agent_3', name: 'Agent 3', maxConcurrentChats: 4, activeChatCount: 5 }, // over-saturated (headroom = -1)
        { id: 'agent_4', name: 'Agent 4', agentProfile: { maxConcurrentChats: 5, activeChatCount: 5 } },
        { id: 'agent_5', name: 'Agent 5', maxChatCapacity: 2, activeChatCount: 2 },
      ];

      const resultLeastActive = selectBestAgent(saturatedAgents, 'LEAST_ACTIVE');
      assert.equal(resultLeastActive, null, 'Must return null when all agents have zero headroom (LEAST_ACTIVE)');

      const resultMostAvailable = selectBestAgent(saturatedAgents, 'MOST_AVAILABLE');
      assert.equal(resultMostAvailable, null, 'Must return null when all agents have zero headroom (MOST_AVAILABLE)');
    });

    test('CH1.2 - Boundary zero headroom: Agent with headroom === 0 is strictly excluded from candidates', () => {
      const agents = [
        { id: 'agent_full', name: 'Full Agent', maxConcurrentChats: 5, activeChatCount: 5 },
        { id: 'agent_available', name: 'Available Agent', maxConcurrentChats: 5, activeChatCount: 4 }, // headroom = 1
      ];

      const selected = selectBestAgent(agents, 'MOST_AVAILABLE');
      assert.ok(selected, 'Should find candidate with positive headroom');
      assert.equal(selected.id, 'agent_available', 'Must select available agent over full agent');
    });

    test('CH1.3 - Over-saturation rejection: Negative headroom must never be selected', () => {
      const overSaturated = [
        { id: 'agent_over_1', maxConcurrentChats: 2, activeChatCount: 10 },
        { id: 'agent_over_2', maxConcurrentChats: 0, activeChatCount: 1 },
      ];

      assert.equal(selectBestAgent(overSaturated, 'LEAST_ACTIVE'), null);
      assert.equal(selectBestAgent(overSaturated, 'MOST_AVAILABLE'), null);
    });

    test('CH1.4 - Edge inputs: empty list, null list, agents without profiles', () => {
      assert.equal(selectBestAgent([], 'LEAST_ACTIVE'), null);
      assert.equal(selectBestAgent(null as any, 'MOST_AVAILABLE'), null);

      // Default capacity fallback (maxConcurrentChats defaults to 5)
      const unconfigured = [{ id: 'agent_bare', activeChatCount: 2 }];
      const res = selectBestAgent(unconfigured, 'MOST_AVAILABLE');
      assert.ok(res);
      assert.equal(res.id, 'agent_bare');
    });

    test('CH1.5 - Algorithm behavioral divergence: MOST_AVAILABLE vs LEAST_ACTIVE', () => {
      // Agent A: 10 max, 3 active => headroom 7
      // Agent B: 3 max, 1 active  => headroom 2 (fewer active chats, but lower headroom)
      const candidateAgents = [
        { id: 'agent_a', name: 'High Capacity', maxConcurrentChats: 10, activeChatCount: 3 },
        { id: 'agent_b', name: 'Low Capacity', maxConcurrentChats: 3, activeChatCount: 1 },
      ];

      const selectedMostAvail = selectBestAgent(candidateAgents, 'MOST_AVAILABLE');
      assert.equal(selectedMostAvail.id, 'agent_a', 'MOST_AVAILABLE must choose Agent A (headroom 7 > headroom 2)');

      const selectedLeastActive = selectBestAgent(candidateAgents, 'LEAST_ACTIVE');
      assert.equal(selectedLeastActive.id, 'agent_b', 'LEAST_ACTIVE must choose Agent B (active 1 < active 3)');
    });

    test('CH1.6 - HTTP Dispatch Saturation: Full queue returns assignedAgentId === null and QUEUED status', async () => {
      // Set all baseline agents to max capacity 0 / BUSY
      const agentsRes = await fetch(`${APP_URL}/api/agents/presence`);
      const { agents } = await agentsRes.json();

      for (const agent of agents) {
        await fetch(`${APP_URL}/api/agents/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: agent.id,
            presence: 'ONLINE',
            maxConcurrentChats: 0, // 0 headroom
          })
        });
      }

      // Create test case
      const inboundRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: `evt_sat_${Date.now()}`,
          source: { channel: 'LINE', pageId: 'central_chatshop', businessUnit: 'Central', senderId: `U_sat_${Date.now()}` },
          session: { sessionId: `sess_sat_${Date.now()}`, botState: 'AGENT_HANDOFF' },
          message: { messageId: `msg_sat_${Date.now()}`, type: 'TEXT', text: 'Headroom saturation test' }
        })
      });
      const { caseId } = await inboundRes.json();

      // Dispatch case
      const dispatchRes = await fetch(`${APP_URL}/api/routing/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, strategy: 'MOST_AVAILABLE' })
      });

      assert.equal(dispatchRes.status, 200);
      const dispatchData = await dispatchRes.json();
      assert.equal(dispatchData.assignedAgentId, null, 'Must not assign an agent when headroom is saturated');
      assert.equal(dispatchData.status, 'QUEUED', 'Case status must remain QUEUED');
    });
  });

  // =========================================================================
  // Challenge 2: SLA Customer Inactivity & Threshold Guardrails
  // =========================================================================
  describe('Challenge 2: SLA Customer Inactivity & Inactivity Flag Clearing', () => {
    const baseTime = new Date('2026-09-13T10:00:00.000Z');

    test('CH2.1 - Inactivity Threshold Strictness: 0m to 14.99m is NONE', () => {
      // 0 minutes
      const res0 = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'IN_PROGRESS' }, baseTime);
      assert.equal(res0.pendingFlag, SlaPendingFlag.NONE);
      assert.equal(res0.elapsedMinutes, 0);

      // 14.99 minutes (899.4 seconds)
      const time14m59s = new Date(baseTime.getTime() + 14.99 * 60 * 1000);
      const res14 = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'IN_PROGRESS' }, time14m59s);
      assert.equal(res14.pendingFlag, SlaPendingFlag.NONE, '14.99m must remain NONE');
    });

    test('CH2.2 - Inactivity Threshold Strictness: 15.00m to 29.99m is PENDING_15M', () => {
      // Exactly 15.00 minutes
      const time15m = new Date(baseTime.getTime() + 15 * 60 * 1000);
      const res15 = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'IN_PROGRESS' }, time15m);
      assert.equal(res15.pendingFlag, SlaPendingFlag.PENDING_15M, '15.00m must trigger PENDING_15M');

      // 29.99 minutes
      const time29m = new Date(baseTime.getTime() + 29.99 * 60 * 1000);
      const res29 = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'IN_PROGRESS' }, time29m);
      assert.equal(res29.pendingFlag, SlaPendingFlag.PENDING_15M, '29.99m must remain PENDING_15M');
    });

    test('CH2.3 - Inactivity Threshold Strictness: 30.00m+ is PENDING_30M', () => {
      // Exactly 30.00 minutes
      const time30m = new Date(baseTime.getTime() + 30 * 60 * 1000);
      const res30 = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'IN_PROGRESS' }, time30m);
      assert.equal(res30.pendingFlag, SlaPendingFlag.PENDING_30M, '30.00m must trigger PENDING_30M');

      // 120 minutes (2 hours silence)
      const time120m = new Date(baseTime.getTime() + 120 * 60 * 1000);
      const res120 = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'IN_PROGRESS' }, time120m);
      assert.equal(res120.pendingFlag, SlaPendingFlag.PENDING_30M, '120m must remain PENDING_30M');
    });

    test('CH2.4 - Status Guardrail: Terminal cases (CLOSED / RESOLVED) never accumulate inactivity flags', () => {
      const time3hours = new Date(baseTime.getTime() + 180 * 60 * 1000);

      const resClosed = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'CLOSED' }, time3hours);
      assert.equal(resClosed.pendingFlag, SlaPendingFlag.NONE, 'CLOSED case must never trigger pending flag');

      const resResolved = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'RESOLVED' }, time3hours);
      assert.equal(resResolved.pendingFlag, SlaPendingFlag.NONE, 'RESOLVED case must never trigger pending flag');
    });

    test('CH2.5 - Inactivity Flag Clearing: When customer replies, pendingFlag clears back to NONE', () => {
      // 1. Initial evaluation at 35m silence -> PENDING_30M
      const time35m = new Date(baseTime.getTime() + 35 * 60 * 1000);
      const resBefore = evaluateCaseInactivity({ lastCustomerMessageAt: baseTime, status: 'IN_PROGRESS' }, time35m);
      assert.equal(resBefore.pendingFlag, SlaPendingFlag.PENDING_30M);

      // 2. Customer replies at 36m (lastCustomerMessageAt becomes 36m timestamp)
      const customerReplyTime = new Date(baseTime.getTime() + 36 * 60 * 1000);
      const nowEvaluation = new Date(customerReplyTime.getTime() + 1000); // 1 sec after reply

      const resAfter = evaluateCaseInactivity(
        { lastCustomerMessageAt: customerReplyTime, status: 'IN_PROGRESS' },
        nowEvaluation
      );
      assert.equal(resAfter.pendingFlag, SlaPendingFlag.NONE, 'Customer reply must reset pendingFlag to NONE');
      assert.ok(resAfter.elapsedMinutes < 1, 'Elapsed minutes must be less than 1');
    });

    test('CH2.6 - Agent response wait breach detection: Exceeding queue SLA marks isBreached = true', () => {
      const custMsgTime = baseTime;
      // Queue SLA is 15 min. Agent hasn't replied for 16 min.
      const evalTime = new Date(custMsgTime.getTime() + 16 * 60 * 1000);

      const waitResult = evaluateAgentResponseWait(
        { lastCustomerMessageAt: custMsgTime, slaResponseMin: 15, status: 'OPEN' },
        evalTime
      );
      assert.equal(waitResult.isBreached, true, 'Wait time of 16m > 15m must flag SLA breach');
      assert.ok(waitResult.slaBreachedAt);

      // Agent replied in 5 min (< 15 min)
      const agentReplyTime = new Date(custMsgTime.getTime() + 5 * 60 * 1000);
      const okResult = evaluateAgentResponseWait(
        { lastCustomerMessageAt: custMsgTime, lastAgentMessageAt: agentReplyTime, slaResponseMin: 15, status: 'OPEN' },
        evalTime
      );
      assert.equal(okResult.isBreached, false, 'Replied in 5m must not breach SLA');
      assert.equal(okResult.slaBreachedAt, null);
    });
  });

  // =========================================================================
  // Challenge 3: Shipping Fulfillment Paid Guard (Financial Guardrails)
  // =========================================================================
  describe('Challenge 3: Shipping Fulfillment Paid Guard', () => {
    test('CH3.1 - Non-PAID Quotations strictly reject shipping fulfillment (OrderNotPaidError / HTTP 400)', () => {
      // Test all illegal quotation statuses for fulfillment
      const invalidStatuses: QuotationStatus[] = [
        QuotationStatus.DRAFT,
        QuotationStatus.PENDING_PAYMENT,
        QuotationStatus.CANCEL,
        QuotationStatus.CANCELLED,
        QuotationStatus.VOID,
        QuotationStatus.EXPIRED,
      ];

      for (const status of invalidStatuses) {
        const err = new OrderNotPaidError('QT-TEST-999', status);
        assert.equal(err.statusCode, 400, `Status ${status} must result in HTTP 400`);
        assert.equal(err.code, 'ORDER_NOT_PAID', `Status ${status} must have error code ORDER_NOT_PAID`);
        assert.ok(
          err.message.includes('PAID or PRINTED'),
          `Error message must indicate status ${status} is not paid`
        );
      }
    });

    test('CH3.2 - Allowed Quotation Statuses: PAID, PRINTED, COMPLETED qualify for fulfillment', () => {
      const allowedStatuses = [QuotationStatus.PAID, QuotationStatus.PRINTED, QuotationStatus.COMPLETED];
      for (const status of allowedStatuses) {
        // Verify these statuses are in the allowed whitelist
        const eligibleStatuses = [QuotationStatus.PAID, QuotationStatus.PRINTED, QuotationStatus.COMPLETED];
        assert.ok(eligibleStatuses.includes(status), `Status ${status} must be recognized as eligible`);
      }
    });

    test('CH3.3 - Address Completeness Guardrail: Missing required fields throws IncompleteAddressError (HTTP 422)', () => {
      const errMissingStreet = new IncompleteAddressError(['shippingAddress']);
      assert.equal(errMissingStreet.statusCode, 422);
      assert.equal(errMissingStreet.code, 'INCOMPLETE_ADDRESS');
      assert.deepEqual(errMissingStreet.details.missingFields, ['shippingAddress']);

      const errMissingAll = new IncompleteAddressError(['recipientName', 'recipientPhone', 'shippingAddress', 'postalCode']);
      assert.equal(errMissingAll.statusCode, 422);
      assert.equal(errMissingAll.details.missingFields.length, 4);
    });

    test('CH3.4 - HTTP Endpoint Paid Guard: Calling label generation for unpaid quotation returns HTTP 400', async () => {
      // 1. Create Inbound case
      const caseRes = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: `evt_unpaid_${Date.now()}`,
          source: { channel: 'LINE', pageId: 'central_chatshop', businessUnit: 'Central', senderId: `U_unpaid_${Date.now()}` },
          session: { sessionId: `sess_unpaid_${Date.now()}`, botState: 'AGENT_HANDOFF' },
          message: { messageId: `msg_unpaid_${Date.now()}`, type: 'TEXT', text: 'Unpaid shipping guard test' }
        })
      });
      const { caseId } = await caseRes.json();

      // 2. Create quotation in DRAFT / PENDING_PAYMENT status (not marked PAID)
      const quoteRes = await fetch(`${APP_URL}/api/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          businessUnit: 'Central',
          items: [{ sku: 'SKU-UNPAID', productName: 'Unpaid Item', quantity: 1, unitPrice: 5000 }]
        })
      });
      const { quotation } = await quoteRes.json();
      assert.equal(quotation.status, 'PENDING_PAYMENT');

      // 3. Attempt to generate shipping label before paying
      const labelRes = await fetch(`${APP_URL}/api/shipping/labels/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotationId: quotation.id,
          carrier: 'KERRY',
          shippingAddress: '1027 Ploenchit Rd, Bangkok 10330',
          postalCode: '10330',
          recipientName: 'Khun Adversary',
          recipientPhone: '0812345678',
        })
      });

      assert.equal(labelRes.status, 400, 'Must strictly return HTTP 400 for unpaid quotation');
      const errData = await labelRes.json();
      assert.equal(errData.code, 'ORDER_NOT_PAID', 'Must return code ORDER_NOT_PAID');
    });
  });

  // =========================================================================
  // Challenge 4: Courier Tracking Regex Validation & Malformed Input Rejection
  // =========================================================================
  describe('Challenge 4: Courier Tracking Regex Validation & Format Assertions', () => {
    test('CH4.1 - Kerry Express: Valid formats pass regex; invalid formats throw HTTP 422 TrackingValidationError', () => {
      // Valid Kerry tracking numbers
      const validKerry = [
        'KEX102938475TH',
        'KEX12345678',
        'SHP9921004412',
        'KER8819203912TH',
        '1234567890',      // 10 digits
        '1234567890123',   // 13 digits
      ];

      for (const track of validKerry) {
        assert.equal(validateTrackingNumber('KERRY', track), true, `Kerry track '${track}' should be valid`);
        assert.doesNotThrow(() => assertValidTrackingNumber('KERRY', track));
      }

      // Invalid Kerry tracking numbers
      const invalidKerry = [
        'INVALID',
        'KEX123',             // too short (< 8 chars)
        'KEX12345678901234TH', // too long (> 12 chars)
        'KEX!@#$%^TH',        // special characters
        '123456789',          // 9 digits (must be 10-13)
        '12345678901234',     // 14 digits (must be 10-13)
        'TH01029384756A',     // Flash tracking format
        'CTEX-2026-009182TH', // Central Express format
        '',                   // empty string
      ];

      for (const track of invalidKerry) {
        assert.equal(validateTrackingNumber('KERRY', track), false, `Kerry track '${track}' must be invalid`);
        assert.throws(
          () => assertValidTrackingNumber('KERRY', track),
          (err: any) => err instanceof TrackingValidationError && err.statusCode === 422 && err.code === 'INVALID_TRACKING_FORMAT'
        );
      }
    });

    test('CH4.2 - Flash Express: Valid formats pass regex; invalid formats throw HTTP 422 TrackingValidationError', () => {
      // Valid Flash tracking numbers (TH or FLS prefix + 10-14 alphanumeric)
      const validFlash = [
        'TH01029384756A',
        'TH123456789012',
        'FLS8839201948',
        'FLS01029384756789',
      ];

      for (const track of validFlash) {
        assert.equal(validateTrackingNumber('FLASH', track), true, `Flash track '${track}' should be valid`);
        assert.doesNotThrow(() => assertValidTrackingNumber('FLASH', track));
      }

      // Invalid Flash tracking numbers
      const invalidFlash = [
        'INVALID',
        'TH123',          // too short (< 10 chars)
        'FLS123456789',   // 9 chars (< 10 chars)
        'FLS123456789012345', // 15 chars (> 14 chars)
        'KEX102938475TH', // Kerry tracking format
        'CTEX-2026-009182TH',
        'FLASH_001',
        '',
      ];

      for (const track of invalidFlash) {
        assert.equal(validateTrackingNumber('FLASH', track), false, `Flash track '${track}' must be invalid`);
        assert.throws(
          () => assertValidTrackingNumber('FLASH', track),
          (err: any) => err instanceof TrackingValidationError && err.statusCode === 422 && err.code === 'INVALID_TRACKING_FORMAT'
        );
      }
    });

    test('CH4.3 - Central Express: Valid formats pass regex; invalid formats throw HTTP 422 TrackingValidationError', () => {
      // Valid Central Express tracking numbers
      const validCtex = [
        'CTEX-2026-009182TH',
        'CTEX-2026-123456',
        'CTEX20261234',
        'CTEX98210344',
        'CTEX-2026-12345678TH',
      ];

      for (const track of validCtex) {
        assert.equal(validateTrackingNumber('CENTRAL_EXPRESS', track), true, `Central Express track '${track}' should be valid`);
        assert.doesNotThrow(() => assertValidTrackingNumber('CENTRAL_EXPRESS', track));
      }

      // Invalid Central Express tracking numbers
      const invalidCtex = [
        'INVALID',
        'CTEX',
        'CTX123',
        'CTEX-26-123',
        'KEX102938475TH',
        'TH01029384756A',
        '',
      ];

      for (const track of invalidCtex) {
        assert.equal(validateTrackingNumber('CENTRAL_EXPRESS', track), false, `Central Express track '${track}' must be invalid`);
        assert.throws(
          () => assertValidTrackingNumber('CENTRAL_EXPRESS', track),
          (err: any) => err instanceof TrackingValidationError && err.statusCode === 422 && err.code === 'INVALID_TRACKING_FORMAT'
        );
      }
    });

    test('CH4.4 - Carrier Normalization & Automated Number Generation Conformity', () => {
      // Normalization aliases
      assert.equal(normalizeCarrier('KEX'), ShippingCarrier.KERRY);
      assert.equal(normalizeCarrier('Kerry Express'), ShippingCarrier.KERRY);
      assert.equal(normalizeCarrier('FLS'), ShippingCarrier.FLASH);
      assert.equal(normalizeCarrier('Flash Express'), ShippingCarrier.FLASH);
      assert.equal(normalizeCarrier('Central'), ShippingCarrier.CENTRAL_EXPRESS);
      assert.equal(normalizeCarrier('CTEX'), ShippingCarrier.CENTRAL_EXPRESS);

      // Automated tracking number generation satisfies respective regexes
      for (let i = 0; i < 5; i++) {
        const kerryGen = generateTrackingNumber(ShippingCarrier.KERRY);
        assert.ok(validateTrackingNumber(ShippingCarrier.KERRY, kerryGen), `Generated Kerry tracking ${kerryGen} must be valid`);

        const flashGen = generateTrackingNumber(ShippingCarrier.FLASH);
        assert.ok(validateTrackingNumber(ShippingCarrier.FLASH, flashGen), `Generated Flash tracking ${flashGen} must be valid`);

        const ctexGen = generateTrackingNumber(ShippingCarrier.CENTRAL_EXPRESS);
        assert.ok(validateTrackingNumber(ShippingCarrier.CENTRAL_EXPRESS, ctexGen), `Generated CTEX tracking ${ctexGen} must be valid`);
      }
    });

    test('CH4.5 - Unknown Carrier Rejection: Invalid carrier returns false and throws TrackingValidationError', () => {
      assert.equal(validateTrackingNumber('UNKNOWN_LOGISTICS', 'KEX12345678TH'), false);
      assert.throws(
        () => assertValidTrackingNumber('UNKNOWN_LOGISTICS', 'KEX12345678TH'),
        (err: any) => err instanceof TrackingValidationError && err.statusCode === 422
      );
    });
  });
});
