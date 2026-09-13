/**
 * Role-Restricted Field-Level Audit Trail & Note Redactor
 * Path: src/lib/audit/redactor.ts
 *
 * Implements Phase 1 R4:
 * - Role-based visibility restrictions for audit logs and chat whisper notes.
 * - Protects COL and CS case confidentiality (fraud inquiries, payment disputes, private transfers).
 * - Supported roles via `x-user-role`:
 *   * SUPERVISOR, ADMIN, AUDITOR: Unrestricted full visibility.
 *   * AGENT_CS: Customer Service agent; masked from private COL fraud notes.
 *   * AGENT_COL: Central Online agent; masked from private CS dispute notes.
 *   * AGENT_SALES / AGENT: Frontline store sales; masked from all confidential fraud & cross-team private notes.
 */

export type UserRoleType =
  | 'ADMIN'
  | 'AUDITOR'
  | 'SUPERVISOR'
  | 'AGENT_CS'
  | 'AGENT_COL'
  | 'AGENT_SALES'
  | 'AGENT_EOR'
  | 'AGENT_SOCIAL_MEDIA'
  | 'AGENT';

const SENSITIVE_ACTIONS = new Set([
  'FRAUD_FLAGGED',
  'PAYMENT_DISCREPANCY',
  'FRAUD_INVESTIGATION',
  'CONFIDENTIAL_NOTE_ADDED',
  'SUSPICIOUS_ACTIVITY',
  'CREDIT_CARD_DISPUTE',
  'POLICE_REPORT_ATTACHED',
]);

const RESTRICTED_MASK_TEXT = '[CONFIDENTIAL - RESTRICTED ACCESS]';
const SUPERVISOR_MASK_DETAILS = '[RESTRICTED - SUPERVISOR ONLY]';

/**
 * Extracts and normalizes the caller role from HTTP headers or Request object.
 */
export function getUserRole(requestOrHeaders?: any): string {
  if (!requestOrHeaders) return 'AGENT';

  let roleHeader: string | null = null;
  if (typeof requestOrHeaders.get === 'function') {
    roleHeader = requestOrHeaders.get('x-user-role') || requestOrHeaders.get('x-role');
  } else if (requestOrHeaders.headers && typeof requestOrHeaders.headers.get === 'function') {
    roleHeader = requestOrHeaders.headers.get('x-user-role') || requestOrHeaders.headers.get('x-role');
  } else if (typeof requestOrHeaders === 'object') {
    roleHeader = requestOrHeaders['x-user-role'] || requestOrHeaders['x-role'] || requestOrHeaders.role;
  }

  if (!roleHeader) return 'AGENT';
  return String(roleHeader).trim().toUpperCase();
}

/**
 * Checks if the role has administrative or supervisory privilege.
 */
export function isPrivilegedRole(role?: string): boolean {
  const normalized = (role || '').trim().toUpperCase();
  return (
    normalized === 'ADMIN' ||
    normalized === 'AUDITOR' ||
    normalized === 'SUPERVISOR'
  );
}

/**
 * Redacts an individual AuditLog based on the caller role.
 */
export function redactAuditLog(log: any, role: string = 'AGENT'): any {
  if (!log) return log;
  if (isPrivilegedRole(role)) return log;

  const normalizedRole = role.trim().toUpperCase();
  const action = String(log.action || log.actionType || '').toUpperCase();

  const isSensitive =
    SENSITIVE_ACTIONS.has(action) ||
    (log.details && (
      String(log.details).includes('FRAUD') ||
      String(log.details).includes('DISCREPANCY') ||
      String(log.details).includes('CONFIDENTIAL')
    ));

  // Role-specific restrictions:
  // AGENT_SALES and general AGENT cannot view fraud or payment dispute logs
  if (normalizedRole === 'AGENT_SALES' || normalizedRole === 'AGENT') {
    if (isSensitive) {
      return {
        ...log,
        details: SUPERVISOR_MASK_DETAILS,
        oldValue: '[RESTRICTED]',
        newValue: '[RESTRICTED]',
        isRedacted: true,
      };
    }
  }

  // Cross-team transfer confidentiality:
  // If note/transfer is tagged COL confidential, AGENT_CS cannot view
  if (normalizedRole === 'AGENT_CS' && log.details && String(log.details).includes('[COL_CONFIDENTIAL]')) {
    return {
      ...log,
      details: RESTRICTED_MASK_TEXT,
      oldValue: '[RESTRICTED]',
      newValue: '[RESTRICTED]',
      isRedacted: true,
    };
  }

  // If note/transfer is tagged CS confidential, AGENT_COL cannot view
  if (normalizedRole === 'AGENT_COL' && log.details && String(log.details).includes('[CS_CONFIDENTIAL]')) {
    return {
      ...log,
      details: RESTRICTED_MASK_TEXT,
      oldValue: '[RESTRICTED]',
      newValue: '[RESTRICTED]',
      isRedacted: true,
    };
  }

  return log;
}

/**
 * Redacts an array of AuditLogs based on caller role.
 */
export function redactAuditLogs(logs: any[], role: string = 'AGENT'): any[] {
  if (!Array.isArray(logs)) return [];
  return logs.map((log) => redactAuditLog(log, role));
}

/**
 * Redacts internal whisper notes or case messages based on caller role.
 */
