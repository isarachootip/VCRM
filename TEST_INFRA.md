# Test Infrastructure & E2E Testing Architecture (Phase 3)

## 1. Overview & Test Architecture

The Central Chat & Shop (Omnichannel Social Commerce CRM) test suite utilizes an **opaque-box, requirement-driven end-to-end (E2E) testing framework** running entirely against native Node.js 22 test runner (`node:test`, `node:assert/strict`) without third-party test runners.

Tests execute against real network HTTP interfaces and PostgreSQL database transactions, validating production-identical behaviors across all social channels (LINE, Facebook, Instagram), courier partners (Kerry, Flash, Central Express), payment gateways, and enterprise portal systems.

### Dual-Server & Mock Sandbox Topology

```
+-----------------------------------------------------------------------------------------+
|                                      TEST RUNNER                                        |
|                          (tests/run-phase3.ts / tests/run-all-phases.ts)                |
+--------------------------------------------+--------------------------------------------+
                                             |
                                  HTTP (Fetch API Calls)
                                             |
       +--------------------+----------------+--------------------+--------------------+
       |                    |                                     |                    |
       v                    v                                     v                    v
+---------------+  +-------------------+                   +---------------+  +-------------------+
|  Mock Zwiz    |  |  Mock Qualtrics   |                   | Mock Payment  |  |   Mock Courier    |
|  Bot Gateway  |  |  CSAT Survey      |                   |  Gateway      |  |  Logistics Hub    |
|  (:4010)      |  |  (:4020)          |                   |  (:4030)      |  |   (:4040)         |
+-------+-------+  +--------+----------+                   +-------+-------+  +--------+----------+
        ^                   ^                                      ^                   ^
        | Outbound / Sync   | CSAT Trigger                         | Webhook Confirm   | Tracking Webhook
        +-------------------+----------------+---------------------+-------------------+
                                             |
                                             v
                            +---------------------------------+
                            |  Test CRM Server (Port 3001)    |
                            |  tests/runner/test-crm-server.ts|
                            +----------------+----------------+
                                             |
                                        Prisma ORM
                                             v
                            +---------------------------------+
                            | PostgreSQL Database (Real DB)   |
                            | prisma/schema.prisma            |
                            +---------------------------------+
```

### Network Port Allocation

| Port | Service | Implementation | Purpose |
|------|---------|----------------|---------|
| `3001` | Test CRM Server | `tests/runner/test-crm-server.ts` | Complete CRM HTTP API, routing, sweeps, Prisma ORM bridge |
| `4010` | Mock Zwiz.AI Gateway | `tests/mocks/zwiz-mock-server.ts` | Inbound social chat webhooks, outbound customer dispatch, bot state sync |
| `4020` | Mock Qualtrics CSAT | `tests/mocks/qualtrics-mock-server.ts` | Post-chat CSAT survey trigger dispatcher and response simulator |
| `4030` | Mock Payment Gateway | `tests/mocks/payment-mock-server.ts` | Multi-BU Credit Card and PromptPay payment webhooks & slips |
| `4040` | Mock Courier Partner | `tests/mocks/courier-mock-server.ts` | Carrier tracking webhook generator (Kerry, Flash, Central Express), thermal labels |

---

## 2. 4-Tier Test Classification & Methodology

Every feature in Phase 3 is covered across 4 distinct testing tiers to ensure zero-defect production readiness:

### Tier 1: Feature Coverage (Happy Path & Interface Contracts)
- Tests primary behaviors, correct status codes, data persistence, and outbound integrations.
- **Requirement:** Minimum 5 test cases per requirement across R1–R5 (>=25 tests).
- **Actual:** 30 tests across 5 test suites.

### Tier 2: Boundary & Corner Cases
- Tests off-by-one threshold limits (e.g. 49m vs 50m, 59m vs 60m, 14m vs 15m), concurrency races, duplicate replay idempotency, malformed payloads, role-based authorization denials, and extreme values.
- **Requirement:** Minimum 5 test cases per requirement across R1–R5 (>=25 tests).
- **Actual:** 30 tests across 5 test suites.

