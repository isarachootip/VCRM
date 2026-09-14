# Original User Request

## 2026-09-12T14:35:25Z

Develop Phase 0 of an enterprise Omnichannel Social Commerce CRM (Central Chat & Shop / E-Ordering ecosystem), establishing the bidirectional Zwiz.AI Bot Gateway, Opportunity/Case management, multi-format messaging, Qualtrics CSAT trigger, and a scalable database architecture supporting future E-ordering, Payment, and POS reconciliation phases.

Working directory: c:\atgv\crm_monday
Integrity mode: development

## Requirements

### R1. Bidirectional Bot Gateway & User State Synchronization (Zwiz.AI, LINE, FB, IG)
- Provide bidirectional webhook and API communication with the Zwiz.AI chatbot gateway:
  - Inbound webhook endpoint to receive inbound chat events from LINE OA, Facebook Messenger, and Instagram pages.
  - Automatically open an Opportunity/Case assigned to the designated queue, matching the incoming Business Unit (BU) and Channel/Page metadata (P0).
  - Outbound message dispatcher to push messages from agents back through Zwiz to the customer.
  - User State synchronization: When an agent closes an Opportunity/Case, automatically notify Zwiz via webhook to reset/update the customer's bot state and terminate the session (P0).
  - Session traffic tracking: Stamp inbound session metadata (Start/End DateTime, Inbound Channel, Inbound Source) and link Session ID to the Opportunity (P2).

### R2. Multi-Format Messaging & Internal Collaboration
- Support rich messaging formats across all channels (P0, P1):
  - Inbound and outbound transmission of plain text, images, files/documents, and video content.
  - Clipboard image paste functionality directly in the chat composer for rapid screenshot sharing.
  - Internal whisper/private notes inside the chat thread visible exclusively to internal staff and hidden from customer-facing channels.

### R3. Opportunity / Case Management & Multi-BU Scoping
- Implement the core Opportunity/Case tracking entity containing all required business metadata (P0):
  - Business Unit (BU), Channel (LINE/FB/IG), Page (e.g., Central, Central Beauty Club), and Case Owner.
  - Opportunity status transitions: `Open` -> `In Progress` -> `Resolved` -> `Closed`.
  - Filterable by queue and BU with audit history logging.

### R4. Automated Customer Satisfaction Survey (Qualtrics Integration)
- Implement an automated CSAT survey trigger (P0):
  - Upon Opportunity/Case closure, automatically trigger a post-chat survey dispatch configured per Queue and BU.
  - Record survey dispatch status and capture incoming CSAT response scores in the reporting database.

### R5. Extensible Schema Foundation for Phases 1–3
- Design and migrate the relational database schema to support the complete 42-feature CRM roadmap:
  - Entities for Quotation & Order management (`Draft`, `Pending Payment` with 24h expiration, `Paid`, `Printed` lock, `Void`, `Cancel`).
  - Entities for Payment status reconciliation (Credit card, Bank Transfer, Muji/SSP/B2S BUs).
  - Entities for POS Ticket reconciliation (Single entry, batch upload, status reconcile).
  - Entities for Agent team routing, queue configuration, presence status (`Online`, `Offline`, `Lunch`, `Break`), and max chat capacity.

### R6. Programmatic Mock Integration Sandbox & Verification Suite
- Provide executable mock servers and test suites simulating:
  - Zwiz.AI webhook dispatcher (inbound customer messages and outbound delivery confirmations).
  - Zwiz state update receiver (verifying state updates when cases are closed).
  - Qualtrics CSAT survey webhook receiver and response simulator.
  - Automated integration test suite validating end-to-end event flows without requiring external live credentials.

## Acceptance Criteria

### Bot Gateway & State Sync
- [ ] Inbound webhook test script successfully ingests simulated LINE, FB, and IG payloads from Zwiz and creates matching Opportunities with accurate BU, Channel, Page, and Session ID metadata.
- [ ] Closing an Opportunity dispatches a state update payload to the Zwiz mock endpoint and logs successful delivery.
- [ ] Agent responses in the chat interface correctly trigger outbound API payloads to Zwiz.

