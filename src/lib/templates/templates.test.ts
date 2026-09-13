/**
 * Unit & Integration Test Suite for Template Manager & Redactor (Phase 1 R4)
 * Path: src/lib/templates/templates.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVariables,
  renderTemplate,
  previewTemplate,
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from './service';
import {
  getUserRole,
  isPrivilegedRole,
  redactAuditLog,
  redactAuditLogs,
  redactMessage,
  redactMessages,
  redactCase,
} from '../audit/redactor';

describe('R4: Template Message Manager — Variable Extraction & Interpolation', () => {
  it('extracts unique placeholder variables from double-brace tokens', () => {
    const text = 'Hello {{customerName}}, your order {{quotationNumber}} has total {{grandTotal}}. Repeat {{customerName}}.';
    const vars = extractVariables(text);

    assert.deepEqual(vars.sort(), ['customerName', 'grandTotal', 'quotationNumber'].sort());
  });

  it('substitutes available context variables accurately', () => {
    const template = 'เรียนคุณ {{customerName}} ยอดชำระใบเสนอราคา {{quotationNumber}} รวม {{grandTotal}} บาท';
    const context = {
      customerName: 'Khun Somchai',
      quotationNumber: 'QT-2026-9081',
      grandTotal: '27,890.00',
    };

    const { renderedText, missingVariables } = renderTemplate(template, context);

    assert.equal(
      renderedText,
      'เรียนคุณ Khun Somchai ยอดชำระใบเสนอราคา QT-2026-9081 รวม 27,890.00 บาท'
    );
    assert.equal(missingVariables.length, 0);
  });

  it('identifies unpopulated tokens and retains placeholders safely in missingVariables', () => {
    const template = 'Hello {{customerName}}, tracking is {{trackingNumber}} and bonus is {{bonusPoints}}';
    const context = {
      customerName: 'Wichai',
    };

    const { renderedText, missingVariables } = renderTemplate(template, context);

    assert.ok(renderedText.includes('Wichai'));
    assert.ok(renderedText.includes('{{trackingNumber}}'));
    assert.ok(renderedText.includes('{{bonusPoints}}'));
    assert.deepEqual(missingVariables.sort(), ['bonusPoints', 'trackingNumber'].sort());
  });
});

describe('R4: Template Message Manager — Pre-Configured Templates & CRUD', () => {
  it('lists default pre-configured corporate templates', async () => {
    const templates = await listTemplates();
    assert.ok(templates.length >= 5, 'Must contain at least 5 default templates');

    const categories = templates.map((t) => t.category);
    assert.ok(categories.includes('ORDER_CONFIRMATION'));
    assert.ok(categories.includes('PAYMENT'));
    assert.ok(categories.includes('SLIP_REQUEST'));
    assert.ok(categories.includes('TRACKING'));
    assert.ok(categories.includes('TRANSFER'));
  });

  it('retrieves individual template by id', async () => {
    const template = await getTemplateById('tmpl_order_confirmation');
    assert.ok(template);
    assert.equal(template?.name, 'Order Confirmation');
    assert.ok(template?.content.includes('{{quotationNumber}}'));
  });

  it('supports creating, updating, and deleting custom templates', async () => {
    const custom = await createTemplate({
      name: 'VIP Birthday Offer',
      category: 'GENERAL',
      content: 'Happy Birthday {{customerName}}! Use voucher {{voucherCode}} today.',
      businessUnit: 'Central',
    });

    assert.ok(custom.id);
    assert.deepEqual(custom.variables.sort(), ['customerName', 'voucherCode'].sort());

    // Update
    const updated = await updateTemplate(custom.id, {
      content: 'Happy Birthday {{customerName}}! Special gift for you.',
    });
    assert.ok(updated);
    assert.deepEqual(updated?.variables, ['customerName']);

    // Delete
    const deleted = await deleteTemplate(custom.id);
    assert.equal(deleted, true);

    const check = await getTemplateById(custom.id);
    assert.equal(check, null);
  });

  it('previewTemplate renders raw template without case context', async () => {
    const result = await previewTemplate({
      templateText: 'เรียนคุณ {{customerName}} ยอดรวม {{grandTotal}} บาท',
      variables: { customerName: 'Somchai', grandTotal: '1,500.00' },
    });

    assert.equal(result.success, true);
    assert.equal(result.renderedText, 'เรียนคุณ Somchai ยอดรวม 1,500.00 บาท');
    assert.equal(result.missingVariables.length, 0);
  });
});

describe('R4: Role-Restricted Field-Level Audit Trail & Redactor', () => {
  it('extracts caller role from headers correctly', () => {
    const mockHeaders1 = { get: (name: string) => (name === 'x-user-role' ? 'SUPERVISOR' : null) };
    assert.equal(getUserRole(mockHeaders1), 'SUPERVISOR');

    const mockHeaders2 = { 'x-user-role': 'AGENT_SALES' };
    assert.equal(getUserRole(mockHeaders2), 'AGENT_SALES');

    assert.equal(getUserRole(null), 'AGENT');
  });

  it('privileged roles (ADMIN, AUDITOR, SUPERVISOR) see unredacted audit records', () => {
    const sensitiveLog = {
      action: 'FRAUD_FLAGGED',
      details: 'Suspicious credit card transaction from unrecognized IP',
      oldValue: 'UNLOCKED',
      newValue: 'LOCKED',
    };

    const adminView = redactAuditLog(sensitiveLog, 'ADMIN');
    assert.equal(adminView.details, sensitiveLog.details);

    const supervisorView = redactAuditLog(sensitiveLog, 'SUPERVISOR');
    assert.equal(supervisorView.details, sensitiveLog.details);
  });

  it('masks fraud and dispute audit logs for AGENT_SALES and frontline AGENT', () => {
    const sensitiveLog = {
      action: 'FRAUD_FLAGGED',
      details: 'Suspicious credit card transaction from unrecognized IP',
      oldValue: 'UNLOCKED',
      newValue: 'LOCKED',
    };

    const agentView = redactAuditLog(sensitiveLog, 'AGENT_SALES');
    assert.equal(agentView.details, '[RESTRICTED - SUPERVISOR ONLY]');
    assert.equal(agentView.oldValue, '[RESTRICTED]');
    assert.equal(agentView.newValue, '[RESTRICTED]');
    assert.equal(agentView.isRedacted, true);
  });

  it('redacts cross-team confidential whisper notes between CS and COL', () => {
    const colConfidentialNote = {
      isInternal: true,
      content: '[COL_CONFIDENTIAL] Warehouse investigation on counterfeit return',
    };

    const csView = redactMessage(colConfidentialNote, 'AGENT_CS');
    assert.equal(csView.content, '[CONFIDENTIAL - RESTRICTED ACCESS]');
    assert.equal(csView.isRedacted, true);

    const colView = redactMessage(colConfidentialNote, 'AGENT_COL');
    assert.equal(colView.content, colConfidentialNote.content);
    assert.equal(colView.isRedacted, undefined);
  });

  it('redacts entire case record with nested audit logs and whisper notes', () => {
    const sampleCase = {
      id: 'CAS-01',
      title: 'Customer complaint',
      auditLogs: [
        { action: 'STATUS_CHANGE', details: 'Status moved to IN_PROGRESS' },
        { action: 'FRAUD_FLAGGED', details: 'Credit card chargeback initiated' },
      ],
      messages: [
        { isInternal: false, content: 'Public customer greeting' },
        { isInternal: true, content: '[FRAUD] Customer card flagged by 2C2P risk engine' },
      ],
    };

    const redacted = redactCase(sampleCase, 'AGENT_SALES');

    assert.equal(redacted.auditLogs[0].details, 'Status moved to IN_PROGRESS');
    assert.equal(redacted.auditLogs[1].details, '[RESTRICTED - SUPERVISOR ONLY]');
    assert.equal(redacted.messages[0].content, 'Public customer greeting');
    assert.equal(redacted.messages[1].content, '[CONFIDENTIAL - RESTRICTED ACCESS]');
  });
});
