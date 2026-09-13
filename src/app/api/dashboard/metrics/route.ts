/**
 * REST Endpoint: Current Dashboard Metrics Snapshot
 * Path: src/app/api/dashboard/metrics/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/dashboard/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const metrics = await getDashboardMetrics();
    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('[Dashboard Metrics] Error fetching metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
