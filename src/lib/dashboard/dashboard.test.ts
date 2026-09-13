import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../db';
import { getDashboardMetrics, getDashboardSnapshot } from './index';

describe('Real-Time Operational Dashboard Service Tests (M11 / Phase 1)', () => {
  before(async () => {
    // Seed baseline queue and case if none exists
    const queueCount = await prisma.queue.count();
    if (queueCount === 0) {
      await prisma.queue.create({
        data: {
          name: 'Central Sales Test Queue',
          code: 'TEST_CENTRAL_SALES',
          businessUnit: 'CENTRAL',
          slaResponseMin: 15,
          slaResolveMin: 120,
        },
      });
    }
  });

  test('getDashboardMetrics returns expected schema and non-null values', async () => {
    const metrics = await getDashboardMetrics();

    assert.ok(metrics, 'Metrics object must not be null');
    assert.ok(typeof metrics.timestamp === 'string', 'Timestamp must be an ISO string');
    assert.ok(Array.isArray(metrics.activeQueues), 'activeQueues must be an array');
    assert.ok(Array.isArray(metrics.queueDepth), 'queueDepth must be an array');
    assert.equal(typeof metrics.activeCases, 'number');
    assert.equal(typeof metrics.conversionRate, 'number');

    // Agent statuses verification
    assert.ok(metrics.agentStatuses, 'agentStatuses must be defined');
    assert.equal(typeof metrics.agentStatuses.online, 'number');
    assert.equal(typeof metrics.agentStatuses.offline, 'number');
    assert.equal(typeof metrics.agentStatuses.lunch, 'number');
    assert.equal(typeof metrics.agentStatuses.break, 'number');

    // Pending payments verification
    assert.ok(metrics.pendingPayments, 'pendingPayments must be defined');
    assert.equal(typeof metrics.pendingPayments.count, 'number');
    assert.equal(typeof metrics.pendingPayments.totalAmount, 'number');

    // Daily sales volume verification
    assert.ok(metrics.dailySalesVolume, 'dailySalesVolume must be defined');
    assert.equal(typeof metrics.dailySalesVolume.paidQuotationsCount, 'number');
    assert.equal(typeof metrics.dailySalesVolume.totalPaidAmountThb, 'number');

    // Sales metrics verification
    assert.ok(metrics.salesMetrics, 'salesMetrics must be defined');
    assert.equal(typeof metrics.salesMetrics.conversionRate, 'number');

    // Service SLA verification
    assert.ok(metrics.serviceSLA, 'serviceSLA must be defined');
    assert.equal(typeof metrics.serviceSLA.avgHandlingTimeSeconds, 'number');
  });

  test('getDashboardSnapshot returns identical structure to getDashboardMetrics', async () => {
    const snapshot = await getDashboardSnapshot();
    assert.ok(snapshot.timestamp);
    assert.ok(Array.isArray(snapshot.activeQueues));
    assert.equal(typeof snapshot.conversionRate, 'number');
  });
});
