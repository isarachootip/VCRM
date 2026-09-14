import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { 
  findUserById, 
  findUserByIdentifier, 
  updateUserPassword, 
  authenticateUser 
} from '@/lib/auth/user-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetUsername, currentPassword, newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Identify actor from request headers or next/headers
    let token: string | undefined;
    let actorRole: string | undefined;

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match) token = match[1];
    }

    const authHeader = request.headers.get('authorization');
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    const roleHeader = request.headers.get('x-user-role');
    if (roleHeader) {
      actorRole = roleHeader.toUpperCase();
    }

    if (!token) {
      try {
        const cookieStore = cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {
        // Fallback for non-Next context
      }
    }

    const session = token ? verifySessionToken(token) : null;
    if (!actorRole && session) {
      actorRole = session.role;
    }

    // If target username provided and actor is ADMIN
    if (targetUsername && (actorRole === 'ADMIN' || actorRole === 'SYSADMIN')) {
      const targetUser = findUserByIdentifier(targetUsername);
      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: `Target user '${targetUsername}' not found` },
          { status: 404 }
        );
      }
      updateUserPassword(targetUser.id, newPassword);
      return NextResponse.json({
        success: true,
        message: `Password updated successfully for ${targetUser.username}`,
      });
    }

    // Self-service password change
    if (!session) {
      // Unauthenticated self-change requires currentPassword and targetUsername
      if (!targetUsername || !currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Authentication or current password required' },
          { status: 401 }
        );
      }
      const auth = authenticateUser(targetUsername, currentPassword);
      if (!auth.success || !auth.user) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 401 }
        );
      }
      updateUserPassword(auth.user.id, newPassword);
      return NextResponse.json({
        success: true,
        message: `Password updated successfully for ${auth.user.username}`,
      });
    }

    // Session authenticated: if currentPassword provided, verify it
    if (currentPassword) {
      const user = findUserById(session.userId);
      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }
      const auth = authenticateUser(user.username, currentPassword);
      if (!auth.success) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 401 }
        );
      }
    }

    updateUserPassword(session.userId, newPassword);
    return NextResponse.json({
      success: true,
      message: 'Your password has been updated successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
