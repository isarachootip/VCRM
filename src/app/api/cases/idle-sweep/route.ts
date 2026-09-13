import { NextRequest, NextResponse } from 'next/server';
import { sweepIdleChats, validateSweepThresholds } from '@/lib/cases/idle-sweep';

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    const raw = await request.text();
    if (raw.trim()) {
      body = JSON.parse(raw);
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const {
    idleWarningThresholdMinutes,
    idleCloseThresholdMinutes,
    simulatedElapsedMinutes,
    dryRun,
  } = body;

  const warnMin = idleWarningThresholdMinutes !== undefined ? Number(idleWarningThresholdMinutes) : 50;
  const closeMin = idleCloseThresholdMinutes !== undefined ? Number(idleCloseThresholdMinutes) : 60;

  try {
    validateSweepThresholds(warnMin, closeMin);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    const result = await sweepIdleChats({
      idleWarningThresholdMinutes: warnMin,
      idleCloseThresholdMinutes: closeMin,
      simulatedElapsedMinutes: simulatedElapsedMinutes !== undefined ? Number(simulatedElapsedMinutes) : null,
      dryRun: Boolean(dryRun),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('Error executing idle sweep:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error during idle sweep' },
      { status: 500 }
    );
  }
}
