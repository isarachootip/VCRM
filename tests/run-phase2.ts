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

const phase2TestFiles = [
  // Tier 1: Feature Coverage (t1.18 - t1.23)
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.18-team-workspaces-field-masking.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.19-advanced-routing-sla-alerts.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.20-interactive-templates-payment-notifications.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.21-shipping-label-courier-tracking.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.22-customer-360-analytics.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.23-promotion-management-rbac.test.ts'),

  // Tier 2: Boundaries & Corners (t2.9)
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.9-phase2-boundaries.test.ts'),

  // Tier 3: Workflows & Combinations (t3.7)
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.7-phase2-workflows.test.ts'),

  // Tier 4: Real-World Scenarios (t4.6)
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.6-phase2-e2e-scenarios.test.ts'),
];

async function main() {
  console.log('=================================================================');
  console.log('  OMNICHANNEL CRM - PHASE 2 E2E TEST RUNNER & MOCK SANDBOX (R7)');
  console.log('=================================================================');
  console.log(`[Runner] Discovered ${phase2TestFiles.length} Phase 2 test suites.`);
  console.log('[Runner] Bootstrapping Programmatic Mock Sandbox & Test CRM...');

  let paymentServer: PaymentMockServer | null = null;
  let courierServer: CourierMockServer | null = null;

  try {
    // 1. Start core supervisor (Zwiz :4010, Qualtrics :4020, CRM :3001)
    await globalSupervisor.startAll();

    // 2. Start Payment Mock Server (:4030) if not already running
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

    // 3. Start Courier Mock Server (:4040) if not already running
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

    console.log('[Runner] All 5 services healthy: Zwiz (:4010), Qualtrics (:4020), Payment (:4030), Courier (:4040), CRM (:3001).');
    console.log('[Runner] Beginning Phase 2 test execution...\n');

    const testStream = run({
      files: phase2TestFiles,
      concurrency: 1, // Sequential run for deterministic assertions
    });

    testStream.compose(spec as any).pipe(process.stdout);

    let hasFailures = false;
    testStream.on('test:fail', () => {
      hasFailures = true;
    });

    await new Promise((resolve) => {
      testStream.on('end', resolve);
    });

    console.log('\n=================================================================');
    if (hasFailures) {
      console.log('  STATUS: FAILED - Some Phase 2 test assertions failed.');
    } else {
      console.log('  STATUS: SUCCESS - All Phase 2 tests passed cleanly (100%).');
    }
    console.log('=================================================================');

    if (courierServer) {
      await courierServer.stop();
    }
    if (paymentServer) {
      await paymentServer.stop();
    }
    await globalSupervisor.stopAll();
    process.exit(hasFailures ? 1 : 0);
  } catch (err) {
    console.error('[Runner] Unhandled execution error:', err);
    if (courierServer) {
      await courierServer.stop();
    }
    if (paymentServer) {
      await paymentServer.stop();
    }
    await globalSupervisor.stopAll();
    process.exit(1);
  }
}

main();