### Tier 3: Cross-Feature Interactions & Pairwise Workflows
- Tests emergent behaviors when multiple subsystems interact simultaneously (e.g., VIP priority routing combined with idle auto-close and CSAT survey, carrier delivery webhooks arriving while handling agents are on break).
- **Requirement:** Minimum 5 pairwise tests.
- **Actual:** 6 tests in `t3.1-cross-feature-interactions.test.ts`.

### Tier 4: Real-World Workload Scenarios
- End-to-end production workloads simulating real customer journeys, holiday flash sale surges, multi-BU orders, delivery exceptions, and supervisor workforce audits.
- **Requirement:** Minimum 5 workload scenarios.
- **Actual:** 5 scenarios in `t4.1-real-world-scenarios.test.ts`.

---

## 3. Requirement Traceability & Coverage Matrix

| Requirement | Description | Tier 1 Suite | Tier 2 Suite | Tier 3 & Tier 4 Interactions | Total Tests |
|---|---|---|---|---|---|
| **R1** | Automated Idle Chat Auto-Close & Warning System (50m warning, 60m auto-close, Zwiz sync, CSAT trigger) | `t1.1-idle-chat-auto-close.test.ts` (6) | `t2.1-idle-sweep-boundaries.test.ts` (6) | T3.1.1, T3.1.6, T4.1.2 | **15** |
| **R2** | End-to-End Delivery Tracking & LINE Notification Pipeline (Kerry/Flash/Central Express, status lifecycle, LINE notifications) | `t1.2-delivery-tracking-line.test.ts` (6) | `t2.2-delivery-tracking-boundaries.test.ts` (6) | T3.1.2, T3.1.4, T3.1.5, T4.1.1, T4.1.3, T4.1.5 | **17** |
| **R3** | Agent Shift, Break Timers & Auto-Online Reversion (LUNCH 60m, BREAK 15m, sweeper revert, adherence metrics) | `t1.3-agent-break-timers-reversion.test.ts` (6) | `t2.3-break-timers-boundaries.test.ts` (6) | T3.1.2, T3.1.3, T4.1.2, T4.1.4 | **16** |
| **R4** | Enterprise Operations Portal Link Hub & RBAC (AIPX, The 1 Portal, BU scoping, Admin/Supervisor CRUD, Agent read-only) | `t1.4-portal-link-hub-rbac.test.ts` (6) | `t2.4-portal-hub-boundaries.test.ts` (6) | T3.1.4, T4.1.3 | **14** |
| **R5** | NSC VIP Customer Tagging & Priority Queue Routing (isVip, priority=100, VIP agent pool, accelerated 5m SLA) | `t1.5-nsc-vip-priority-routing.test.ts` (6) | `t2.5-vip-routing-boundaries.test.ts` (6) | T3.1.1, T3.1.3, T3.1.5, T3.1.6, T4.1.1, T4.1.4 | **17** |
| **Total** | | **30 tests** | **30 tests** | **11 tests (T3+T4)** | **71 tests** |

---

## 4. Test Suite Inventory

### Tier 1: Feature Coverage (`tests/phase3/tier1-coverage/`)
1. `t1.1-idle-chat-auto-close.test.ts` (6 tests)
   - T1.1.1: Pre-closure warning message dispatched via Zwiz at 50m inactivity without closing case
   - T1.1.2: Automatic case closure at 60m setting status=CLOSED and closureReason=CUSTOMER_INACTIVE_AUTO_CLOSED
   - T1.1.3: Zwiz bot state synchronization on auto-closure to terminate customer session
   - T1.1.4: Automatic Qualtrics CSAT post-chat survey trigger upon auto-closure
   - T1.1.5: Dry-run evaluation mode returns candidate cases without state mutation or notifications
   - T1.1.6: Inbound customer reply resets inactivity timer and prevents auto-closure
2. `t1.2-delivery-tracking-line.test.ts` (6 tests)
   - T1.2.1: Carrier tracking webhook receiver accepts Kerry, Flash, and Central Express updates
   - T1.2.2: Status lifecycle progression: PACKED -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED
   - T1.2.3: Real-time customer LINE notification message dispatched on delivery milestone change
   - T1.2.4: Chronological ShippingTrackingEvent records persisted and queryable for sidebar timeline
   - T1.2.5: DELIVERY_FAILED status updates fulfillment and flags case for frontline follow-up
   - T1.2.6: Webhook HMAC signature verification (`X-Courier-Signature`)
