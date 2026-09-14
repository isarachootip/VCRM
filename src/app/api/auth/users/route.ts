import { NextResponse } from 'next/server';
import { listUsers } from '@/lib/auth/user-store';

export async function GET() {
  const users = listUsers();
  return NextResponse.json({
    success: true,
    users,
  });
}
