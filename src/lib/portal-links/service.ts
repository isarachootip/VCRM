/**
 * Enterprise Operations Portal Link Hub Service Layer & RBAC (R4 / Phase 3)
 * Path: src/lib/portal-links/service.ts
 */

import { prisma } from '@/lib/db';

export class PortalLinkError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'PORTAL_LINK_ERROR'
  ) {
    super(message);
    this.name = 'PortalLinkError';
  }
}

export class PortalLinkForbiddenError extends PortalLinkError {
  constructor(message: string = 'Frontline agents have read-only access to portal links') {
    super(message, 403, 'PORTAL_LINK_MUTATION_RESTRICTED');
    this.name = 'PortalLinkForbiddenError';
  }
}

export class PortalLinkUnauthorizedError extends PortalLinkError {
  constructor(message: string = 'Authentication required for portal link mutation') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'PortalLinkUnauthorizedError';
  }
}

export class PortalLinkNotFoundError extends PortalLinkError {
  constructor(id: string) {
    super(`Portal link '${id}' not found`, 404, 'PORTAL_LINK_NOT_FOUND');
    this.name = 'PortalLinkNotFoundError';
  }
}

export class PortalLinkValidationError extends PortalLinkError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'PortalLinkValidationError';
  }
}

export class PortalLinkPayloadTooLargeError extends PortalLinkError {
  constructor(message: string) {
    super(message, 413, 'PAYLOAD_TOO_LARGE');
    this.name = 'PortalLinkPayloadTooLargeError';
  }
}

export interface PortalLinkItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
  icon: string | null;
  category: string | null;
  businessUnits: string[];
  allowedRoles: string[];
  order: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePortalLinkInput {
  title: string;
  url: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  businessUnits?: string[];
  allowedRoles?: string[];
  order?: number;
  isActive?: boolean;
  createdBy?: string | null;
}

export interface UpdatePortalLinkInput {
  title?: string;
  url?: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  businessUnits?: string[];
  allowedRoles?: string[];
  order?: number;
  isActive?: boolean;
}

export interface ListPortalLinksOptions {
  bu?: string | null;
  businessUnit?: string | null;
  activeOnly?: boolean | string;
  userRole?: string | null;
}

function assertMutationRole(userRole?: string | null): void {
  if (!userRole || !userRole.trim()) {
    throw new PortalLinkUnauthorizedError();
  }
  const role = userRole.trim().toUpperCase();
  if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
    throw new PortalLinkForbiddenError();
  }
}

function isValidUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Lists portal links with BU filtering and display order sorting
 */
