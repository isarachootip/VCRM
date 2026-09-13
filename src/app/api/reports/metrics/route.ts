/**
 * Supervisor Reporting Metrics REST Endpoint
 * Path: src/app/api/reports/metrics/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReportMetrics, InvalidDateError } from '@/lib/reports/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || searchParams.get('dateFrom') || undefined;
    const endDate = searchParams.get('endDate') || searchParams.get('dateTo') || undefined;
    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const queueId = searchParams.get('queueId') || undefined;

    const metrics = await getReportMetrics({
      startDate,
      endDate,
      businessUnit,
      queueId,
    });

    return NextResponse.json(metrics);
  } catch (error: any) {
    if (error instanceof InvalidDateError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[Report Metrics] Error generating report metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report metrics' },
      { status: 500 }
    );
  }
}
