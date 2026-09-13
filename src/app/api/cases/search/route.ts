/**
 * API Route: /api/cases/search
 * Path: src/app/api/cases/search/route.ts
 *
 * Implements Multi-Criteria Case & Opportunity Search (Phase 1 R4):
 * - Search by Customer Name, Phone, LINE User ID, Case Number, Quotation Number,
 *   POS Ticket Number, Tracking Number, Business Unit, Status, and Channel.
 * - Supports combined keyword matching across relational Prisma entities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listCases, ListCasesParams } from '@/lib/cases/service';
import { redactCase, getUserRole } from '@/lib/audit/redactor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q') || searchParams.get('search') || undefined;
    const customerName = searchParams.get('customerName') || undefined;
    const phone = searchParams.get('phone') || undefined;
    const lineUserId = searchParams.get('lineUserId') || undefined;
    const caseNumber = searchParams.get('caseNumber') || undefined;
    const quotationNumber = searchParams.get('quotationNumber') || undefined;
    const ticketNumber = searchParams.get('ticketNumber') || undefined;
    const trackingNumber = searchParams.get('trackingNumber') || undefined;
    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const status = searchParams.get('status') || undefined;
    const channel = searchParams.get('channel') || undefined;
    const ownerId = searchParams.get('ownerId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';
    const orderBy = (searchParams.get('orderBy') as any) || undefined;
    const orderDir = (searchParams.get('orderDir') as any) || undefined;

    const params: ListCasesParams = {
      q,
      search: q,
      customerName,
      phone,
      lineUserId,
      caseNumber,
      quotationNumber,
      ticketNumber,
      trackingNumber,
      businessUnit,
      status,
      channel,
      ownerId,
      dateFrom,
      dateTo,
      page,
      limit,
      orderBy,
      orderDir,
    };

    const result = await listCases(params);

    // Apply role-based field redaction if caller role is restricted
    const role = getUserRole(request);
    const redactedCases = result.cases.map((c) => redactCase(c, role));

    return NextResponse.json(
      {
        success: true,
        cases: redactedCases,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error executing case search:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search cases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const q = body.q || body.search || undefined;
    const params: ListCasesParams = {
      q,
      search: q,
      customerName: body.customerName,
      phone: body.phone,
      lineUserId: body.lineUserId,
      caseNumber: body.caseNumber,
      quotationNumber: body.quotationNumber,
      ticketNumber: body.ticketNumber,
      trackingNumber: body.trackingNumber,
      businessUnit: body.businessUnit || body.bu,
      status: body.status,
      channel: body.channel,
      ownerId: body.ownerId,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      page: body.page || '1',
      limit: body.limit || '20',
      orderBy: body.orderBy,
      orderDir: body.orderDir,
    };

    const result = await listCases(params);

    const role = getUserRole(request);
    const redactedCases = result.cases.map((c) => redactCase(c, role));

    return NextResponse.json(
      {
        success: true,
        cases: redactedCases,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error executing case search POST:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search cases' },
      { status: 500 }
    );
  }
}
