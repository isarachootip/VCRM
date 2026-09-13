/**
 * Supervisor Operational Report Export Endpoint (CSV & Excel)
 * Path: src/app/api/reports/export/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateReportRows,
  exportReportCsv,
  exportReportXlsx,
  InvalidDateError,
} from '@/lib/reports/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv').toLowerCase();
    const startDate = searchParams.get('startDate') || searchParams.get('dateFrom') || undefined;
    const endDate = searchParams.get('endDate') || searchParams.get('dateTo') || undefined;
    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const queueId = searchParams.get('queueId') || undefined;

    const rows = await generateReportRows({
      startDate,
      endDate,
      businessUnit,
      queueId,
    });

    const dateTag = new Date().toISOString().split('T')[0];

    if (format === 'xlsx' || format === 'excel') {
      const buffer = exportReportXlsx(rows);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="crm-report-${dateTag}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Default to CSV
    const csvContent = exportReportCsv(rows);
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="crm-report-${dateTag}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    if (error instanceof InvalidDateError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[Report Export] Error exporting report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export report' },
      { status: 500 }
    );
  }
}
