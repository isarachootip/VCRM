import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/user-store';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = body.identifier || body.username || body.email;
    const password = body.password;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Username or email and password are required' },
        { status: 400 }
      );
    }

    const authResult = authenticateUser(identifier, password);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const token = createSessionToken(user);

    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        businessUnits: user.businessUnits,
      },
      token,
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
