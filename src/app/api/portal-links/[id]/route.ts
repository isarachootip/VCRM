/**
 * Enterprise Operations Portal Link Item REST API Route (R4 / Phase 3)
 * Path: src/app/api/portal-links/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPortalLinkById,
  updatePortalLink,
  deletePortalLink,
  PortalLinkError,
  PortalLinkForbiddenError,
  PortalLinkUnauthorizedError,
  PortalLinkNotFoundError,
  PortalLinkValidationError,
  PortalLinkPayloadTooLargeError,
} from '@/lib/portal-links/service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const link = await getPortalLinkById(params.id);
    if (!link) {
      return NextResponse.json(
        { error: `Portal link '${params.id}' not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, link }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get portal link' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userRole =
      request.headers.get('x-user-role') || request.headers.get('X-User-Role') || null;
    const body = await request.json().catch(() => ({}));

    const link = await updatePortalLink(params.id, body, userRole);

    return NextResponse.json({ success: true, link }, { status: 200 });
  } catch (error: any) {
    if (error instanceof PortalLinkForbiddenError) {
      return NextResponse.json(
        { success: false, error: error.code, code: error.code, message: error.message },
        { status: 403 }
      );
    }
    if (error instanceof PortalLinkUnauthorizedError) {
      return NextResponse.json(
        { success: false, error: error.code, code: error.code, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof PortalLinkNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: 404 }
      );
    }
    if (error instanceof PortalLinkPayloadTooLargeError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: 413 }
      );
    }
    if (error instanceof PortalLinkValidationError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof PortalLinkError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update portal link' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userRole =
      request.headers.get('x-user-role') || request.headers.get('X-User-Role') || null;

    const result = await deletePortalLink(params.id, userRole);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof PortalLinkForbiddenError) {
      return NextResponse.json(
        { success: false, error: error.code, code: error.code, message: error.message },
        { status: 403 }
      );
    }
    if (error instanceof PortalLinkUnauthorizedError) {
      return NextResponse.json(
        { success: false, error: error.code, code: error.code, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof PortalLinkNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: 404 }
      );
    }
    if (error instanceof PortalLinkError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to delete portal link' },
      { status: 500 }
    );
  }
}