3. `t1.3-agent-break-timers-reversion.test.ts` (6 tests)
   - T1.3.1: Frontline agent initiates BREAK (15m) or LUNCH (60m) establishing countdown
   - T1.3.2: Break sweeper automatically reverts expired breaks back to ONLINE
   - T1.3.3: Auto-reverted presence immediately restores agent eligibility in queue routing
   - T1.3.4: AgentBreakSession records isAutoReverted=true and accurate overrunSeconds
   - T1.3.5: Supervisor adherence and overrun tracking report aggregates workforce metrics
   - T1.3.6: Manual presence restoration before expiration records voluntary return with isAutoReverted=false
4. `t1.4-portal-link-hub-rbac.test.ts` (6 tests)
   - T1.4.1: Portal link directory listing supports filtering by Business Unit
   - T1.4.2: Administrator can create enterprise portal tools with complete metadata
   - T1.4.3: Supervisor can update/patch existing portal link properties
   - T1.4.4: RBAC: Frontline Agent mutation attempts (POST, PATCH, DELETE) return HTTP 403 Forbidden
   - T1.4.5: Administrator can archive / soft-delete portal links
   - T1.4.6: Portal links return sorted by display order sequence
5. `t1.5-nsc-vip-priority-routing.test.ts` (6 tests)
   - T1.5.1: Administrator or Digital Assistant can tag customer with NSC VIP status
   - T1.5.2: Inbound chat from VIP customer automatically flags case with isVip=true and queuePriority=100
   - T1.5.3: Priority queue routing dispatches VIP chat to senior VIP-eligible agent pool
   - T1.5.4: Dedicated VIP SLA timer activates accelerated 5-minute first response threshold
   - T1.5.5: Visual VIP badge metadata is included in case details and queue list representations
   - T1.5.6: Standard non-VIP customer defaults to normal priority (0) and 15-minute standard SLA

### Tier 2: Boundaries & Corners (`tests/phase3/tier2-boundaries/`)
6. `t2.1-idle-sweep-boundaries.test.ts` (6 tests)
   - T2.1.1: Inactivity at exactly 49m does not warn; 50m warns
   - T2.1.2: Inactivity at 59m stays open (warned); 60m auto-closes
   - T2.1.3: Duplicate sweeps between 50m and 59m send exactly one warning
   - T2.1.4: Already RESOLVED or CLOSED cases ignored by idle sweep
   - T2.1.5: Negative, zero, or inverted thresholds return HTTP 400 Bad Request
   - T2.1.6: Extreme inactivity age (> 10,000 minutes) handled without crash
7. `t2.2-delivery-tracking-boundaries.test.ts` (6 tests)
   - T2.2.1: Non-existent or unknown tracking number handled gracefully
   - T2.2.2: Unsupported carrier code returns HTTP 422 INVALID_CARRIER
   - T2.2.3: Forged or missing courier signature returns HTTP 401 or 403
   - T2.2.4: Out-of-order delivery events handled idempotently
   - T2.2.5: Missing optional payload fields handled with sane defaults
   - T2.2.6: Duplicate webhook replay processed idempotently without duplicate customer alerts
8. `t2.3-break-timers-boundaries.test.ts` (6 tests)
   - T2.3.1: Break threshold boundary: 14m does not revert; 15m auto-reverts
   - T2.3.2: Lunch threshold boundary: 59m does not revert; 60m auto-reverts
   - T2.3.3: OFFLINE agent attempting to enter BREAK returns HTTP 400 Bad Request
   - T2.3.4: Agent already on BREAK attempting second break returns 409 or handled idempotently
   - T2.3.5: Negative or invalid break duration returns HTTP 400 Bad Request
   - T2.3.6: Auto-revert with zero active chats restores full capacity headroom cleanly
9. `t2.4-portal-hub-boundaries.test.ts` (6 tests)
   - T2.4.1: Missing required fields (empty title or invalid URL) returns HTTP 400 Bad Request
   - T2.4.2: Mutation targeting non-existent link ID returns HTTP 404 Not Found
   - T2.4.3: Missing or unauthenticated user role header rejects mutations with 401 or 403
   - T2.4.4: Oversized URL or title (> 2,000 characters) returns 400 or 413 Payload Too Large
   - T2.4.5: Negative or colliding order indices normalize safely without crashing
   - T2.4.6: Portal link with empty businessUnits array is treated as universally available across all BUs
