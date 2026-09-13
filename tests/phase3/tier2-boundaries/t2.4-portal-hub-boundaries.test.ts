import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 2.4: Portal Link Hub Boundary & RBAC Corner Cases (R4 Boundaries)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  test('T2.4.1 - Boundary: Missing required fields (empty title or invalid URL) returns HTTP 400 Bad Request', async () => {
    const invalidPayloads = [
      { title: '', url: 'https://example.com' },
      { title: 'Valid Title', url: 'not-a-url' },
      { url: 'https://example.com' }, // missing title
      { title: 'Valid Title' }, // missing url
    ];

    for (const payload of invalidPayloads) {
      const res = await fetch(`${APP_URL}/api/portal-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
        body: JSON.stringify(payload)
      });
      assert.ok(res.status >= 400, `Expected 4xx error for payload: ${JSON.stringify(payload)}`);
    }
  });

  test('T2.4.2 - Boundary: Mutation targeting non-existent link ID returns HTTP 404 Not Found', async () => {
    // 1. PATCH non-existent
    const patchRes = await fetch(`${APP_URL}/api/portal-links/non_existent_link_999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ title: 'New Title' })
    });
    assert.equal(patchRes.status, 404, 'Patching non-existent link must return 404');

    // 2. DELETE non-existent
    const deleteRes = await fetch(`${APP_URL}/api/portal-links/non_existent_link_999`, {
      method: 'DELETE',
      headers: { 'X-User-Role': 'ADMIN' }
    });
    assert.equal(deleteRes.status, 404, 'Deleting non-existent link must return 404');
  });

  test('T2.4.3 - Boundary: Missing or unauthenticated user role header rejects mutations with 401 or 403', async () => {
    const res = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No X-User-Role header
      body: JSON.stringify({
        title: 'Unauthenticated Link',
        url: 'https://anon.central.co.th'
      })
    });

    assert.ok(
      [401, 403].includes(res.status),
      `Expected 401/403 for unauthenticated mutation (got ${res.status})`
    );
  });

  test('T2.4.4 - Boundary: Extremely oversized URL or title (> 2,000 characters) returns 400 or 413 Payload Too Large', async () => {
    const oversizedTitle = 'A'.repeat(3000);
    const res = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        title: oversizedTitle,
        url: 'https://example.com'
      })
    });

    assert.ok(
      [400, 413].includes(res.status),
      `Oversized title must return 400/413 error (got ${res.status})`
    );
  });

  test('T2.4.5 - Boundary: Negative or colliding order indices normalize safely without crashing', async () => {
    const res1 = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ title: 'Negative Order', url: 'https://test1.com', order: -5 })
    });
    assert.ok([200, 201].includes(res1.status));

    const res2 = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({ title: 'Duplicate Order', url: 'https://test2.com', order: -5 })
    });
    assert.ok([200, 201].includes(res2.status));

    // List links: should return list ordered without error
    const listRes = await fetch(`${APP_URL}/api/portal-links`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    assert.equal(listRes.status, 200);
  });

  test('T2.4.6 - Boundary: Portal link with empty businessUnits array is treated as universally available across all BUs', async () => {
    await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        title: 'Universal Portal',
        url: 'https://universal.central.co.th',
        businessUnits: [], // Universal
        order: 1
      })
    });

    // Query under Central
    const resCentral = await fetch(`${APP_URL}/api/portal-links?bu=CENTRAL`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    const dataCentral = await resCentral.json();
    assert.ok(dataCentral.links.some((l: any) => l.title === 'Universal Portal'));

    // Query under Muji
    const resMuji = await fetch(`${APP_URL}/api/portal-links?bu=MUJI`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    const dataMuji = await resMuji.json();
    assert.ok(dataMuji.links.some((l: any) => l.title === 'Universal Portal'));
  });
});
