/**
 * Real-Time Dashboard Server-Sent Events (SSE) Streaming Route
 * Path: src/app/api/dashboard/stream/route.ts
 */

import { NextRequest } from 'next/server';
import { getDashboardMetrics } from '@/lib/dashboard/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  let isClosed = false;
  let intervalId: NodeJS.Timeout | null = null;

  const safeClose = async () => {
    if (isClosed) return;
    isClosed = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    try {
      await writer.close();
    } catch {
      // Ignored if already closed
    }
  };

  // Safe write helper
  const safeWrite = async (chunk: string): Promise<boolean> => {
    if (isClosed) return false;
    try {
      await writer.write(encoder.encode(chunk));
      return true;
    } catch {
      await safeClose();
      return false;
    }
  };

  // Clean up on client disconnect / signal abort
  request.signal.addEventListener('abort', () => {
    safeClose();
  });

  // 1. Immediately emit initial state snapshot
  (async () => {
    try {
      const initialMetrics = await getDashboardMetrics();
      const initialPayload = JSON.stringify(initialMetrics);
      // Send both plain data and named event for maximum client compatibility
      await safeWrite(`event: SNAPSHOT\ndata: ${initialPayload}\n\n`);
      await safeWrite(`data: ${initialPayload}\n\n`);
    } catch (err: any) {
      console.error('[Dashboard SSE] Failed to send initial metrics:', err);
    }

    // 2. Setup periodic update stream (every 3 seconds) + heartbeat
    intervalId = setInterval(async () => {
      if (isClosed) return;
      try {
        const metrics = await getDashboardMetrics();
        const payload = JSON.stringify(metrics);
        await safeWrite(`event: METRICS_UPDATE\ndata: ${payload}\n\n`);
        await safeWrite(`: heartbeat\n\n`);
      } catch (err: any) {
        console.error('[Dashboard SSE] Periodic push error:', err);
        await safeClose();
      }
    }, 3000);
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Content-Encoding': 'none',
      'X-Accel-Buffering': 'no',
    },
  });
}
