import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'crm-nextjs',
    timestamp: new Date().toISOString(),
  });
}