### Messaging & Notes
- [ ] Messages with text, image URL, file attachment, and video metadata render correctly in the Unified Chat view.
- [ ] Internal notes can be submitted and are tagged with an internal flag, excluded from customer outbound dispatch payloads.

### CSAT & Survey Dispatch
- [ ] Case closure event triggers a survey dispatch event payload directed to the configured Qualtrics endpoint with queue and ticket parameters.
- [ ] CSAT response simulator successfully updates the case record with survey scores and timestamps.

### Database Architecture & Verification
- [ ] Prisma schema includes all models for Cases, Messages, Quotations, POS Tickets, Agent Profiles, and Queues with active foreign key constraints.
- [ ] Database migrations execute cleanly without errors.
- [ ] Automated end-to-end integration test runner runs and passes 100% of test cases.

## 2026-09-12T19:22:22Z

Develop Phase 1 of the enterprise Omnichannel Social Commerce CRM (Central Chat & Shop / E-Ordering ecosystem), establishing the E-Ordering Quotation Lifecycle Engine, Multi-BU Payment & POS Ticket Reconciliation, Cross-Team Chat Transfer (CS ↔ COL ↔ Chat&Shop), and Real-time Operational Dashboard & Reporting.

Working directory: c:\atgv\crm_monday
Integrity mode: development

## Requirements

### R1. E-Ordering & Quotation Lifecycle Engine
- Implement an end-to-end Quotation management system for sales agents (Items 22, 23):
  - Fast-create quotations linked to customer accounts and The 1 loyalty member lookup.
  - Strict quotation state machine: `DRAFT` -> `PENDING_PAYMENT` -> `PAID` -> `PRINTED` -> `COMPLETED`, with alternate terminal states `VOID`, `CANCEL`, and `EXPIRED`.
  - Single-print fraud prevention: Quotations in `PRINTED` state cannot be printed a second time; print actions must be locked and timestamped in the audit log.
  - 24-hour auto-expiration: Quotations remaining in `PENDING_PAYMENT` for more than 24 hours automatically transition to `EXPIRED`.

### R2. Automated Multi-BU Payment Gateway & Webhook Reconciliation
- Implement automated payment confirmation webhooks (Items 24, 25):
  - Receive automated payment callbacks for Credit Card and Bank Transfer / PromptPay.
  - Automatically update quotation status to `PAID` upon verified payment confirmation.
  - Support multi-BU payment routing and account segregation for Central, Muji (1st Priority), SSP, and B2S.

### R3. POS Ticket Reconciliation (Single Entry & Batch Upload)
- Implement Store POS reconciliation to verify in-store cash register ring-ups (Item 29):
  - Single POS ticket number entry per quotation/order.
  - Batch upload endpoint and UI supporting CSV/JSON uploads containing store branch, POS machine ID, ticket number, and amount.
  - Automatic reconciliation matching: verify POS tickets against existing orders and update reconciliation status (`RECONCILED` vs. `DISCREPANCY`).

### R4. Cross-Team Chat Transfer, Multi-Search & Template Messaging
- Enhance the Unified Chat Desk with enterprise collaboration tools (Items 5, 6, 11, 13, 14, 15):
  - Cross-team chat transfer between CS, COL, and Chat & Shop: close existing chat, open new linked session with context summary, while isolating agent handling time and productivity metrics per team.
  - Manual outbound chat initiation to reach customers via Zwiz API.
  - Multi-criteria Opportunity search: search by Customer Name, Opp No, Phone, LINE ID, Tracking No, or custom keywords.
  - Template message manager with live WYSIWYG preview and pre-send editing.
  - Field-level audit trail: record all field modifications and ownership transfers with role-based visibility restrictions (protecting COL/CS case confidentiality).

### R5. Real-Time Operational Dashboard, Reports & Agent Queue Management
- Provide business intelligence and supervisor control tools (Items 30, 31, 33, 34, 36):
  - Real-time streaming operational dashboard (live updates without manual refresh) displaying active queues, agent statuses, pending payments, and daily sales conversion volume.
  - Comprehensive reporting engine with date range filtering, BU/queue bucketing, and CSV/Excel export.
  - Agent presence management (Online, Offline, Lunch, Break) and team queue routing (Chat & Shop, EOR, Social Media, CS, COL).

