/**
 * API Route: /api/templates
 * Path: src/app/api/templates/route.ts
 *
 * Implements Template Message Listing and Creation (Phase 1 R4).
 */

import { NextRequest, NextResponse } from 'next/server';
import { listTemplates, createTemplate } from '@/lib/templates/service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const channel = searchParams.get('channel') || undefined;

    const templates = await listTemplates({ category, businessUnit, channel });

    return NextResponse.json(
      {
        success: true,
        templates,
        total: templates.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.name || !body.content) {
      return NextResponse.json(
        { error: 'Template name and content are required' },
        { status: 400 }
      );
    }

    const newTemplate = await createTemplate({
      name: body.name,
      content: body.content,
      category: body.category || 'GENERAL',
      businessUnit: body.businessUnit || 'Central',
      channel: body.channel || 'ALL',
      description: body.description || '',
    });

    return NextResponse.json(
      {
        success: true,
        template: newTemplate,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}
