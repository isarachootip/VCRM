import { NextResponse } from 'next/server';
import { findUserById, updateUser, deleteUser } from '@/lib/auth/user-store';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = findUserById(params.id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { passwordHash: _, ...safeUser } = user;
    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, email, username, role, businessUnits, presence, password } = body;

    const result = updateUser(params.id, {
      name,
      email,
      username,
      role,
      businessUnits,
      presence,
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
      message: 'User updated successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = deleteUser(params.id);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}