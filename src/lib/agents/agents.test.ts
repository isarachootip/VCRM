import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../db';
import {
  normalizePresenceStatus,
  listAgentPresence,
  getAgentPresence,
  updateAgentPresence,
  findBestAgentForQueue,
  routeCaseToAgent,
  releaseCaseFromAgent,
} from './index';
import { PresenceStatus } from '@prisma/client';

describe('Agent Presence & Queue Routing Tests (M11 / Phase 1)', () => {
  const testAgentId = `agent_test_${Date.now()}`;
  let testQueueId: string;
  let testCaseId: string;

  before(async () => {
    // 1. Create or fetch test queue
    let queue = await prisma.queue.findFirst();
    if (!queue) {
      queue = await prisma.queue.create({
        data: {
          name: 'Routing Test Queue',
          code: `TEST_QUEUE_${Date.now()}`,
          businessUnit: 'CENTRAL',
        },
      });
    }
    testQueueId = queue.id;

    // 2. Create test agent
    const user = await prisma.user.create({
      data: {
        id: testAgentId,
        email: `${testAgentId}@central.co.th`,
        name: 'Test Router Agent',
        role: 'AGENT',
        presence: 'ONLINE',
        maxConcurrentChats: 5,
        activeChatCount: 0,
        assignedQueues: {
          create: {
            queueId: testQueueId,
          },
        },
      },
    });

    // 3. Create test customer and case
    let cust = await prisma.customer.findFirst();
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          externalId: `cust_route_${Date.now()}`,
          channel: 'LINE',
          displayName: 'Test Route Customer',
        },
      });
    }

    const c = await prisma.case.create({
      data: {
        caseNumber: `CAS-ROUTE-${Date.now()}`,
        title: 'Test Routing Case',
        channel: 'LINE',
        pageId: 'central_test',
        queueId: testQueueId,
        customerId: cust.id,
        businessUnit: 'CENTRAL',
        status: 'OPEN',
      },
    });
    testCaseId = c.id;
  });

  test('normalizePresenceStatus validates presence strings', () => {
    assert.equal(normalizePresenceStatus('ONLINE'), PresenceStatus.ONLINE);
    assert.equal(normalizePresenceStatus('online'), PresenceStatus.ONLINE);
    assert.equal(normalizePresenceStatus('LUNCH'), PresenceStatus.LUNCH);
    assert.equal(normalizePresenceStatus('lunch'), PresenceStatus.LUNCH);
    assert.equal(normalizePresenceStatus('BREAK'), PresenceStatus.BREAK);
    assert.equal(normalizePresenceStatus('OFFLINE'), PresenceStatus.OFFLINE);

    assert.throws(() => normalizePresenceStatus('VACATION'));
    assert.throws(() => normalizePresenceStatus(''));
  });

  test('updateAgentPresence updates User and AgentProfile records', async () => {
    const updated = await updateAgentPresence({
      userId: testAgentId,
      presence: 'LUNCH',
      reason: 'Taking lunch break',
    });

    assert.equal(updated.id, testAgentId);
    assert.equal(updated.presence, PresenceStatus.LUNCH);

    // Verify User record in DB
    const user = await prisma.user.findUnique({ where: { id: testAgentId } });
    assert.equal(user?.presence, PresenceStatus.LUNCH);

    // Verify AgentProfile record in DB
    const profile = await prisma.agentProfile.findUnique({ where: { userId: testAgentId } });
    assert.equal(profile?.presence, PresenceStatus.LUNCH);
  });

  test('listAgentPresence returns agent listing with status', async () => {
    const agents = await listAgentPresence();
    assert.ok(Array.isArray(agents));
    const found = agents.find((a) => a.id === testAgentId);
    assert.ok(found);
    assert.equal(found?.presence, PresenceStatus.LUNCH);
  });

  test('Queue routing ignores agents who are not ONLINE', async () => {
    // Current testAgentId is LUNCH
    const bestAgent = await findBestAgentForQueue(testQueueId);
    if (bestAgent) {
      assert.notEqual(bestAgent.id, testAgentId, 'Agent on LUNCH should not be selected');
    }
  });

  test('Queue routing assigns case to least-loaded ONLINE agent', async () => {
    // Switch agent back to ONLINE
    await updateAgentPresence({
      userId: testAgentId,
      presence: 'ONLINE',
    });

    const routeResult = await routeCaseToAgent(testCaseId, testQueueId);
    assert.equal(routeResult.assigned, true);
    assert.equal(routeResult.caseId, testCaseId);
    assert.equal(routeResult.agentId, testAgentId);

    // Verify activeChatCount incremented
    const user = await prisma.user.findUnique({ where: { id: testAgentId } });
    assert.equal(user?.activeChatCount, 1);

    // Release case
    await releaseCaseFromAgent(testAgentId);
    const userAfterRelease = await prisma.user.findUnique({ where: { id: testAgentId } });
    assert.equal(userAfterRelease?.activeChatCount, 0);
  });
});
