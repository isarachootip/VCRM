import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.4: Enterprise Operations Portal Link Hub & RBAC (R4 / Phase 3)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  const sampleLinkPayload = {
    title: 'AIPX Catalog',
    description: 'AI Product Experience & Enterprise Catalog',
    url: 'https://aipx.central.co.th',
    icon: 'sparkles',
    category: 'CATALOG',
    businessUnits: ['CENTRAL', 'ROBINSON'],
    allowedRoles: ['ADMIN', 'SUPERVISOR', 'AGENT'],
    order: 1,
    isActive: true
  };

  test('T1.4.1 - Portal link directory listing supports filtering by Business Unit', async () => {
    // 1. Create a Central-scoped link as Admin
    await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
      },
      body: JSON.stringify(sampleLinkPayload)
    });

    // 2. Create a Muji-scoped link as Admin
    await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
      },
      body: JSON.stringify({
        title: 'Muji Ops Portal',
        description: 'Muji Store Inventory Lookup',
        url: 'https://muji-ops.central.co.th',
        icon: 'store',
        category: 'OPERATIONS',
        businessUnits: ['MUJI'],
        allowedRoles: ['ADMIN', 'SUPERVISOR', 'AGENT'],
        order: 2,
        isActive: true
      })
    });

    // Query with bu=CENTRAL
    const centralRes = await fetch(`${APP_URL}/api/portal-links?bu=CENTRAL`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    assert.equal(centralRes.status, 200);
    const centralData = await centralRes.json();
    const centralTitles = centralData.links.map((l: any) => l.title);
    assert.ok(centralTitles.includes('AIPX Catalog'), 'Must include Central-scoped link');

    // Query with bu=MUJI
    const mujiRes = await fetch(`${APP_URL}/api/portal-links?bu=MUJI`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    assert.equal(mujiRes.status, 200);
    const mujiData = await mujiRes.json();
    const mujiTitles = mujiData.links.map((l: any) => l.title);
    assert.ok(mujiTitles.includes('Muji Ops Portal'), 'Must include Muji-scoped link');
  });

  test('T1.4.2 - Administrator can create enterprise portal tools with complete metadata', async () => {
    const res = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
      },
      body: JSON.stringify({
        title: 'The 1 Loyalty Portal',
        description: 'Customer Points & Privilege Management',
        url: 'https://the1.central.co.th/portal',
        icon: 'award',
        category: 'LOYALTY',
        businessUnits: ['CENTRAL', 'CDS', 'MUJI'],
        order: 3,
        isActive: true
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.link.id, 'Created link must have unique ID');
    assert.equal(data.link.title, 'The 1 Loyalty Portal');
    assert.equal(data.link.category, 'LOYALTY');
  });

  test('T1.4.3 - Supervisor can update/patch existing portal link properties', async () => {
    // Admin creates link
    const createRes = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN'
      },
      body: JSON.stringify(sampleLinkPayload)
    });
    const { link } = await createRes.json();

    // Supervisor patches link
    const patchRes = await fetch(`${APP_URL}/api/portal-links/${link.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'SUPERVISOR'
      },
      body: JSON.stringify({
        title: 'AIPX Enterprise Suite 2026',
        order: 10
      })
    });

    assert.equal(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.equal(patchData.link.title, 'AIPX Enterprise Suite 2026');
    assert.equal(patchData.link.order, 10);
  });

  test('T1.4.4 - RBAC: Frontline Agent mutation attempts (POST, PATCH, DELETE) return HTTP 403 Forbidden', async () => {
    // Admin creates link
    const createRes = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify(sampleLinkPayload)
    });
    const { link } = await createRes.json();

    // 1. Agent POST attempt
    const agentPostRes = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'AGENT' },
      body: JSON.stringify(sampleLinkPayload)
    });
    assert.equal(agentPostRes.status, 403, 'Agent POST must return 403');

    // 2. Agent PATCH attempt
    const agentPatchRes = await fetch(`${APP_URL}/api/portal-links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'AGENT' },
      body: JSON.stringify({ title: 'Hacked Title' })
    });
    assert.equal(agentPatchRes.status, 403, 'Agent PATCH must return 403');

    // 3. Agent DELETE attempt
    const agentDeleteRes = await fetch(`${APP_URL}/api/portal-links/${link.id}`, {
      method: 'DELETE',
      headers: { 'X-User-Role': 'AGENT' }
    });
    assert.equal(agentDeleteRes.status, 403, 'Agent DELETE must return 403');
  });

  test('T1.4.5 - Administrator can archive / soft-delete portal links', async () => {
    const createRes = await fetch(`${APP_URL}/api/portal-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify(sampleLinkPayload)
    });
    const { link } = await createRes.json();

    // Admin DELETE
    const deleteRes = await fetch(`${APP_URL}/api/portal-links/${link.id}`, {
      method: 'DELETE',
      headers: { 'X-User-Role': 'ADMIN' }
    });
    assert.equal(deleteRes.status, 200);

    // Verify archived link excluded from active listing
    const listRes = await fetch(`${APP_URL}/api/portal-links?activeOnly=true`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    const listData = await listRes.json();
    const activeIds = listData.links.map((l: any) => l.id);
    assert.ok(!activeIds.includes(link.id), 'Archived link must be excluded from active listing');
  });

  test('T1.4.6 - Portal links return sorted by display order sequence', async () => {
    // Create items with orders 30, 10, 20
    const items = [
      { ...sampleLinkPayload, title: 'Item 30', order: 30 },
      { ...sampleLinkPayload, title: 'Item 10', order: 10 },
      { ...sampleLinkPayload, title: 'Item 20', order: 20 },
    ];

    for (const item of items) {
      await fetch(`${APP_URL}/api/portal-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
        body: JSON.stringify(item)
      });
    }

    const res = await fetch(`${APP_URL}/api/portal-links`, {
      headers: { 'X-User-Role': 'AGENT' }
    });
    assert.equal(res.status, 200);
    const { links } = await res.json();
    const sorted = [...links].sort((a: any, b: any) => a.order - b.order);
    assert.deepEqual(links.map((l: any) => l.order), sorted.map((l: any) => l.order), 'Links must be ordered ascending');
  });
});
