/**
 * Enterprise Operations Portal Link Hub REST API Route (R4 / Phase 3)
 * Path: src/app/api/portal-links/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listPortalLinks,
  createPortalLink,
  PortalLinkError,
  PortalLinkForbiddenError,
  PortalLinkUnauthorizedError,
  PortalLinkValidationError,
  PortalLinkPayloadTooLargeError,
} from '@/lib/portal-links/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bu = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const userRole = request.headers.get('x-user-role') || request.headers.get('X-User-Role') || undefined;

    const result = await listPortalLinks({
      bu,
      activeOnly,
      userRole,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to list portal links' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userRole =
      request.headers.get('x-user-role') || request.headers.get('X-User-Role') || null;

    const body = await request.json().catch(() => ({}));

    const link = await createPortalLink(body, userRole);

    return NextResponse.json(
      {
        success: true,
        link,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof PortalLinkForbiddenError) {
      return NextResponse.json(
        {
          success: false,
          error: error.code,
          code: error.code,
          message: error.message,
        },
        { status: 403 }
      );
    }

    if (error instanceof PortalLinkUnauthorizedError) {
      return NextResponse.json(
        {
          success: false,
          error: error.code,
          code: error.code,
          message: error.message,
        },
        { status: 401 }
      );
    }

    if (error instanceof PortalLinkPayloadTooLargeError) {
      return NextResponse.json(
        {
          success: false,
          error: error.code,
          code: error.code,
          message: error.message,
        },
        { status: 413 }
      );
    }

    if (error instanceof PortalLinkValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.code,
          code: error.code,
          message: error.message,
        },
        { status: 400 }
      );
    }

    if (error instanceof PortalLinkError) {
      return NextResponse.json(
        {
          success: false,
          error: error.code,
          code: error.code,
          message: error.message,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create portal link' },
      { status: 500 }
    );
  }
}
