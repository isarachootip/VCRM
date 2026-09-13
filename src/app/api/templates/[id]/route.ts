/**
 * API Route: /api/templates/[id]
 * Path: src/app/api/templates/[id]/route.ts
 *
 * Implements Template detail, update, and delete (Phase 1 R4).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} from '@/lib/templates/service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await getTemplateById(params.id);
    if (!template) {
      return NextResponse.json(
        { error: `Template "${params.id}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        template,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error retrieving template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve template' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleUpdate(request, params.id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleUpdate(request, params.id);
}

async function handleUpdate(request: NextRequest, id: string) {
  try {
    const body = await request.json().catch(() => ({}));
    const updated = await updateTemplate(id, body);

    if (!updated) {
      return NextResponse.json(
        { error: `Template "${id}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        template: updated,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await deleteTemplate(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: `Template "${params.id}" not found or cannot be deleted` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        deleted: true,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}