### R6. Verification Test Suite & Mock Payment/POS Sandbox
- Expand the programmatic mock environment and test harness:
  - Mock Payment Gateway simulating credit card and bank transfer webhooks across BUs.
  - Mock POS terminal event generator and batch CSV fixtures.
  - Automated E2E integration test runner validating all Phase 1 state transitions and API endpoints.

## Acceptance Criteria

### Quotation Lifecycle & Fraud Guardrails
- [ ] Quotation can be created with items, total amount, and linked The 1 customer profile.
- [ ] Transitioning quotation to `PRINTED` locks further print actions; subsequent print requests return HTTP 403 / conflict error.
- [ ] Quotations pending payment past 24 hours automatically expire via schedule or reconciliation sweep.

### Payment & POS Reconciliation
- [ ] Simulated payment webhook payload for Credit Card or PromptPay successfully updates quotation to `PAID` and triggers customer confirmation message.
- [ ] Single POS ticket entry correctly binds to order and flags `RECONCILED`.
- [ ] Batch upload of POS tickets parses file, reconciles matched orders in bulk, and reports unmatched tickets as discrepancies.

### Chat Transfer & Collaboration
- [ ] Chat transfer from Chat & Shop to CS/COL creates a linked destination session, marks the original session transferred, and starts a fresh productivity timer for the receiving agent.
- [ ] Multi-criteria search query returns matching Opportunity records across customer name, phone, LINE account, and ticket number.
- [ ] Template messages can be previewed, edited, and dispatched through the Zwiz mock gateway.

### Real-Time Dashboard & Verification
- [ ] Real-time dashboard renders live metrics without requiring browser refresh upon new case creation or payment events.
- [ ] Comprehensive E2E test runner executes all Phase 1 test suites against PostgreSQL and passes 100%.

## 2026-09-12T23:08:46Z

Develop Phase 2 of the enterprise Omnichannel Social Commerce CRM (Central Chat & Shop / E-Ordering ecosystem), focusing on Operational Efficiency & Analytics: Team-Specific Workspaces & Field Masking (Chat&Shop vs EOR), Advanced Routing (Most Available vs Least Active), SLA & Pending Alerts, Interactive Zwiz Templates, Automated Payment Chat Notifications, Shipping Label Generation, Customer 360 & Behavioral Analytics, and Promotion Management.

Working directory: c:\atgv\crm_monday
Integrity mode: development

## Requirements

### R1. Team-Specific Workspace Views & Field Masking (Items 9, 10)
- Implement specialized team workspace screens and queue segregation:
  - Separate dedicated UI desk views for Chat & Shop, E-Ordering (EOR), and Social Media teams.
  - Specialized E-Ordering (EOR) tab with extensible fields: Ticket Number, Selling Store Name, Selling Store Staff ID, and custom metadata fields.
  - Role-based field masking: Agents only see and edit fields relevant to their team/queue, ensuring data privacy across departments.

### R2. Advanced Queue Routing Engine & SLA Notification System (Items 19, 32, 35)
- Dynamic chat distribution algorithm configurable per team/queue:
  - `LEAST_ACTIVE`: Assign to the agent with the lowest number of currently active chats.
  - `MOST_AVAILABLE`: Assign to the agent with the highest remaining capacity headroom relative to their individual or team Max Chat limit.
  - Enforce strict Maximum Chat Capacity per agent.
- SLA Monitoring & Notification Triggers:
  - Customer inactivity "Pending Flags" triggered at 15 and 30 minutes of customer silence.
  - Agent response waiting time alerts (exceeding configurable threshold of xx minutes).
  - Configurable reminder notifications for unpaid quotations and shipping follow-up.

### R3. Interactive Zwiz Templates & Automated Payment Chat Notifications (Items 2, 26)
- Send and receive rich interactive Zwiz bot templates (Button cards, Quick Replies, and Carousels) via Zwiz API.
- Event-driven automated chat notification pipeline for quotation lifecycle:
  - Quotation created -> Automatically dispatch chat message with secure payment link.
  - Payment pending -> Automated reminder message.
  - Payment received -> Automated confirmation message with order summary.
  - Quotation expired -> Automated notification that payment link has expired.

