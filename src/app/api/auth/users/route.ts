import { NextResponse } from 'next/server';
import { listUsers, createUser } from '@/lib/auth/user-store';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('q')?.toLowerCase();
    const role = url.searchParams.get('role')?.toUpperCase();
    const bu = url.searchParams.get('bu')?.toUpperCase();

    let users = listUsers();

    if (role && role !== 'ALL') {
      users = users.filter((u) => u.role === role);
    }

    if (bu && bu !== 'ALL') {
      users = users.filter((u) => u.businessUnits?.some((b) => b.toUpperCase() === bu));
    }

    if (search) {
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.username.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      users,
      total: users.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, email, name, role, businessUnits, password } = body;

    if (!username || !email || !name || !role) {
      return NextResponse.json(
        { success: false, error: 'Username, email, full name, and role are required' },
        { status: 400 }
      );
    }

    const validRoles = ['SYSADMIN', 'ADMIN', 'SUPERVISOR', 'SALES'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role '${role}'. Must be SYSADMIN, ADMIN, SUPERVISOR, or SALES` },
        { status: 400 }
      );
    }

    const result = createUser({
      username,
      email,
      name,
      role,
      businessUnits: Array.isArray(businessUnits) ? businessUnits : ['MUJI'],
      password,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      message: 'User created successfully',
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}