export async function listPortalLinks(
  options?: ListPortalLinksOptions
): Promise<{ success: boolean; links: PortalLinkItem[]; total: number }> {
  const activeOnly = options?.activeOnly !== false && options?.activeOnly !== 'false';
  const targetBu = options?.bu || options?.businessUnit || null;
  const targetRole = options?.userRole ? options.userRole.trim().toUpperCase() : null;

  const where: any = {};
  if (activeOnly) {
    where.isActive = true;
  }

  const links = await prisma.portalLink.findMany({
    where,
    orderBy: [
      { order: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // Filter in memory for BU scoping and role restrictions
  const filtered = links.filter((link) => {
    // BU Scoping:
    // If businessUnits is empty, it is universally accessible across all BUs (T2.4.6)
    if (targetBu) {
      if (link.businessUnits && link.businessUnits.length > 0) {
        const matchesBu = link.businessUnits.some(
          (b) => b.toUpperCase() === targetBu.toUpperCase()
        );
        if (!matchesBu) {
          return false;
        }
      }
    }

    // Role filtering:
    if (targetRole && link.allowedRoles && link.allowedRoles.length > 0) {
      const matchesRole = link.allowedRoles.some(
        (r) => r.toUpperCase() === targetRole
      );
      if (!matchesRole) {
        return false;
      }
    }

    return true;
  });

  return {
    success: true,
    links: filtered,
    total: filtered.length,
  };
}

/**
 * Creates an enterprise portal link (Admin & Supervisor only)
 */
export async function createPortalLink(
  input: CreatePortalLinkInput,
  userRole?: string | null
): Promise<PortalLinkItem> {
  assertMutationRole(userRole);

  // Validate Title
  if (!input.title || typeof input.title !== 'string' || !input.title.trim()) {
    throw new PortalLinkValidationError('Portal link title is required and cannot be empty');
  }
  if (input.title.length > 2000) {
    throw new PortalLinkPayloadTooLargeError('Portal link title exceeds maximum length of 2,000 characters');
  }

  // Validate URL
  if (!input.url || typeof input.url !== 'string' || !input.url.trim()) {
    throw new PortalLinkValidationError('Portal link URL is required and cannot be empty');
  }
  if (input.url.length > 2000) {
    throw new PortalLinkPayloadTooLargeError('Portal link URL exceeds maximum length of 2,000 characters');
  }
  if (!isValidUrl(input.url)) {
    throw new PortalLinkValidationError(`Invalid portal link URL: "${input.url}". Must be a valid HTTP or HTTPS URL.`);
  }

  // Normalize order (safe for negative numbers)
  const order = input.order !== undefined && Number.isFinite(Number(input.order))
    ? Math.floor(Number(input.order))
    : 0;

  const link = await prisma.portalLink.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      url: input.url.trim(),
      icon: input.icon?.trim() || 'external-link',
      category: (input.category || 'GENERAL').toUpperCase(),
      businessUnits: Array.isArray(input.businessUnits) ? input.businessUnits : [],
      allowedRoles: Array.isArray(input.allowedRoles) ? input.allowedRoles : [],
      order,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
      createdBy: input.createdBy || userRole || null,
    },
  });

  return link;
}

/**
 * Updates an existing portal link (Admin & Supervisor only)
 */
export async function updatePortalLink(
  id: string,
  input: UpdatePortalLinkInput,
  userRole?: string | null
): Promise<PortalLinkItem> {
  assertMutationRole(userRole);

  const existing = await prisma.portalLink.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new PortalLinkNotFoundError(id);
  }

  const updateData: any = {};

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || !input.title.trim()) {
      throw new PortalLinkValidationError('Portal link title cannot be empty');
    }
    if (input.title.length > 2000) {
      throw new PortalLinkPayloadTooLargeError('Portal link title exceeds maximum length of 2,000 characters');
    }
    updateData.title = input.title.trim();
  }

  if (input.url !== undefined) {
    if (typeof input.url !== 'string' || !input.url.trim()) {
      throw new PortalLinkValidationError('Portal link URL cannot be empty');
    }
    if (input.url.length > 2000) {
      throw new PortalLinkPayloadTooLargeError('Portal link URL exceeds maximum length of 2,000 characters');
    }
    if (!isValidUrl(input.url)) {
      throw new PortalLinkValidationError(`Invalid portal link URL: "${input.url}". Must be a valid HTTP or HTTPS URL.`);
    }
    updateData.url = input.url.trim();
  }

  if (input.description !== undefined) {
    updateData.description = input.description ? input.description.trim() : null;
  }

  if (input.icon !== undefined) {
    updateData.icon = input.icon ? input.icon.trim() : null;
  }

  if (input.category !== undefined) {
    updateData.category = input.category ? input.category.toUpperCase() : 'GENERAL';
  }

  if (input.businessUnits !== undefined) {
    updateData.businessUnits = Array.isArray(input.businessUnits) ? input.businessUnits : [];
  }

  if (input.allowedRoles !== undefined) {
    updateData.allowedRoles = Array.isArray(input.allowedRoles) ? input.allowedRoles : [];
  }

  if (input.order !== undefined) {
    updateData.order = Number.isFinite(Number(input.order)) ? Math.floor(Number(input.order)) : 0;
  }

  if (input.isActive !== undefined) {
    updateData.isActive = Boolean(input.isActive);
  }

  const updated = await prisma.portalLink.update({
    where: { id },
    data: updateData,
  });

  return updated;
}

/**
 * Soft-deletes (archives) or removes a portal link (Admin & Supervisor only)
 */
export async function deletePortalLink(
  id: string,
  userRole?: string | null,
  hardDelete: boolean = false
): Promise<{ success: boolean; archived: boolean; link: PortalLinkItem }> {
  assertMutationRole(userRole);

  const existing = await prisma.portalLink.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new PortalLinkNotFoundError(id);
  }

  if (hardDelete) {
    const deleted = await prisma.portalLink.delete({
      where: { id },
    });
    return { success: true, archived: false, link: deleted };
  }

  const archived = await prisma.portalLink.update({
    where: { id },
    data: {
      isActive: false,
    },
  });

  return {
    success: true,
    archived: true,
    link: archived,
  };
}

/**
 * Retrieves a portal link by ID
 */
export async function getPortalLinkById(id: string): Promise<PortalLinkItem | null> {
  return prisma.portalLink.findUnique({
    where: { id },
  });
}