export function redactMessage(message: any, role: string = 'AGENT'): any {
  if (!message) return message;
  if (isPrivilegedRole(role)) return message;

  const normalizedRole = role.trim().toUpperCase();
  const textContent = typeof message.content === 'string'
    ? message.content
    : (message.content?.text || message.text || '');

  const isConfidentialNote =
    message.isInternal === true &&
    (
      textContent.includes('[CONFIDENTIAL]') ||
      textContent.includes('[FRAUD]') ||
      textContent.includes('[INTERNAL_INVESTIGATION]') ||
      textContent.includes('[COL_CONFIDENTIAL]') ||
      textContent.includes('[CS_CONFIDENTIAL]')
    );

  if (normalizedRole === 'AGENT_SALES' || normalizedRole === 'AGENT') {
    if (isConfidentialNote) {
      return {
        ...message,
        content: typeof message.content === 'object' && message.content !== null
          ? { ...message.content, text: RESTRICTED_MASK_TEXT }
          : RESTRICTED_MASK_TEXT,
        text: RESTRICTED_MASK_TEXT,
        isRedacted: true,
      };
    }
  }

  if (normalizedRole === 'AGENT_CS' && textContent.includes('[COL_CONFIDENTIAL]')) {
    return {
      ...message,
      content: typeof message.content === 'object' && message.content !== null
        ? { ...message.content, text: RESTRICTED_MASK_TEXT }
        : RESTRICTED_MASK_TEXT,
      text: RESTRICTED_MASK_TEXT,
      isRedacted: true,
    };
  }

  if (normalizedRole === 'AGENT_COL' && textContent.includes('[CS_CONFIDENTIAL]')) {
    return {
      ...message,
      content: typeof message.content === 'object' && message.content !== null
        ? { ...message.content, text: RESTRICTED_MASK_TEXT }
        : RESTRICTED_MASK_TEXT,
      text: RESTRICTED_MASK_TEXT,
      isRedacted: true,
    };
  }

  return message;
}

/**
 * Redacts an array of messages or notes.
 */
export function redactMessages(messages: any[], role: string = 'AGENT'): any[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => redactMessage(m, role));
}

/**
 * Checks if the role has EOR privileged access (unmasked EOR fields).
 * Privileged roles: SUPERVISOR, ADMIN, AUDITOR, or AGENT_EOR.
 */
export function isEorPrivilegedRole(role?: string): boolean {
  const normalized = (role || '').trim().toUpperCase();
  return (
    normalized === 'ADMIN' ||
    normalized === 'AUDITOR' ||
    normalized === 'SUPERVISOR' ||
    normalized === 'AGENT_EOR'
  );
}

/**
 * Redacts EOR fields on a case based on user role and queue team.
 * - SUPERVISOR, ADMIN, AUDITOR, AGENT_EOR: provide unmasked access.
 * - AGENT_SALES, AGENT_SOCIAL_MEDIA, AGENT_CS (and other non-EOR frontline roles):
 *   mask EOR fields (eorTicketNumber, sellingStoreName, sellingStoreStaffId, eorMetadata)
 *   with '***-RESTRICTED-***'.
 */
export function redactCaseFields(
  caseData: any,
  role: string = 'AGENT',
  queueTeam?: string
): any {
  if (!caseData) return caseData;
  if (isEorPrivilegedRole(role)) return caseData;

  const cloned = { ...caseData };
  const RESTRICTED_VAL = '***-RESTRICTED-***';

  if ('eorTicketNumber' in cloned && cloned.eorTicketNumber !== null && cloned.eorTicketNumber !== undefined) {
    cloned.eorTicketNumber = RESTRICTED_VAL;
  }
  if ('sellingStoreName' in cloned && cloned.sellingStoreName !== null && cloned.sellingStoreName !== undefined) {
    cloned.sellingStoreName = RESTRICTED_VAL;
  }
  if ('sellingStoreStaffId' in cloned && cloned.sellingStoreStaffId !== null && cloned.sellingStoreStaffId !== undefined) {
    cloned.sellingStoreStaffId = RESTRICTED_VAL;
  }
  if ('eorMetadata' in cloned && cloned.eorMetadata !== null && cloned.eorMetadata !== undefined) {
    cloned.eorMetadata = RESTRICTED_VAL;
  }

  // If caseData contains nested case object (e.g. { case: ... }), redact nested as well
  if (cloned.case && typeof cloned.case === 'object') {
    cloned.case = redactCaseFields(cloned.case, role, queueTeam);
  }

  return cloned;
}

/**
 * Redacts an entire Case record (including its nested messages, audit logs, and EOR fields).
 */
export function redactCase(caseData: any, role: string = 'AGENT'): any {
  if (!caseData) return caseData;
  if (isPrivilegedRole(role)) return caseData;

  let cloned = { ...caseData };

  // Redact EOR fields if not EOR privileged
  cloned = redactCaseFields(cloned, role, cloned.queue?.team);

  if (Array.isArray(cloned.auditLogs)) {
    cloned.auditLogs = redactAuditLogs(cloned.auditLogs, role);
  }

  if (Array.isArray(cloned.messages)) {
    cloned.messages = redactMessages(cloned.messages, role);
  }

  // Mask resolutionNotes if marked confidential
  if (
    cloned.resolutionNotes &&
    (cloned.resolutionNotes.includes('[CONFIDENTIAL]') || cloned.resolutionNotes.includes('[FRAUD]')) &&
    (role === 'AGENT_SALES' || role === 'AGENT')
  ) {
    cloned.resolutionNotes = RESTRICTED_MASK_TEXT;
  }

  return cloned;
}
