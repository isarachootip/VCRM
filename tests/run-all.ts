import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalSupervisor } from './runner/supervisor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  // Tier 1: Feature Coverage (F1 - F9)
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.1-inbound-webhook.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.2-outbound-messaging.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.3-bot-state-sync.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.4-multi-format-paste.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.5-whisper-notes.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.6-case-management.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.7-qualtrics-trigger.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.8-csat-ingestion.test.ts'),
  path.resolve(__dirname, 'e2e/tier1-coverage/t1.9-extensible-schema.test.ts'),

  // Tier 2: Boundary & Corner Cases (7 Categories)
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.1-empty-null-inputs.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.2-invalid-malformed.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.3-max-length-oversized.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.4-concurrency-races.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.5-duplicate-replays.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.6-state-violations.test.ts'),
  path.resolve(__dirname, 'e2e/tier2-boundaries/t2.7-network-outages.test.ts'),

  // Tier 3: Pairwise & Combinations (5 Flows)
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.1-omnichannel-lifecycle.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.2-cross-bu-escalation.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.3-capacity-clipboard.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.4-partial-failure-recovery.test.ts'),
  path.resolve(__dirname, 'e2e/tier3-combinations/t3.5-out-of-order-events.test.ts'),

  // Tier 4: Real-World Multi-BU Journeys (4 Scenarios)
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.1-central-luxury-vip-line.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.2-beauty-club-fb.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.3-muji-furniture-ig.test.ts'),
  path.resolve(__dirname, 'e2e/tier4-scenarios/t4.4-supersports-transfer.test.ts')
];

async function main() {
  console.log('=================================================================');
  console.log('  OMNICHANNEL SOCIAL COMMERCE CRM - 4-TIER E2E TEST RUNNER (R6)');
  console.log('=================================================================');
  console.log(`[Runner] Discovered ${testFiles.length} test suites spanning Tiers 1-4.`);
  console.log('[Runner] Bootstrapping Programmatic Mock Sandbox & Test CRM...');

  try {
    await globalSupervisor.startAll();
    console.log('[Runner] Mock Zwiz (:4010), Mock Qualtrics (:4020), and CRM (:3001) healthy.');
    console.log('[Runner] Beginning test execution...\n');

    const testStream = run({
      files: testFiles,
      concurrency: 1 // Sequential run for deterministic event capture
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
      console.log('  STATUS: FAILED - Some test assertions failed.');
    } else {
      console.log('  STATUS: SUCCESS - All 4-tier tests passed cleanly (100%).');
    }
    console.log('=================================================================');

    await globalSupervisor.stopAll();
    process.exit(hasFailures ? 1 : 0);
  } catch (err) {
    console.error('[Runner] Unhandled execution error:', err);
    await globalSupervisor.stopAll();
    process.exit(1);
  }
}

main();
