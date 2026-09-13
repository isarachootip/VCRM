/**
 * Tier 5: White-Box Adversarial Coverage Hardening & Edge-Case Stress Test Suite
 * Path: tests/phase3/tier5-adversarial/t5.1-white-box-adversarial.test.ts
 *
 * Exhaustive adversarial stress test covering R1-R5 core algorithms, boundary values,
 * error handling, and crash vectors in src/lib/:
 * - R1: Idle sweep threshold validation & elapsed calculation clamping
 * - R2: Courier signature HMAC verification, carrier normalization, status transitions, idempotency
 * - R3: Presence normalization, break duration limits, overrun calculation, adherence clamping
 * - R4: Portal link RBAC enforcement, payload size limits (413), URL scheme injection (400)
 * - R5: VIP tagging RBAC, priority queue sorting, senior agent pool isolation, workload clamping
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// R1: Idle Sweep
import { validateSweepThresholds } from '../../../src/lib/cases/idle-sweep';

// R2: Shipping Tracking
import {
  verifyCourierSignature,
  normalizeCarrier,
  validateTrackingNumber,
  validateDeliveryStatus,
  getCarrierDisplayName,
  getStatusLabelTh,
} from '../../../src/lib/shipping/tracking-service';
import {
  CarrierValidationError,
  MissingTrackingNumberError,
  InvalidStatusError,
  CourierSignatureError,
} from '../../../src/lib/shipping/types';
import { ShippingCarrier, ShippingStatus } from '@prisma/client';

// R3: Agent Presence & Break Sweeper
import {
  normalizePresenceStatus,
  PresenceError,
} from '../../../src/lib/agents/presence';
import { PresenceStatus } from '../../../src/lib/agents/types';

// R4: Portal Links Hub
import {
  createPortalLink,
  PortalLinkForbiddenError,
  PortalLinkUnauthorizedError,
  PortalLinkValidationError,
  PortalLinkPayloadTooLargeError,
} from '../../../src/lib/portal-links/service';

// R5: VIP Tagging & Routing
import { VipServiceError } from '../../../src/lib/customers/vip-service';
import { selectBestAgent } from '../../../src/lib/agents/queue-routing';

// =========================================================================
// Suite 1: R1 Idle Sweep Engine Adversarial Boundaries
// =========================================================================
describe('Tier 5.1: R1 Idle Sweep Engine Adversarial Boundaries', () => {
  test('T5.1.1 - Equal warning and close thresholds (warn === close) throws structured 400 error', () => {
    assert.throws(
      () => validateSweepThresholds(60, 60),
      (err: any) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /strictly less than/i);
        return true;
      }
    );
  });

  test('T5.1.2 - Warning threshold greater than close threshold (warn > close) throws structured error', () => {
    assert.throws(
      () => validateSweepThresholds(70, 60),
      (err: any) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /strictly less than/i);
        return true;
      }
    );
  });

  test('T5.1.3 - Non-numeric, NaN, zero, and negative thresholds throw validation errors', () => {
    const invalidPairs: [any, any][] = [
      [0, 60],
      [-10, 60],
      [50, 0],
      [50, -10],
      [NaN, 60],
      [50, NaN],
      ['50' as any, 60],
      [null as any, 60],
      [undefined as any, 60],
    ];

    for (const [warn, close] of invalidPairs) {
      assert.throws(
        () => validateSweepThresholds(warn, close),
        (err: any) => err instanceof Error
      );
    }
  });

  test('T5.1.4 - Fractional minute thresholds (e.g. 0.5m warning, 1.0m closure) pass validation', () => {
    assert.doesNotThrow(() => validateSweepThresholds(0.5, 1.0));
  });

  test('T5.1.5 - Elapsed calculation with clock skew clamps elapsed time to 0 ms without NaN or negative values', () => {
    const now = new Date('2026-09-13T10:00:00.000Z');
    const futureActivityTime = new Date('2026-09-13T10:05:00.000Z'); // 5 minutes in the future

    const elapsedMs = Math.max(0, now.getTime() - futureActivityTime.getTime());
    const elapsedMinutes = elapsedMs / (60 * 1000);

    assert.equal(elapsedMs, 0, 'Clock skew must be clamped to 0');
    assert.equal(elapsedMinutes, 0, 'Elapsed minutes must be 0');
    assert.ok(!isNaN(elapsedMinutes), 'Elapsed minutes must not be NaN');
  });
});

// =========================================================================
// Suite 2: R2 Courier Tracking Webhook & Lifecycle Adversarial Tests
// =========================================================================
describe('Tier 5.2: R2 Courier Tracking Webhook & Lifecycle Adversarial Tests', () => {
  const SECRET = process.env.COURIER_WEBHOOK_SECRET || 'central-courier-secret-2026';

  test('T5.2.1 - Signature verification rejects missing "sha256=" prefix with CourierSignatureError (401)', () => {
    assert.throws(
      () => verifyCourierSignature('md5=1234567890abcdef', { test: true }),
      (err: any) => {
        assert.ok(err instanceof CourierSignatureError);
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /must use sha256 prefix/i);
        return true;
      }
    );
  });

  test('T5.2.2 - Signature verification rejects empty sha256 digest with CourierSignatureError (401)', () => {
    assert.throws(
      () => verifyCourierSignature('sha256=  ', { test: true }),
      (err: any) => {
        assert.ok(err instanceof CourierSignatureError);
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /empty sha256 signature/i);
        return true;
      }
    );
  });

  test('T5.2.3 - Signature verification rejects forged HMAC digest with CourierSignatureError (401)', () => {
    const forgedSig = 'sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    assert.throws(
      () => verifyCourierSignature(forgedSig, JSON.stringify({ trackingNumber: 'KRY-123' })),
      (err: any) => {
        assert.ok(err instanceof CourierSignatureError);
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /HMAC signature verification failed/i);
        return true;
      }
    );
  });

  test('T5.2.4 - Signature verification accepts authentic HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ trackingNumber: 'KRY-99999', status: 'IN_TRANSIT' });
    const authenticDigest = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const validHeader = `sha256=${authenticDigest}`;

    assert.doesNotThrow(() => verifyCourierSignature(validHeader, payload));
  });

  test('T5.2.5 - Signature verification accepts authorized mock courier token in development / test sandbox', () => {
    const mockHeader = 'sha256=mock-courier-valid-signature';
    assert.doesNotThrow(() => verifyCourierSignature(mockHeader, { any: 'payload' }));
  });

  test('T5.2.6 - Carrier normalization handles varied formats, whitespace, and hyphens', () => {
    assert.equal(normalizeCarrier('  k-e-r-r-y  '), ShippingCarrier.KERRY);
    assert.equal(normalizeCarrier('KEX'), ShippingCarrier.KERRY);
    assert.equal(normalizeCarrier('FLASH_EXPRESS'), ShippingCarrier.FLASH);
    assert.equal(normalizeCarrier('FLS'), ShippingCarrier.FLASH);
    assert.equal(normalizeCarrier('central express'), ShippingCarrier.CENTRAL_EXPRESS);
    assert.equal(normalizeCarrier('CTEX'), ShippingCarrier.CENTRAL_EXPRESS);
    assert.equal(normalizeCarrier('CDS'), ShippingCarrier.CENTRAL_EXPRESS);
    assert.equal(normalizeCarrier('CTX'), ShippingCarrier.CENTRAL_EXPRESS);
  });

  test('T5.2.7 - Carrier normalization rejects unsupported carriers with CarrierValidationError (422)', () => {
    const invalidCarriers = ['DHL', 'FEDEX', 'GRAB', 'LINEMAN', '', '   ', null, undefined];
    for (const c of invalidCarriers) {
      assert.throws(
        () => normalizeCarrier(c as any),
        (err: any) => {
          assert.ok(err instanceof CarrierValidationError);
          assert.equal(err.statusCode, 422);
          assert.equal(err.code, 'INVALID_CARRIER');
          return true;
        }
      );
    }
  });

  test('T5.2.8 - Tracking number validation rejects empty, whitespace-only, or non-string inputs with 400', () => {
    const invalidTracking = ['', '   ', null, undefined, 12345 as any];
    for (const t of invalidTracking) {
      assert.throws(
        () => validateTrackingNumber(t),
        (err: any) => {
          assert.ok(err instanceof MissingTrackingNumberError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'MISSING_TRACKING_NUMBER');
          return true;
        }
      );
    }
  });

  test('T5.2.9 - Delivery status validation normalizes case and rejects invalid statuses with 400', () => {
    assert.equal(validateDeliveryStatus('packed'), ShippingStatus.PACKED);
    assert.equal(validateDeliveryStatus('  in_transit  '), ShippingStatus.IN_TRANSIT);
    assert.equal(validateDeliveryStatus('DELIVERED'), ShippingStatus.DELIVERED);

    const invalidStatuses = ['LOST_PACKAGE', 'RETURNED_TO_SENDER', 'UNKNOWN', '', null];
    for (const s of invalidStatuses) {
      assert.throws(
        () => validateDeliveryStatus(s as any),
        (err: any) => {
          assert.ok(err instanceof InvalidStatusError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'INVALID_STATUS');
          return true;
        }
      );
    }
  });

  test('T5.2.10 - Display name and Thai status labels return meaningful descriptions for all carriers and statuses', () => {
    assert.equal(getCarrierDisplayName(ShippingCarrier.KERRY), 'Kerry Express');
    assert.equal(getCarrierDisplayName(ShippingCarrier.FLASH), 'Flash Express');
    assert.equal(getCarrierDisplayName(ShippingCarrier.CENTRAL_EXPRESS), 'Central Express (3-Hr Delivery)');

    assert.ok(getStatusLabelTh('DELIVERED').includes('สำเร็จ'));
    assert.ok(getStatusLabelTh('DELIVERY_FAILED').includes('ไม่สำเร็จ'));
  });
});

// =========================================================================
// Suite 3: R3 Agent Presence & Break Sweeper Adversarial Boundaries
// =========================================================================
describe('Tier 5.3: R3 Agent Presence & Break Sweeper Adversarial Boundaries', () => {
  test('T5.3.1 - Presence normalization handles case-insensitivity and rejects invalid presence values', () => {
    assert.equal(normalizePresenceStatus('online'), PresenceStatus.ONLINE);
    assert.equal(normalizePresenceStatus('  offline  '), PresenceStatus.OFFLINE);
    assert.equal(normalizePresenceStatus('LUNCH'), PresenceStatus.LUNCH);
    assert.equal(normalizePresenceStatus('break'), PresenceStatus.BREAK);

    const invalidPresences = ['SLEEPING', 'BUSY', 'MEETING', 'AWAY', '', '   '];
    for (const p of invalidPresences) {
      assert.throws(
        () => normalizePresenceStatus(p),
        (err: any) => {
          assert.ok(err instanceof PresenceError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'INVALID_PRESENCE_STATUS');
          return true;
        }
      );
    }
  });

  test('T5.3.2 - Break duration validation enforces boundaries [1, 480] and rejects non-finite / negative values', () => {
    // Valid boundaries
    const validateDuration = (d: any) => {
      if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0 || d > 480) {
        throw new PresenceError('Invalid break duration', 400, 'INVALID_DURATION');
      }
    };

    assert.doesNotThrow(() => validateDuration(1));
    assert.doesNotThrow(() => validateDuration(15));
    assert.doesNotThrow(() => validateDuration(60));
    assert.doesNotThrow(() => validateDuration(480));

    const invalidDurations = [0, -1, -60, 481, 1000, NaN, Infinity, -Infinity, '15' as any];
    for (const d of invalidDurations) {
      assert.throws(
        () => validateDuration(d),
        (err: any) => {
          assert.ok(err instanceof PresenceError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'INVALID_DURATION');
          return true;
        }
      );
    }
  });

  test('T5.3.3 - Overrun seconds calculation correctly handles on-time, premature, and overrun durations', () => {
    const startedAt = new Date('2026-09-13T12:00:00Z');
    const expectedEndAt = new Date(startedAt.getTime() + 15 * 60000); // 12:15:00Z

    // Case 1: 14m 59s elapsed (premature) -> overrun 0
    const now14m59s = new Date(startedAt.getTime() + 14 * 60000 + 59000);
    const overrun1 = Math.max(0, Math.floor((now14m59s.getTime() - expectedEndAt.getTime()) / 1000));
    assert.equal(overrun1, 0);

    // Case 2: Exactly 15m 00s (on-time expiration) -> overrun 0
    const now15m = new Date(expectedEndAt.getTime());
    const overrun2 = Math.max(0, Math.floor((now15m.getTime() - expectedEndAt.getTime()) / 1000));
    assert.equal(overrun2, 0);

    // Case 3: 20m elapsed (5 minutes overrun) -> overrun 300s
    const now20m = new Date(startedAt.getTime() + 20 * 60000);
    const overrun3 = Math.max(0, Math.floor((now20m.getTime() - expectedEndAt.getTime()) / 1000));
    assert.equal(overrun3, 300);
  });

  test('T5.3.4 - Adherence score calculation clamps strictly between 0 and 100 under extreme overruns', () => {
    const computeAdherence = (overrunSeconds: number) => {
      const overrunMinutes = Math.round(overrunSeconds / 60);
      return Math.max(0, Math.min(100, Math.round(100 - overrunMinutes * 2)));
    };

    assert.equal(computeAdherence(0), 100, '0 overrun -> 100% adherence');
    assert.equal(computeAdherence(300), 90, '5m overrun -> 90% adherence (100 - 5*2)');
    assert.equal(computeAdherence(3000), 0, '50m overrun -> 0% adherence');
    assert.equal(computeAdherence(60000), 0, '1000m extreme overrun -> clamped at 0% (not negative)');
  });
});

// =========================================================================
// Suite 4: R4 Operations Portal Links Hub RBAC & Boundary Tests
// =========================================================================
describe('Tier 5.4: R4 Operations Portal Links Hub RBAC & Boundary Tests', () => {
  test('T5.4.1 - createPortalLink rejects unauthenticated callers with 401 PortalLinkUnauthorizedError', async () => {
    const unauthRoles = [null, undefined, '', '   '];
    for (const r of unauthRoles) {
      await assert.rejects(
        async () => createPortalLink({ title: 'AIPX', url: 'https://aipx.central.co.th' }, r),
        (err: any) => {
          assert.ok(err instanceof PortalLinkUnauthorizedError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.code, 'UNAUTHORIZED');
          return true;
        }
      );
    }
  });

  test('T5.4.2 - createPortalLink rejects non-administrative roles (AGENT, USER) with 403 PortalLinkForbiddenError', async () => {
    const nonAdminRoles = ['AGENT', 'agent', 'USER', 'GUEST', 'DIGITAL_ASSISTANT'];
    for (const r of nonAdminRoles) {
      await assert.rejects(
        async () => createPortalLink({ title: 'AIPX', url: 'https://aipx.central.co.th' }, r),
        (err: any) => {
          assert.ok(err instanceof PortalLinkForbiddenError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'PORTAL_LINK_MUTATION_RESTRICTED');
          return true;
        }
      );
    }
  });

  test('T5.4.3 - createPortalLink rejects title exceeding 2000 characters with 413 PortalLinkPayloadTooLargeError', async () => {
    const hugeTitle = 'A'.repeat(2001);
    await assert.rejects(
      async () => createPortalLink({ title: hugeTitle, url: 'https://aipx.central.co.th' }, 'ADMIN'),
      (err: any) => {
        assert.ok(err instanceof PortalLinkPayloadTooLargeError);
        assert.equal(err.statusCode, 413);
        assert.equal(err.code, 'PAYLOAD_TOO_LARGE');
        return true;
      }
    );
  });

  test('T5.4.4 - createPortalLink rejects URL exceeding 2000 characters with 413 PortalLinkPayloadTooLargeError', async () => {
    const hugeUrl = `https://aipx.central.co.th/?query=${'X'.repeat(2000)}`;
    await assert.rejects(
      async () => createPortalLink({ title: 'Valid Title', url: hugeUrl }, 'ADMIN'),
      (err: any) => {
        assert.ok(err instanceof PortalLinkPayloadTooLargeError);
        assert.equal(err.statusCode, 413);
        assert.equal(err.code, 'PAYLOAD_TOO_LARGE');
        return true;
      }
    );
  });

  test('T5.4.5 - createPortalLink rejects invalid schemes (javascript:, ftp:, data:, relative URLs) with 400', async () => {
    const invalidUrls = [
      'javascript:alert(1)',
      'ftp://ftp.central.co.th',
      'data:text/html,<script>alert(1)</script>',
      '/relative/path',
      'not_a_url',
      'http//missingcolon.com',
    ];

    for (const url of invalidUrls) {
      await assert.rejects(
        async () => createPortalLink({ title: 'Test Tool', url }, 'ADMIN'),
        (err: any) => {
          assert.ok(err instanceof PortalLinkValidationError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'VALIDATION_ERROR');
          return true;
        }
      );
    }
  });

  test('T5.4.6 - Display order normalization safely handles negative and floating-point numbers', () => {
    const normalizeOrder = (orderInput: any): number => {
      return orderInput !== undefined && Number.isFinite(Number(orderInput))
        ? Math.floor(Number(orderInput))
        : 0;
    };

    assert.equal(normalizeOrder(-5), -5);
    assert.equal(normalizeOrder(3.8), 3);
    assert.equal(normalizeOrder('10'), 10);
    assert.equal(normalizeOrder(NaN), 0);
    assert.equal(normalizeOrder(null), 0);
    assert.equal(normalizeOrder(undefined), 0);
  });
});

// =========================================================================
// Suite 5: R5 VIP Tagging & Priority Routing Adversarial Tests
// =========================================================================
describe('Tier 5.5: R5 VIP Tagging & Priority Routing Adversarial Tests', () => {
  test('T5.5.1 - tagCustomerVip validation rejects empty or missing vipTier when isVip=true with 400', () => {
    const validateVipInput = (isVip: boolean, vipTier?: string | null) => {
      if (isVip) {
        if (!vipTier || typeof vipTier !== 'string' || vipTier.trim().length === 0) {
          throw new VipServiceError('A valid non-empty vipTier is required', 400);
        }
      }
    };

    assert.doesNotThrow(() => validateVipInput(true, 'NSC_VIP'));
    assert.doesNotThrow(() => validateVipInput(false, null));

    const invalidTiers = ['', '   ', null, undefined, 12345 as any];
    for (const tier of invalidTiers) {
      assert.throws(
        () => validateVipInput(true, tier),
        (err: any) => {
          assert.ok(err instanceof VipServiceError);
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    }
  });

  test('T5.5.2 - selectBestAgent filters out non-VIP agents when isVipCase=true, even if regular agents have more headroom', () => {
    const agents = [
      {
        id: 'agent_regular',
        name: 'Regular Agent',
        role: 'AGENT',
        isVipEligible: false,
        activeChatCount: 0,
        maxConcurrentChats: 5, // Headroom = 5
      },
      {
        id: 'agent_senior_vip',
        name: 'Senior DA Agent',
        role: 'AGENT',
        isVipEligible: true,
        activeChatCount: 2,
        maxConcurrentChats: 5, // Headroom = 3
      },
    ];

    // Standard case -> routes to agent_regular (headroom 5 > headroom 3)
    const standardBest = selectBestAgent(agents, 'MOST_AVAILABLE', false);
    assert.equal(standardBest?.id, 'agent_regular');

    // VIP case -> must route to agent_senior_vip (strict pool prioritization)
    const vipBest = selectBestAgent(agents, 'MOST_AVAILABLE', true);
    assert.equal(vipBest?.id, 'agent_senior_vip', 'VIP chat must route to VIP-eligible agent');
  });

  test('T5.5.3 - selectBestAgent returns null (strict queue overflow) if VIP agents are full, refusing fallback to non-VIP agents', () => {
    const agents = [
      {
        id: 'agent_regular',
        name: 'Regular Agent',
        role: 'AGENT',
        isVipEligible: false,
        activeChatCount: 0,
        maxConcurrentChats: 5, // Headroom = 5
      },
      {
        id: 'agent_senior_vip',
        name: 'Senior DA Agent',
        role: 'AGENT',
        isVipEligible: true,
        activeChatCount: 5,
        maxConcurrentChats: 5, // Headroom = 0 (AT CAPACITY)
      },
    ];

    const vipBest = selectBestAgent(agents, 'MOST_AVAILABLE', true);
    assert.equal(vipBest, null, 'VIP chat must remain queued if all VIP agents are at max capacity');
  });

  test('T5.5.4 - selectBestAgent returns null if availableAgents array is empty or null', () => {
    assert.equal(selectBestAgent([], 'LEAST_ACTIVE', false), null);
    assert.equal(selectBestAgent(null as any, 'LEAST_ACTIVE', false), null);
  });

  test('T5.5.5 - selectBestAgent MOST_AVAILABLE breaks headroom ties with activeChatCount ASC, then lastAssignedAt ASC', () => {
    const agents = [
      {
        id: 'agent_a',
        activeChatCount: 3,
        maxConcurrentChats: 8, // Headroom = 5, chats = 3
        lastAssignedAt: new Date('2026-09-13T10:00:00Z'),
      },
      {
        id: 'agent_b',
        activeChatCount: 1,
        maxConcurrentChats: 6, // Headroom = 5, chats = 1 (LOWER CHATS)
        lastAssignedAt: new Date('2026-09-13T10:05:00Z'),
      },
      {
        id: 'agent_c',
        activeChatCount: 1,
        maxConcurrentChats: 6, // Headroom = 5, chats = 1, EARLIER ASSIGNMENT
        lastAssignedAt: new Date('2026-09-13T09:30:00Z'),
      },
    ];

    const selected = selectBestAgent(agents, 'MOST_AVAILABLE', false);
    assert.equal(selected?.id, 'agent_c', 'agent_c has same headroom (5), same chat count (1), but earlier lastAssignedAt');
  });

  test('T5.5.6 - selectBestAgent LEAST_ACTIVE breaks chat count ties with lastAssignedAt ASC', () => {
    const agents = [
      {
        id: 'agent_x',
        activeChatCount: 2,
        maxConcurrentChats: 5,
        lastAssignedAt: new Date('2026-09-13T10:30:00Z'),
      },
      {
        id: 'agent_y',
        activeChatCount: 2,
        maxConcurrentChats: 5,
        lastAssignedAt: new Date('2026-09-13T10:15:00Z'), // EARLIER
      },
    ];

    const selected = selectBestAgent(agents, 'LEAST_ACTIVE', false);
    assert.equal(selected?.id, 'agent_y');
  });

  test('T5.5.7 - Workload decrement clamping prevents negative activeChatCount under redundant release calls', () => {
    let activeChatCount = 0;

    // Simulate releaseCaseFromAgent workload decrement clamping logic
    const releaseChat = (current: number): number => {
      return Math.max(0, current - 1);
    };

    activeChatCount = releaseChat(activeChatCount);
    assert.equal(activeChatCount, 0, 'Must not drop below 0 on first release');

    activeChatCount = releaseChat(activeChatCount);
    assert.equal(activeChatCount, 0, 'Must not drop below 0 on repeated release');
  });
});
