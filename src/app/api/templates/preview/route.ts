/**
 * API Route: POST /api/templates/preview
 * Path: src/app/api/templates/preview/route.ts
 *
 * Implements WYSIWYG Template Message Preview (Phase 1 R4).
 * Resolves tokens like {{customerName}}, {{quotationNumber}}, {{grandTotal}}, {{paymentLink}}
 * against real Case and Quotation records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { previewTemplate } from '@/lib/templates/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await previewTemplate({
      templateId: body.templateId,
      templateText: body.templateText || body.content,
      content: body.content,
      caseId: body.caseId,
      quotationId: body.quotationId,
      variables: body.variables,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error previewing template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate template preview' },
      { status: 500 }
    );
  }
}
