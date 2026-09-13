import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalSupervisor } from './runner/supervisor';
import { CourierMockServer } from './mocks/courier-mock-server';
import { PaymentMockServer } from './mocks/payment-mock-server';
import { waitFor } from './runner/wait-for';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const phase3TestFiles = [
  // Tier 1: Feature Coverage (R1 - R5)
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.1-idle-chat-auto-close.test.ts'),
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.2-delivery-tracking-line.test.ts'),
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.3-agent-break-timers-reversion.test.ts'),
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.4-portal-link-hub-rbac.test.ts'),
  path.resolve(__dirname, 'phase3/tier1-coverage/t1.5-nsc-vip-priority-routing.test.ts'),

  // Tier 2: Boundary & Corner Cases (R1 - R5)
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.1-idle-sweep-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.2-delivery-tracking-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.3-break-timers-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.4-portal-hub-boundaries.test.ts'),
  path.resolve(__dirname, 'phase3/tier2-boundaries/t2.5-vip-routing-boundaries.test.ts'),

  // Tier 3: Cross-Feature Interactions & Pairwise Workflows
  path.resolve(__dirname, 'phase3/tier3-combinations/t3.1-cross-feature-interactions.test.ts'),

  // Tier 4: Real-World Workload Scenarios
  path.resolve(__dirname, 'phase3/tier4-scenarios/t4.1-real-world-scenarios.test.ts'),

  // Tier 5: White-Box Adversarial Hardening (R1 - R5)
  path.resolve(__dirname, 'phase3/tier5-adversarial/t5.1-white-box-adversarial.test.ts'),
];

async function main() {
  console.log('=================================================================');
  console.log('  OMNICHANNEL SOCIAL COMMERCE CRM - PHASE 3 E2E TEST RUNNER (R6)');
  console.log('=================================================================');
  console.log(`[Runner] Discovered ${phase3TestFiles.length} Phase 3 test suites across Tiers 1-4.`);
  console.log('[Runner] Bootstrapping Programmatic Mock Sandbox & Test CRM...');

  let courierServer: CourierMockServer | null = null;
  let paymentServer: PaymentMockServer | null = null;

  try {
    // 1. Start core supervisor (Zwiz :4010, Qualtrics :4020, CRM :3001)
    await globalSupervisor.startAll();

    // 2. Ensure Payment Mock Server (:4030) is active
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

    // 3. Ensure Courier Mock Server (:4040) is active
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
    console.log('[Runner] Beginning Phase 3 E2E test execution...\n');

    const testStream = run({
      files: phase3TestFiles,
      concurrency: 1, // Sequential run for deterministic state isolation
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
    console.log(`  PHASE 3 TEST SUMMARY: Passed: ${passedCount}, Failed: ${failedCount}, Total: ${passedCount + failedCount}`);
    if (hasFailures) {
      console.log('  STATUS: FAILED / PENDING IMPLEMENTATION - Phase 3 endpoints require M2-M4 implementation.');
    } else {
      console.log('  STATUS: SUCCESS - All Phase 3 tests passed cleanly (100%).');
    }
    console.log('=================================================================');

    if (courierServer) await courierServer.stop();
    if (paymentServer) await paymentServer.stop();
    await globalSupervisor.stopAll();
    process.exit(hasFailures ? 1 : 0);
  } catch (err) {
    console.error('[Runner] Unhandled execution error:', err);
    if (courierServer) await courierServer.stop();
    if (paymentServer) await paymentServer.stop();
    await globalSupervisor.stopAll();
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('run-phase3.ts') || process.argv[1]?.endsWith('run-phase3.js')) {
  main();
}