### R4. Automated Shipping Label Generation & Courier Tracking (Item 27)
- Automated shipping fulfillment integration:
  - Generate printable shipping labels pulling verified customer shipping address, order weight/items, and order number.
  - Automated tracking number generation/assignment (mock carrier API for Kerry, Flash, Central Express).
  - Printable label view (standard A4 and 4x6 thermal format) linked directly to `PAID` / `PRINTED` orders.

### R5. Customer 360 Profile & Behavioral Analytics (Items 38, 39)
- Customer 360 view inside the chat sidebar:
  - Consolidated profile with multi-channel identity linking (LINE ID, FB User ID, IG handle, Phone).
  - Omnichannel order history and lifetime value (LTV) calculation.
  - Behavioral analytics indicators: purchase frequency, preferred communication channels, average order value (AOV), and customer engagement score.

### R6. Promotion Management Hub & RBAC (Item 40)
- Integrated Promotion Tab for frontline agents:
  - Centralized catalog of active promotional campaigns, discount codes, banner images, and campaign validity dates.
  - Role-based access control (RBAC): only Admins and Supervisors can create/update/archive promotions; frontline agents have read-only access.
  - Quick-share promotion card/link directly into the active chat composer.

### R7. Verification Test Suite & Mock Courier/Template Sandbox
- Comprehensive automated verification harness:
  - Mock Courier Logistics server generating tracking numbers and shipping labels.
  - Mock Zwiz Template dispatcher validating rich interactive card payloads.
  - Automated Phase 2 E2E test runner executing against PostgreSQL verifying all R1–R6 requirements.

## Acceptance Criteria

### Team Views & Field Masking
- [ ] EOR workspace renders dedicated fields (Ticket Number, Selling Store Name, Staff ID) that are masked or read-only for non-EOR staff.
- [ ] Queue filter successfully separates opportunities between Chat & Shop, E-Ordering, and Social Media queues.

### Routing & SLA Alerts
- [ ] Inbound chats distribute according to the selected mode (`MOST_AVAILABLE` vs `LEAST_ACTIVE`) and respect individual Max Chat limits.
- [ ] Inactive chats trigger a 15-minute and 30-minute pending flag with visual indicators and supervisor notifications.

### Payment Notifications & Rich Templates
- [ ] Quotation status changes (Created, Paid, Expired) automatically trigger the corresponding message payload dispatched to the customer via Zwiz mock.
- [ ] Interactive template messages with buttons and quick replies render correctly in the chat UI and transmit to Zwiz.

### Shipping & Customer 360
- [ ] Paid order triggers shipping label generation with valid tracking number and formatted printable label.
- [ ] Customer 360 sidebar correctly calculates and displays customer purchase history, total spend (LTV), and channel engagement metrics.
- [ ] Promotion tab enforces RBAC: frontline agent mutation attempts return HTTP 403; read access succeeds.

### Testing & Regression
- [ ] Complete Phase 2 test suite executes and passes 100% against PostgreSQL.
- [ ] Phase 0 and Phase 1 regression test suites continue to pass 100% with zero regressions.

## 2026-09-13T03:37:59Z

Develop Phase 3 of the enterprise Omnichannel Social Commerce CRM (Central Chat & Shop / E-Ordering ecosystem), completing the final milestone of the 42-feature roadmap: Automated Idle Chat Auto-Close (with pre-closure warning), End-to-End LINE Delivery Tracking Notifications, Agent Working Time & Auto-Revert Break Management, Enterprise Operations Portal Link Hub (with RBAC), and NSC VIP Tagging with Priority Routing.

Working directory: c:\atgv\crm_monday
Integrity mode: development

## Requirements

### R1. Automated Idle Chat Auto-Close & Warning System (Item 18)
- Implement an automated cleanup and closure engine for unresponsive customer sessions:
  - Configurable idle threshold (default: 60 minutes of customer inactivity).
  - Pre-closure notification: Automatically send exactly one warning message to the customer (via Zwiz bot) e.g., 10 minutes prior to closure.
  - Automatic Opportunity/Case closure if no reply is received by the expiration window, updating status to `CLOSED` with closure reason `CUSTOMER_INACTIVE_AUTO_CLOSED`.
  - Automatic dispatch of state update to Zwiz and CSAT survey trigger upon auto-closure.

