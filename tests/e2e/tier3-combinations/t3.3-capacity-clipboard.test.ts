import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { globalSupervisor } from '../../runner/supervisor';
import { waitFor } from '../../runner/wait-for';

const APP_URL = 'http://127.0.0.1:3001';
const ZWIZ_MOCK_URL = 'http://127.0.0.1:4010';

describe('Tier 3.3: Capacity Load & Clipboard Paste Flow (Pairwise Integration Flow 3)', () => {
  before(async () => {
    await globalSupervisor.startAll();
  });

  after(async () => {
    await globalSupervisor.stopAll();
  });

  beforeEach(async () => {
    await globalSupervisor.resetAll();
  });

  async function createInboundCase(index: number) {
    const res = await fetch(`${APP_URL}/api/webhooks/zwiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_cap_${index}_${Date.now()}`,
        source: {
          channel: 'LINE',
          pageId: 'central_dept',
          businessUnit: 'Central',
          senderId: `U_cap_cust_${index}`,
          senderName: `Customer ${index}`
        },
        session: { sessionId: `sess_cap_${index}_${Date.now()}`, botState: 'AGENT_HANDOFF' },
        message: { messageId: `msg_cap_${index}_${Date.now()}`, type: 'TEXT', text: `Inquiry ${index}` }
      })
    });
    const data = await res.json();
    return data.caseId;
  }

  test('Flow 3: Capacity management and clipboard paste under load', async () => {
    // 1. Create 3 cases assigned to Agent Sarah (Max capacity = 3)
    const case1 = await createInboundCase(1);
    const case2 = await createInboundCase(2);
    const case3 = await createInboundCase(3);

    await Promise.all([
      fetch(`${APP_URL}/api/cases/${case1}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: 'agent_sarah' })
      }),
      fetch(`${APP_URL}/api/cases/${case2}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: 'agent_sarah' })
      }),
      fetch(`${APP_URL}/api/cases/${case3}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: 'agent_sarah' })
      })
    ]);

    // Query active cases for Sarah: should be 3
    const activeRes = await fetch(`${APP_URL}/api/cases?ownerId=agent_sarah&status=OPEN`);
    const activeData = await activeRes.json();
    assert.equal(activeData.cases.length, 3);

    // 2. 4th Inbound case arrives -> Stays in unassigned queue (Sarah at capacity)
    const case4 = await createInboundCase(4);
    const c4Res = await fetch(`${APP_URL}/api/cases/${case4}`);
    const c4Data = await c4Res.json();
    assert.equal(c4Data.ownerId, null);

    // 3. Sarah uses clipboard paste in Case 1 composer
    const uploadRes = await fetch(`${APP_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'clipboard_stock_inventory.png',
        mimeType: 'image/png',
        fileSize: 320000
      })
    });
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.url);

    // Send pasted image to customer in Case 1
    await fetch(`${APP_URL}/api/cases/${case1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'ภาพสต็อกสินค้าในระบบครับ',
        type: 'IMAGE',
        mediaUrl: uploadData.url,
        isInternal: false,
        agentId: 'agent_sarah'
      })
    });

    // 4. Sarah resolves and closes Case 1
    await fetch(`${APP_URL}/api/cases/${case1}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', closureReason: 'RESOLVED' })
    });

    // Verify Case 1 bot state sync
    const zwizSync = await waitFor(async () => {
      const zRes = await fetch(`${ZWIZ_MOCK_URL}/mock/zwiz/inspect/state-updates?caseId=${case1}`);
      const zData = await zRes.json();
      return zData.updates?.[0] || null;
    });
    assert.equal(zwizSync.botState, 'ACTIVE');

    // 5. Sarah's capacity freed (drops to 2) -> Case 4 can now be assigned to Sarah
    await fetch(`${APP_URL}/api/cases/${case4}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: 'agent_sarah' })
    });

    const c4Updated = await fetch(`${APP_URL}/api/cases/${case4}`).then(r => r.json());
    assert.equal(c4Updated.ownerId, 'agent_sarah');
  });
});
