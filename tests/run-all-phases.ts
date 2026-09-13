import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalSupervisor } from './runner/supervisor';
import { PaymentMockServer } from './mocks/payment-mock-server';
import { CourierMockServer } from './mocks/courier-mock-server';
import { waitFor } from './runner/wait-for';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const allPhasesTestFiles = [
  // ========================================================
  // Phase 0: Bot Gateway, Case Mgmt, Messaging & CSAT
  // ========================================================
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.1-inbound-webhook.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.2-outbound-messaging.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.3-bot-state-sync.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.4-multi-format-paste.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.5-whisper-notes.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.6-case-management.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.7-qualtrics-trigger.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.8-csat-ingestion.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.9-extensible-schema.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.1-empty-null-inputs.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.2-invalid-malformed.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.3-max-length-oversized.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.4-concurrency-races.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.5-duplicate-replays.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.6-state-violations.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.7-network-outages.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.1-omnichannel-lifecycle.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.2-cross-bu-escalation.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.3-capacity-clipboard.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.4-partial-failure-recovery.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.5-out-of-order-events.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.1-central-luxury-vip-line.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.2-beauty-club-fb.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.3-muji-furniture-ig.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.4-supersports-transfer.test.ts'),

  // ========================================================
  // Phase 1: Quotations, Payment, POS, Chat Transfer, Dashboard
  // ========================================================
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.10-quotations-engine.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.11-payment-gateways.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.12-pos-reconciliation.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.13-chat-transfer.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.14-multi-criteria-search.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.15-template-manager.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.16-dashboard-streaming.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.17-supervisor-reports.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.8-phase1-boundaries.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.6-phase1-workflows.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.5-phase1-e2e-scenarios.test.ts'),

  // ========================================================
  // Phase 2: Workspaces, Routing, SLA, Shipping Labels, Customer 360, Promotions
  // ========================================================
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.18-team-workspaces-field-masking.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.19-advanced-routing-sla-alerts.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.20-interactive-templates-payment-notifications.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.21-shipping-label-courier-tracking.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.22-customer-360-analytics.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.23-promotion-management-rbac.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.9-phase2-boundaries.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.7-phase2-workflows.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.6-phase2-e2e-scenarios.test.ts'),

  // ========================================================
  // Phase 3: Idle Chat Auto-Close, Delivery Webhooks, Break Timers, Portal Hub, VIP Routing
  // ========================================================
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.1-idle-chat-auto-close.test.ts'),
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.2-delivery-tracking-line.test.ts'),
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.3-agent-break-timers-reversion.test.ts'),
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.4-portal-link-hub-rbac.test.ts'),
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.5-nsc-vip-priority-routing.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.1-idle-sweep-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.2-delivery-tracking-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.3-break-timers-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.4-portal-hub-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.5-vip-routing-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier3-combinations/t3.1-cross-feature-interactions.test.ts'),
  path.resolve(__dirname, 'phase3/tier4-scenarios/t4.1-real-world-scenarios.test.ts'),
];

async function main() {
  console.log('=================================================================');
  console.log('  OMNICHANNEL SOCIAL COMMERCE CRM - 4-PHASE FULL REGRESSION RUNNER');
  console.log('=================================================================');
  console.log(`[Runner] Discovered ${allPhasesTestFiles.length} total test suites across Phases 0, 1, 2, and 3.`);
  console.log('[Runner] Bootstrapping Complete 5-Service Mock Sandbox & Test CRM...');

  let courierServer: CourierMockServer | null = null;
  let paymentServer: PaymentMockServer | null = null;

  try {
    // 1. Core supervisor (Zwiz :4010, Qualtrics :4020, CRM :3001)
    await globalSupervisor.startAll();

    // 2. Payment Mock Server (:4030)
    try {
      const check = await fetch('http://127.0.0.1:4030/health');
      if (!check.ok) throw new Error();
    } catch {
      paymentServer = new PaymentMockServer(4030);
      await paymentServer.start();
      await waitFor(async () => {
        try {
          const res = await fetch('http://127.0.0.1:4030/health');
          return res.ok;
        } catch {
          return false;
        }
      }, { description: 'Mock Payment health on port 4030', timeoutMs: 3000 });
    }

    // 3. Courier Mock Server (:4040)
    try {
      const check = await fetch('http://127.0.0.1:4040/health');
      if (!check.ok) throw new Error();
    } catch {
      courierServer = new CourierMockServer(4040);
      await courierServer.start();
      await waitFor(async () => {
        try {
          const res = await fetch('http://127.0.0.1:4040/health');
          return res.ok;
        } catch {
          return false;
        }
      }, { description: 'Mock Courier health on port 4040', timeoutMs: 3000 });
    }

    console.log('[Runner] All 5 services operational: Zwiz (:4010), Qualtrics (:4020), Payment (:4030), Courier (:4040), CRM (:3001).');
    console.log('[Runner] Beginning full regression execution...\n');

    const testStream = run({
      files: allPhasesTestFiles,
      concurrency: 1,
    });

    testStream.compose(spec as any).pipe(process.stdout);

    let hasFailures = false;
    let passedCount = 0;
    let failedCount = 0;

    testStream.on('test:pass', () => {
      passedCount++;
    });

    testStream.on('test:fail', () => {
      hasFailures = true;
      failedCount++;
    });

    await new Promise((resolve) => {
      testStream.on('end', resolve);
    });

    console.log('\n=================================================================');
    console.log(`  FULL REGRESSION SUMMARY: Passed: ${passedCount}, Failed: ${failedCount}, Total: ${passedCount + failedCount}`);
    console.log('=================================================================');

    if (courierServer) await courierServer.stop();
    if (paymentServer) await paymentServer.stop();
    await globalSupervisor.stopAll();
    process.exit(hasFailures ? 1 : 0);
  } catch (err) {
    console.error('[Runner] Unhandled regression runner error:', err);
    if (courierServer) await courierServer.stop();
    if (paymentServer) await paymentServer.stop();
    await globalSupervisor.stopAll();
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('run-all-phases.ts') || process.argv[1]?.endsWith('run-all-phases.js')) {
  main();
}