### R2. End-to-End Delivery Tracking & LINE Notification Pipeline (Item 28)
- Automated order fulfillment tracking and customer communication:
  - Order delivery status lifecycle: `PACKED` -> `PICKED_UP` -> `IN_TRANSIT` -> `OUT_FOR_DELIVERY` -> `DELIVERED` -> `DELIVERY_FAILED`.
  - Automated carrier webhook receiver (`POST /api/shipping/tracking/webhook`) ingesting status updates from courier partners (Kerry, Flash, Central Express).
  - Real-time customer notification dispatch through LINE OA (via Zwiz gateway) on major milestone changes with tracking URL and carrier metadata.
  - Delivery management view in the order/case sidebar displaying real-time shipping events timeline.

### R3. Agent Shift, Break Timers & Auto-Online Reversion (Item 37)
- Workforce time management and automatic presence restoration:
  - Configurable shift schedules and break durations (Lunch: default 60 min, Short Break: default 15 min).
  - Break countdown timer tracking agent inactivity during `LUNCH` and `BREAK` states.
  - Automated presence reversion: When the break duration expires, the system automatically transitions the agent status back to `ONLINE` and resumes queue dispatch.
  - Supervisor dashboard tracking break overruns and shift adherence metrics.

### R4. Enterprise Operations Portal Link Hub & RBAC (Item 41)
- Centralized portal tools navigation bar for frontline agents:
  - Direct single-click access to internal enterprise tools: AIPX, The 1 Portal, Operation Portal, QR Portal, and custom enterprise links.
  - Configurable portal link directory with icons, descriptions, target URLs, and BU scoping.
  - Role-based access control (RBAC): Only Admins and Supervisors can create, edit, or remove portal links; frontline agents have read-only access with single-click launch.

### R5. NSC VIP Customer Tagging & Priority Queue Routing (Item 42)
- High-touch VIP customer service workflows:
  - VIP flag (`isVip: true`, `vipTier: 'NSC_VIP'`) assignable to high-net-worth customers by Admins and Digital Assistants (DA).
  - Visual VIP badge and priority highlight across Unified Chat, Queue List, and Case Sidebar.
  - Priority queue routing: Inbound VIP chats automatically bypass normal queue lines and are dispatched with top priority to designated senior DA / VIP agent pools.
  - Dedicated VIP SLA timers (e.g. accelerated first-response threshold).

### R6. Verification Test Suite & Mock Carrier Tracking Sandbox
- Comprehensive verification suite covering Phase 3:
  - Mock Courier tracking webhook generator simulating delivery milestones (`PACKED` to `DELIVERED`).
  - Automated scheduler / sweep verification for 60-minute idle chat auto-closure and break auto-reversion.
  - Automated Phase 3 E2E test runner executing against PostgreSQL verifying all R1–R5 requirements with zero regressions across Phases 0, 1, and 2.

## Acceptance Criteria

### Idle Chat Auto-Close
- [ ] Inactive chat exceeding warning threshold receives pre-closure warning message via Zwiz mock without closing the case.
- [ ] Inactive chat reaching 60 minutes without customer response closes automatically, logs `CUSTOMER_INACTIVE_AUTO_CLOSED`, notifies Zwiz, and triggers CSAT survey.

### LINE Delivery Tracking
- [ ] Inbound courier tracking webhook transitions order shipping status and dispatches automated LINE notification message to customer with tracking link.
- [ ] Order sidebar displays sequential delivery milestone timeline.

### Agent Time Management
- [ ] Agent placing status into `BREAK` (15m) or `LUNCH` (60m) automatically reverts to `ONLINE` upon expiration of the timer and becomes eligible for queue routing.
- [ ] Supervisor report captures break duration and identifies overrun instances.

### Portal Hub & VIP Priority
- [ ] Portal links directory renders tools (AIPX, The 1 Portal, etc.); non-admin modification attempts return HTTP 403 Forbidden.
- [ ] Case flagged as NSC VIP receives priority queue placement ahead of normal cases and routes to VIP-eligible agents.

