# Project: Enterprise Omnichannel Social Commerce CRM (Phase 3)

## Architecture
Omnichannel Social Commerce CRM built with Next.js 14 App Router, TypeScript, Prisma ORM, and PostgreSQL.
- **Data Layer**: Prisma ORM with PostgreSQL database (`prisma/schema.prisma`).
- **Backend API Layer**: Dual-server topology:
  - Next.js 14 App Router (`src/app/api/.../route.ts`) for web and production runtime.
  - Lightweight high-performance Test Server (`tests/runner/test-crm-server.ts`, port 3001) for E2E integration test suite.
  - Shared business service modules in `src/lib/` (cases, agents, shipping, zwiz, qualtrics, portal-links, quotations).
- **Mock Service Integrations** (running under `MockSupervisor`):
  - Mock Zwiz Bot Gateway (:4010) — Inbound chat webhooks, outbound customer dispatch, user bot state synchronization.
  - Mock Qualtrics CSAT (:4020) — Post-chat survey dispatch and response ingestion.
  - Mock Payment Gateway (:4030) — Credit card & Bank transfer webhook reconciliation.
  - Mock Courier Partner (:4040) — Carrier tracking webhooks (Kerry, Flash, Central Express) and signature verification.
- **Frontend UI Layer**: React 18 / Tailwind CSS client components:
  - Unified Chat Desk (`src/components/chat/`) with VIP badge and accelerated SLA display.
  - Case & Order Sidebar (`CaseDetailSidebar.tsx`) with Delivery timeline stepper and VIP controls.
  - Queue Filter Bar (`QueueFilterBar.tsx`) with VIP highlight and priority queue sorting.
  - Enterprise Operations Portal Hub (`HubSpotHeader.tsx`) with single-click enterprise tools launch and BU scoping.
  - Supervisor Workforce Dashboard with break countdown timers, overrun tracking, and adherence metrics.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Automated Idle Chat Warning (50m) | Sends exactly one pre-closure warning message to customer via Zwiz 10m prior to closure | M2 | ORIGINAL_REQUEST §R1 |
