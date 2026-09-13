import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';

const APP_URL = process.env.CRM_URL || 'http://127.0.0.1:3001';

describe('Tier 1.18: Team-Specific Workspaces & Field Masking (R1 / Phase 2)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createTestInboundCase(bu = 'Central', channel = 'LINE', queueName = 'Central Chat & Shop') {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        source: {
          channel,
          pageId: 'central_department_store',
          pageName: 'Central Department Store',
          businessUnit: bu,
          senderId: `U_team_cust_${Date.now()}`,
          senderName: 'Khun EOR Customer'
        },
        session: { sessionId: `sess_team_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_${Date.now()}`, type: 'TEXT', text: 'สอบถามสินค้าสาขาชิดลมครับ' }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('T1.18.1 - Team workspaces separate cases by team (EOR vs Chat & Shop vs Social Media)', async () => {
    const caseId1 = await createTestInboundCase('Central', 'LINE');
    const caseId2 = await createTestInboundCase('Central', 'FB');

    // Register caseId1 as an EOR case
    await fetch(`${APP_URL}/api/cases/${caseId1}/eor-fields`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'SUPERVISOR',
        'x-user-team': 'EOR',
      },
      body: JSON.stringify({
        ticketNumber: 'TK-EOR-2026-101',
        sellingStoreName: 'Central Chidlom',
        sellingStoreStaffId: 'STF-CHIDLOM-01',
      }),
    });

    // 1. Fetch EOR workspace
    const eorRes = await fetch(`${APP_URL}/api/workspaces/eor`, {
      headers: { 'x-user-role': 'SUPERVISOR', 'x-user-team': 'EOR' }
    });
    assert.equal(eorRes.status, 200, 'EOR workspace should return 200 OK');
    const eorData = await eorRes.json();
    assert.equal(eorData.workspace, 'EOR');
    const foundInEor = eorData.cases.some((c: any) => c.id === caseId1);
    assert.ok(foundInEor, 'EOR workspace should contain the EOR tagged case');

    // 2. Fetch Chat & Shop workspace
    const csRes = await fetch(`${APP_URL}/api/workspaces/CHAT_AND_SHOP`, {
      headers: { 'x-user-role': 'AGENT', 'x-user-team': 'CHAT_AND_SHOP' }
    });
    assert.equal(csRes.status, 200);
    const csData = await csRes.json();
    assert.equal(csData.workspace, 'CHAT_AND_SHOP');

    // 3. Fetch Social Media workspace
    const socRes = await fetch(`${APP_URL}/api/workspaces/SOCIAL_MEDIA`, {
      headers: { 'x-user-role': 'AGENT_SOCIAL', 'x-user-team': 'SOCIAL_MEDIA' }
    });
    assert.equal(socRes.status, 200);
    const socData = await socRes.json();
    assert.equal(socData.workspace, 'SOCIAL_MEDIA');
  });

  test('T1.18.2 - EOR cases store and return ticketNumber, sellingStoreName, and sellingStoreStaffId', async () => {
    const caseId = await createTestInboundCase('Central', 'LINE');

    const updateRes = await fetch(`${APP_URL}/api/cases/${caseId}/eor-fields`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'ADMIN',
      },
      body: JSON.stringify({
        ticketNumber: 'TK-EOR-2026-9988',
        sellingStoreName: 'Central @ centralwOrld',
        sellingStoreStaffId: 'STF-CW-901',
        metadata: {
          posRegisterId: 'POS-04',
          clickAndCollectLocker: 'LOCKER-B12',
        }
      }),
    });

    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.eorFields.ticketNumber, 'TK-EOR-2026-9988');
    assert.equal(updateData.eorFields.sellingStoreName, 'Central @ centralwOrld');
    assert.equal(updateData.eorFields.sellingStoreStaffId, 'STF-CW-901');
    assert.equal(updateData.eorFields.metadata.clickAndCollectLocker, 'LOCKER-B12');
  });

  test('T1.18.3 - Frontline sales agents receive masked values for EOR-specific fields', async () => {
    const caseId = await createTestInboundCase('Central', 'LINE');

    // Seed EOR data as supervisor
    await fetch(`${APP_URL}/api/cases/${caseId}/eor-fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'SUPERVISOR' },
      body: JSON.stringify({
        ticketNumber: 'TK-CONFIDENTIAL-1234',
        sellingStoreName: 'Central Chidlom',
        sellingStoreStaffId: 'STF-SENSITIVE-99',
      }),
    });

    // Request as frontline sales agent from CHAT_AND_SHOP team
    const maskedRes = await fetch(`${APP_URL}/api/cases/${caseId}/eor-fields`, {
      headers: {
        'x-user-role': 'AGENT',
        'x-user-team': 'CHAT_AND_SHOP',
      }
    });

    assert.equal(maskedRes.status, 200);
    const maskedData = await maskedRes.json();
    assert.equal(maskedData.isMasked, true, 'isMasked flag must be true for frontline sales');
    assert.equal(maskedData.ticketNumber, '••••••••', 'Ticket number must be masked');
    assert.equal(maskedData.sellingStoreStaffId, '••••••••', 'Selling staff ID must be masked');
    assert.equal(maskedData.metadata, null, 'Custom metadata must be null for non-EOR agent');
  });

  test('T1.18.4 - Frontline agent attempting to mutate sellingStoreStaffId receives HTTP 403 Forbidden', async () => {
    const caseId = await createTestInboundCase('Central', 'LINE');

    const unauthorizedRes = await fetch(`${APP_URL}/api/cases/${caseId}/eor-fields`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'AGENT',
        'x-user-team': 'CHAT_AND_SHOP',
      },
      body: JSON.stringify({
        sellingStoreStaffId: 'HACKED-STAFF-ID',
      }),
    });

    assert.equal(unauthorizedRes.status, 403, 'Unauthorized mutation must return HTTP 403 Forbidden');
    const errData = await unauthorizedRes.json();
    assert.equal(errData.code, 'PERMISSION_DENIED');
    assert.ok(errData.message.includes('restricted to EOR staff and supervisors'));
  });

  test('T1.18.5 - Supervisor and EOR staff can view unmasked fields and update metadata successfully', async () => {
    const caseId = await createTestInboundCase('Central', 'LINE');

    // EOR agent updates fields
    const patchRes = await fetch(`${APP_URL}/api/cases/${caseId}/eor-fields`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'AGENT_EOR',
        'x-user-team': 'EOR',
      },
      body: JSON.stringify({
        ticketNumber: 'TK-EOR-AUTHORIZED-001',
        sellingStoreName: 'Central Ladprao',
        sellingStoreStaffId: 'STF-LADPRAO-44',
      }),
    });
    assert.equal(patchRes.status, 200);

    // Supervisor reads case details
    const getRes = await fetch(`${APP_URL}/api/cases/${caseId}`, {
      headers: {
        'x-user-role': 'SUPERVISOR',
      }
    });
    assert.equal(getRes.status, 200);
    const caseDetail = await getRes.json();
    assert.equal(caseDetail.isMasked, false);
    assert.equal(caseDetail.eorTicketNumber, 'TK-EOR-AUTHORIZED-001');
    assert.equal(caseDetail.sellingStoreStaffId, 'STF-LADPRAO-44');
  });
});