### Regression & Verification
- [ ] Complete Phase 3 test suite executes and passes 100% against PostgreSQL.
- [ ] Full regression suite (Phase 0, Phase 1, Phase 2, Phase 3) executes with 100% pass rate and zero TypeScript compilation errors.

## 2026-09-13T10:18:05Z

แก้ไขปัญหา SSL certificate (Untrusted Root) และ 503 Service Unavailable บนเซิร์ฟเวอร์ `https://vcrmx.online` ที่รัน Coolify บน VPS เพื่อให้ LINE Messaging API Webhook Verify ผ่านได้สำเร็จ

Working directory: c:\atgv\crm_monday
Integrity mode: development

## ข้อมูลปัจจุบัน

- **โดเมน:** `vcrmx.online` → IP `187.77.147.16`
- **Platform:** Coolify (self-hosted PaaS) บน VPS Linux — ใช้ Traefik เป็น Reverse Proxy
- **DNS:** ไม่ทราบผู้ให้บริการ (ให้ตรวจสอบ)
- **ปัญหา SSL:** `SEC_E_UNTRUSTED_ROOT` — Certificate ยังไม่ได้รับการ Provision จาก Let's Encrypt หรือเป็น self-signed
- **ปัญหา Server:** HTTP `503 Service Unavailable` — Container ของ VCRM App อาจยังไม่ Running หรือ Traefik ยังไม่ Route ได้ถูกต้อง
- **เป้าหมาย:** `POST https://vcrmx.online/api/webhooks/line` ต้องตอบกลับ `HTTP 200` จาก LINE Developers Console เมื่อกด Verify

## Requirements

### R1. วิเคราะห์สาเหตุ SSL และ 503 บน Coolify/VPS
ตรวจสอบสถานะของ Traefik SSL provisioning บน Coolify ว่า Let's Encrypt certificate ถูก issue หรือยัง และหาสาเหตุที่ทำให้ได้รับ 503 (Container ไม่ Running / Port ผิด / Domain config ใน Coolify ไม่ถูกต้อง)

### R2. แก้ไข SSL Certificate ให้ผ่านการตรวจสอบสากล
Certificate ของ `vcrmx.online` ต้องออกโดย CA ที่ LINE และ Browser ยอมรับ (Let's Encrypt / ZeroSSL ผ่าน Traefik บน Coolify หรือวิธีอื่นที่เหมาะสม) ไม่ใช่ self-signed

### R3. แก้ไขให้ VCRM App ตอบสนองได้ปกติ
`https://vcrmx.online/api/webhooks/line` ต้องตอบกลับ HTTP 200 OK เมื่อถูก POST จาก LINE (ไม่ 503) ด้วยการตรวจสอบและแก้ไข Coolify deployment config, container health, และ Traefik routing

### R4. สร้างคู่มือขั้นตอนแก้ไขฉบับสมบูรณ์
หากไม่สามารถแก้ไข VPS โดยตรงได้ ให้จัดทำขั้นตอนวิธีแก้ไขที่ชัดเจน (step-by-step) สำหรับผู้ใช้ที่มี Coolify Dashboard Access เพื่อดำเนินการเองได้ทันที

## Acceptance Criteria

### SSL
- [ ] `curl.exe https://vcrmx.online` ไม่แสดง error `SEC_E_UNTRUSTED_ROOT` หรือ `SSL certificate problem`
- [ ] Certificate issuer ต้องไม่ใช่ self-signed (แสดง Let's Encrypt, ZeroSSL หรือ CA อื่นที่ LINE รองรับ)

### Server Availability
- [ ] `POST https://vcrmx.online/api/webhooks/line` ตอบกลับ HTTP 200 หรือ 401 (ไม่ใช่ 503)
- [ ] Container ของ VCRM App อยู่ในสถานะ Running / Healthy บน Coolify

### LINE Webhook Verify
- [ ] กดปุ่ม Verify บน LINE Developers Console → ขึ้นข้อความ `Success` (ไม่ Error)

### คู่มือ (fallback)
- [ ] มีขั้นตอนวิธีแก้ไขที่ชัดเจนหากต้องทำผ่าน Coolify Dashboard และ VPS SSH โดยตรง
