import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalSupervisor } from './runner/supervisor';
import { PaymentMockServer } from './mocks/payment-mock-server';
import { waitFor } from './runner/wait-for';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const phase1TestFiles = [
  // Tier 1: Feature Coverage (t1.10 - t1.17)
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.10-quotations-engine.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.11-payment-gateways.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.12-pos-reconciliation.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.13-chat-transfer.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.14-multi-criteria-search.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.15-template-manager.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.16-dashboard-streaming.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.17-supervisor-reports.test.ts'),

  // Tier 2: Boundaries & Corners (t2.8)
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.8-phase1-boundaries.test.ts'),

  // Tier 3: Workflows & Combinations (t3.6)
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.6-phase1-workflows.test.ts'),

  // Tier 4: Real-World Scenarios (t4.5)
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.5-phase1-e2e-scenarios.test.ts')
];

async function main() {
  console.log('=================================================================');
  console.log('  OMNICHANNEL CRM - PHASE 1 E2E TEST RUNNER & MOCK SANDBOX (R6)');
  console.log('=================================================================');
  console.log(`[Runner] Discovered ${phase1TestFiles.length} Phase 1 test suites.`);
  console.log('[Runner] Bootstrapping Programmatic Mock Sandbox & Test CRM...');

  let paymentServer: PaymentMockServer | null = null;

  try {
    // 1. Start core supervisor (Zwiz :4010, Qualtrics :4020, CRM :3001)
    await globalSupervisor.startAll();

    // 2. Start Payment Mock Server (:4030) if not running
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

    console.log('[Runner] All services healthy: Zwiz (:4010), Qualtrics (:4020), Payment (:4030), CRM (:3001).');
    console.log('[Runner] Beginning Phase 1 test execution...\n');

    const testStream = run({
      files: phase1TestFiles,
      concurrency: 1 // Sequential run for deterministic assertions
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
      console.log('  STATUS: FAILED - Some Phase 1 test assertions failed.');
    } else {
      console.log('  STATUS: SUCCESS - All Phase 1 tests passed cleanly.');
    }
    console.log('=================================================================');

    if (paymentServer) {
      await paymentServer.stop();
    }
    await globalSupervisor.stopAll();
    process.exit(hasFailures ? 1 : 0);
  } catch (err) {
    console.error('[Runner] Unhandled execution error:', err);
    if (paymentServer) {
      await paymentServer.stop();
    }
    await globalSupervisor.stopAll();
    process.exit(1);
  }
}

main();
