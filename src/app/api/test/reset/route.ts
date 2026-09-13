import { NextRequest, NextResponse } from 'next/server';
import { executeReset } from '@/lib/test/seed-baseline';

export async function DELETE(request: NextRequest) {
  try {
    const result = await executeReset();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Failed to reset test database:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset database' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return DELETE(request);
}