10. `t2.5-vip-routing-boundaries.test.ts` (6 tests)
    - T2.5.1: Tagging non-existent customer ID as VIP returns HTTP 404 Not Found
    - T2.5.2: Invalid or empty vipTier value returns HTTP 400 or 422 Unprocessable Entity
    - T2.5.3: VIP queue routing when all VIP agents are at max chat capacity safely queues case with priority retained
    - T2.5.4: Revoking VIP status resets priority and returns subsequent cases to normal queue priority
    - T2.5.5: Multiple VIP cases dispatched simultaneously to VIP agent pool respect max chat capacity without overflow
    - T2.5.6: Frontline agent attempting to tag customer as VIP returns HTTP 403 Forbidden

### Tier 3: Cross-Feature Interactions (`tests/phase3/tier3-combinations/`)
11. `t3.1-cross-feature-interactions.test.ts` (6 tests)
    - T3.1.1: VIP case undergoes idle warning (50m), auto-close (60m), bot state sync, and CSAT trigger (R5 + R1)
    - T3.1.2: Carrier delivery webhook dispatches LINE notification while handling agent is on BREAK (R2 + R3)
    - T3.1.3: Agent auto-reverted from BREAK to ONLINE immediately receives pending VIP high-priority queue chat (R3 + R5)
    - T3.1.4: Case handling agent accesses Portal Link Hub during delivery dispute (R4 + R2)
    - T3.1.5: Multi-BU VIP delivery tracking with post-delivery CSAT feedback loop and Customer 360 update (R2 + R5 + R1)
    - T3.1.6: Inactive VIP chat warning followed by customer reply resets idle state and preserves VIP priority (R1 + R5)

### Tier 4: Real-World Scenarios (`tests/phase3/tier4-scenarios/`)
12. `t4.1-real-world-scenarios.test.ts` (5 tests)
    - T4.1.1: Central Luxury NSC VIP Omnichannel Shopping & Delivery Lifecycle
    - T4.1.2: Peak Volume Idle Chat Cleanup & Workforce Presence Reversion
    - T4.1.3: Delivery Exception, Customer Escalation & Portal Link Logistics Lookup
    - T4.1.4: Supervisor Break Overrun Audit & Priority VIP Queue Rebalancing
    - T4.1.5: Omnichannel Multi-BU Delivery Tracking & Customer 360 Loyalty Loop

---

## 5. Database Reset & Test Isolation

Database isolation is maintained via `POST /api/test/reset` and `globalSupervisor.resetAll()`.

### Safe Foreign-Key Leaf-to-Root Reset Sequence
Prisma deletes records in strict dependency order to satisfy relational integrity constraints:
1. `ShippingTrackingEvent` (Phase 3 - references ShippingFulfillment)
2. `ShippingFulfillment` (Phase 2 - references Quotation)
3. `AgentBreakSession` (Phase 3 - references User)
4. `AgentShift` (Phase 3 - references User)
5. `PortalLink` (Phase 3 - standalone)
6. `Promotion` (Phase 2)
7. `CSATResponse` & `SurveyDispatch` (Phase 0 - references Case, Customer)
8. `Message` & `AuditLog` (Phase 0 - references Case, User)
9. `POSTicket` & `POSBatchUpload` (Phase 1 - references Quotation)
10. `PaymentTransaction` (Phase 1 - references Quotation)
11. `QuotationItem` & `Quotation` (Phase 1 - references Customer, Case)
12. `Case` (Phase 0 - references Customer, Queue, User)
13. `SessionTraffic` (Phase 0 - references Customer)
14. Non-system `Customer` records

---

## 6. Execution Commands

```bash
# 1. Run Phase 3 Test Suite (Stand-alone runner, boots all 5 mock services & Test CRM)
npm run test:phase3
# Equivalent direct command:
node --import tsx tests/run-phase3.ts

# 2. Run Full 4-Phase Regression Suite (Phases 0, 1, 2, and 3)
npm run test:all-phases
# Equivalent direct command:
node --import tsx tests/run-all-phases.ts

# 3. Run individual Phase suites
npm run test:phase1   # Phase 1
npm run test:phase2   # Phase 2
npm test              # Phase 0
```
