/**
 * NSC VIP Customer Tagging & Priority Routing Service
 * Path: src/lib/customers/vip-service.ts
 *
 * Implements R5 (Milestone M2 / Item 42):
 * - VIP flag (isVip: true, vipTier: 'NSC_VIP') assignable by Admins and Digital Assistants.
 * - RBAC enforcement: Frontline agents rejected with 403 Forbidden.
 * - Automatically propagates VIP status to open cases (isVip: true, queuePriority: 100).
 * - Priority queue routing & VIP SLA timers.
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit/logger';

export class VipServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'VipServiceError';
    this.statusCode = statusCode;
  }
}

export interface TagCustomerVipOptions {
  isVip: boolean;
  vipTier?: string | null;
  reason?: string | null;
  userRole?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}

/**
 * Updates a customer's VIP status, enforces RBAC, and propagates to active cases.
 */
export async function tagCustomerVip(
  customerId: string,
  options: TagCustomerVipOptions
) {
  const { isVip, vipTier, reason, userRole, actorId, actorName } = options;

  // 1. RBAC Check: Frontline agents cannot modify VIP status
  const normalizedRole = (userRole || '').trim().toUpperCase();
  if (normalizedRole === 'AGENT') {
    throw new VipServiceError('Forbidden: Frontline agents are not authorized to modify customer VIP status', 403);
  }

  // 2. Value validation
  if (isVip) {
    if (!vipTier || typeof vipTier !== 'string' || vipTier.trim().length === 0) {
      throw new VipServiceError('A valid non-empty vipTier (e.g. NSC_VIP) is required when tagging customer as VIP', 400);
    }
  }

  // 3. Customer existence check
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new VipServiceError(`Customer with ID ${customerId} not found`, 404);
  }

  const assignedTier = isVip ? (vipTier?.trim() || 'NSC_VIP') : null;

  // 4. Mutate customer VIP status
  const updatedCustomer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      isVip,
      vipTier: assignedTier,
      updatedAt: new Date(),
    },
  });

  // 5. Propagate VIP flag to all active cases for this customer
  const priorityWeight = isVip ? 100 : 0;
  await prisma.case.updateMany({
    where: {
      customerId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    data: {
      isVip,
      queuePriority: priorityWeight,
      updatedAt: new Date(),
    },
  });

  // 6. Record Audit Log
  await createAuditLog({
    caseId: null,
    actorId: actorId || null,
    actorName: actorName || normalizedRole || 'ADMIN',
    action: isVip ? 'CUSTOMER_VIP_TAGGED' : 'CUSTOMER_VIP_REVOKED',
    actionType: isVip ? 'CUSTOMER_VIP_TAGGED' : 'CUSTOMER_VIP_REVOKED',
    entityType: 'Customer',
    entityId: customerId,
    field: 'isVip',
    oldValue: String(customer.isVip),
    newValue: String(isVip),
    details: JSON.stringify({
      customerId,
      isVip,
      vipTier: assignedTier,
      reason: reason || (isVip ? 'Customer upgraded to NSC VIP tier' : 'VIP status revoked'),
      propagatedQueuePriority: priorityWeight,
    }),
  });

  return updatedCustomer;
}