| 2 | Automated Idle Chat Auto-Close (60m) | Auto-closes inactive case after 60m, sets status=CLOSED, closureReason=CUSTOMER_INACTIVE_AUTO_CLOSED | M2 | ORIGINAL_REQUEST §R1 |
| 3 | Idle Chat State Sync & CSAT Trigger | On auto-close, notifies Zwiz to reset botState to ACTIVE and triggers Qualtrics CSAT survey | M2 | ORIGINAL_REQUEST §R1 |
| 4 | Carrier Tracking Webhook Receiver | POST /api/shipping/tracking/webhook ingests Kerry, Flash, Central Express status updates | M3 | ORIGINAL_REQUEST §R2 |
| 5 | Order Delivery Status Lifecycle | Lifecycle PACKED -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED -> DELIVERY_FAILED | M3 | ORIGINAL_REQUEST §R2 |
| 6 | LINE OA Real-time Delivery Notifications | Outbound LINE notification message via Zwiz on delivery milestones with tracking URL & metadata | M3 | ORIGINAL_REQUEST §R2 |
| 7 | Order Sidebar Delivery Timeline View | Interactive shipping timeline stepper in case/order sidebar showing chronological delivery milestones | M3 | ORIGINAL_REQUEST §R2 |
| 8 | Configurable Agent Shift Schedules | Shift management for frontline staff with standard shifts and break allocations | M4 | ORIGINAL_REQUEST §R3 |
| 9 | Agent Break Countdown Timers | Inactivity tracking during LUNCH (60m) and BREAK (15m) states | M4 | ORIGINAL_REQUEST §R3 |
| 10 | Automated Presence Reversion to ONLINE | Auto-transitions agent status back to ONLINE when break duration expires and resumes queue dispatch | M4 | ORIGINAL_REQUEST §R3 |
| 11 | Supervisor Break Overrun & Adherence | Dashboard tracking break duration, overruns, and shift adherence metrics | M4 | ORIGINAL_REQUEST §R3 |
| 12 | Enterprise Portal Link Hub Navigation | Frontline portal navigation bar with single-click launch for AIPX, The 1 Portal, Operation Portal, QR Portal | M4 | ORIGINAL_REQUEST §R4 |
| 13 | Configurable Portal Links with BU Scoping | Directory with icons, descriptions, target URLs, category, and BU filtering | M4 | ORIGINAL_REQUEST §R4 |
| 14 | Portal Hub RBAC Enforcement | Admin/Supervisor CRUD; Frontline Agent read-only; non-admin mutations return HTTP 403 Forbidden | M4 | ORIGINAL_REQUEST §R4 |
| 15 | NSC VIP Customer Tagging | VIP flag (isVip: true, vipTier: 'NSC_VIP') assignable by Admins and Digital Assistants | M2 | ORIGINAL_REQUEST §R5 |
| 16 | Visual VIP Badge & Priority Highlight | VIP visual badging and priority highlight across Unified Chat, Queue List, and Case Sidebar | M2 | ORIGINAL_REQUEST §R5 |
| 17 | Priority Queue Routing for VIPs | VIP chats bypass normal queue lines, route with top priority to senior DA / VIP agent pool | M2 | ORIGINAL_REQUEST §R5 |
| 18 | Dedicated VIP SLA Timers | Accelerated first-response threshold (e.g. 5m) for VIP customers | M2 | ORIGINAL_REQUEST §R5 |
| 19 | Database Foundation & Reset Alignment | Prisma schema additions (models/enums) and test database reset FK-safe cleanup | M0 | ORIGINAL_REQUEST §R5/R6 |
| 20 | Mock Courier Webhook Generator | Enhanced Courier Mock Server simulating milestone transitions (PACKED to DELIVERED) | M1 | ORIGINAL_REQUEST §R6 |
| 21 | Idle Chat & Break Auto-Reversion Sweeper Test | Programmatic verification for 60m idle closure and break auto-reversion schedulers | M1 | ORIGINAL_REQUEST §R6 |
| 22 | Phase 3 Comprehensive Test Runner | Automated Phase 3 E2E test runner executing against PostgreSQL verifying all R1-R5 requirements | M1 / M5 | ORIGINAL_REQUEST §R6 |
| 23 | Full 4-Phase Regression Suite | 100% pass rate across Phase 0, 1, 2, 3 with zero regressions and zero TypeScript errors | M5 | Acceptance Criteria |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Database Schema Foundation & Test Server Reset | Add Phase 3 Prisma models/enums, run db push, update test-crm-server.ts resetDatabase FK logic | none | DONE |
| M1 | E2E Testing Track & Opaque-Box Test Suite | Implement Phase 3 test cases across Tiers 1-4, Mock Courier enhancements, publish TEST_READY.md | M0 | DONE |
| M2 | Idle Chat Auto-Close (R1) & NSC VIP Routing (R5) | 50m warning, 60m auto-close, Zwiz sync, CSAT trigger, VIP tagging, priority routing, UI badges | M0 | DONE |
| M3 | End-to-End Delivery Tracking & LINE Notifications (R2) | Carrier webhook (Kerry/Flash/Central Express), LINE OA notifications via Zwiz, Sidebar timeline UI | M0 | DONE |
| M4 | Agent Shift, Break Timers (R3) & Portal Link Hub (R4) | Break timers, auto-reversion sweeper, supervisor dashboard, Portal link hub model/API/UI with RBAC | M0 | DONE |
| M5 | Final Acceptance, Regression & Coverage Hardening | Pass 100% Phase 3 E2E tests (Tiers 1-4), Tier 5 adversarial hardening, full Phase 0-3 regression | M1, M2, M3, M4 | DONE |

---

## Code Layout
- `prisma/schema.prisma` — Prisma ORM schema definition
- `src/app/api/` — Next.js 14 App Router backend endpoints:
  - `src/app/api/shipping/tracking/webhook/route.ts` (and alias `src/app/api/webhooks/shipping/route.ts`)
  - `src/app/api/cases/idle-sweep/route.ts`
  - `src/app/api/agents/break-sweep/route.ts`
  - `src/app/api/agents/adherence/route.ts`
  - `src/app/api/portal-links/route.ts` & `src/app/api/portal-links/[id]/route.ts`
  - `src/app/api/customers/[id]/vip/route.ts`
- `src/lib/` — Business domain service logic:
  - `src/lib/cases/idle-sweep.ts`
  - `src/lib/cases/sla.ts`
  - `src/lib/shipping/tracking-service.ts`
  - `src/lib/agents/presence.ts` & `src/lib/agents/break-sweep.ts`
  - `src/lib/agents/queue-routing.ts`
  - `src/lib/portal-links/service.ts`
  - `src/lib/zwiz/client.ts` & `src/lib/zwiz/notifications.ts`
- `src/components/` — React frontend UI components:
  - `src/components/chat/ChatWindow.tsx` & `MessageList.tsx`
  - `src/components/chat/CaseDetailSidebar.tsx`
  - `src/components/chat/QueueFilterBar.tsx`
  - `src/components/HubSpotHeader.tsx`
  - `src/components/supervisor/SupervisorDashboard.tsx`
- `tests/` — Automated test suites & harnesses:
  - `tests/runner/test-crm-server.ts`
  - `tests/mocks/courier-mock-server.ts`
  - `tests/phase3/` (or `tests/suites/phase3-*.test.ts`)
  - `tests/run-phase3.ts`
  - `tests/run-all-phases.ts`

---

## Interface Contracts

### 1. Carrier Webhook: Courier Partner -> CRM
- **Endpoint**: `POST /api/shipping/tracking/webhook` (and `POST /api/webhooks/shipping`)
- **Headers**: `X-Carrier-Code`: `KERRY` | `FLASH` | `CENTRAL_EXPRESS`, `X-Courier-Signature`: `sha256=...`
- **Payload**:
  ```json
  {
    "trackingNumber": "KRY-8839201",
    "orderId": "ord_...",
    "carrier": "KERRY",
    "status": "PACKED" | "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "DELIVERY_FAILED",
    "timestamp": "2026-09-13T10:00:00Z",
    "location": "BKK Sort Facility",
    "description": "Package sorted and assigned to courier",
    "estimatedDelivery": "2026-09-14T17:00:00Z"
  }
  ```
- **Response**: `{ "success": true, "eventId": "evt_...", "status": "..." }`

### 2. Idle Chat Sweep: Scheduler -> CRM
- **Endpoint**: `POST /api/cases/idle-sweep`
- **Payload**: `{ "idleWarningThresholdMinutes": 50, "idleCloseThresholdMinutes": 60, "dryRun": false }`
- **Actions**:
  - Cases inactive >= 50m without warning -> send 1 warning message via Zwiz, set `idleWarningSentAt = now()`
  - Cases inactive >= 60m -> set `status = CLOSED`, `closureReason = CUSTOMER_INACTIVE_AUTO_CLOSED`, reset Zwiz bot state, dispatch CSAT survey
- **Response**: `{ "scanned": 15, "warned": 2, "closed": 1, "caseIdsClosed": ["case_..."] }`

### 3. Agent Break Sweep: Scheduler -> CRM
- **Endpoint**: `POST /api/agents/break-sweep`
- **Payload**: `{ "dryRun": false }`
- **Actions**:
  - For agents in `LUNCH` or `BREAK` where `now() >= breakExpectedEndAt`:
    - Revert status to `ONLINE`
    - Record audit log `PRESENCE_AUTO_REVERTED`
    - Close active `AgentBreakSession` with `isAutoReverted = true`, calculate `overrunSeconds`
    - Resume queue dispatch eligibility
- **Response**: `{ "scanned": 12, "reverted": 3, "agentIdsReverted": ["usr_..."] }`

### 4. Portal Links CRUD & RBAC
- **Endpoints**:
  - `GET /api/portal-links?bu=CENTRAL` (All authenticated roles)
  - `POST /api/portal-links` (Admin & Supervisor only; Agent returns 403 Forbidden)
  - `PATCH /api/portal-links/:id` (Admin & Supervisor only; Agent returns 403 Forbidden)
  - `DELETE /api/portal-links/:id` (Admin & Supervisor only; Agent returns 403 Forbidden)
- **Schema**:
  ```json
  {
    "title": "AIPX",
    "description": "AI Product Experience & Catalog",
    "url": "https://aipx.central.co.th",
    "icon": "sparkles",
    "category": "CATALOG",
    "businessUnits": ["CENTRAL", "ROBINSON"],
    "order": 1,
    "isActive": true
  }
  ```

### 5. VIP Tagging & Priority Routing
- **Endpoint**: `POST /api/customers/:id/vip`
- **Payload**: `{ "isVip": true, "vipTier": "NSC_VIP", "reason": "High net worth tier" }`
- **Queue Routing Rule**:
  - If `case.isVip === true` or `customer.isVip === true`:
    - Case assigned priority weight (e.g. `queuePriority = 100`) to jump to the head of the queue.
    - Routed exclusively or prioritized to agents with `isVipEligible === true` or `role IN ('SUPERVISOR', 'ADMIN')`.
    - SLA first response threshold set to 5 minutes (vs standard 15 minutes).
