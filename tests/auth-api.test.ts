import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { POST as loginRoute } from '../src/app/api/auth/login/route';
import { POST as logoutRoute } from '../src/app/api/auth/logout/route';
import { POST as resetPasswordRoute } from '../src/app/api/auth/reset-password/route';
import { GET as usersRoute } from '../src/app/api/auth/users/route';

describe('VCRM Auth API Endpoints Unit Tests', () => {
  test('POST /api/auth/login with valid credentials sets cookie and returns user', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sysadmin',
        password: 'SysAdmin@2026!',
      }),
    });

    const res = await loginRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.username, 'sysadmin');
    assert.equal(data.user.role, 'SYSADMIN');
    assert.ok(data.token, 'Token must be present in response');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('vcrm_session'), 'Set-Cookie header must be present');
  });

  test('POST /api/auth/login with invalid credentials returns 401', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sales',
        password: 'WrongPassword!',
      }),
    });

    const res = await loginRoute(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'Invalid password');
  });

  test('POST /api/auth/logout clears cookie', async () => {
    const res = await logoutRoute();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('Max-Age=0'), 'Cookie must be invalidated with Max-Age=0');
  });

  test('POST /api/auth/reset-password updates password', async () => {
    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUsername: 'manager',
        currentPassword: 'Manager@2026!',
        newPassword: 'ManagerUpdated@2026!',
      }),
    });

    const res = await resetPasswordRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    // Revert back
    const revertReq = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUsername: 'manager',
        currentPassword: 'ManagerUpdated@2026!',
        newPassword: 'Manager@2026!',
      }),
    });
    const revertRes = await resetPasswordRoute(revertReq);
    assert.equal(revertRes.status, 200);
  });

  test('GET /api/auth/users lists all accounts without passwordHash', async () => {
    const req = new Request('http://localhost:3000/api/auth/users');
    const res = await usersRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.users.length >= 4);

    const usernames = data.users.map((u: any) => u.username);
    assert.ok(usernames.includes('sysadmin'));
    assert.ok(usernames.includes('admin'));
    assert.ok(usernames.includes('manager'));
    assert.ok(usernames.includes('sales'));

    for (const u of data.users) {
      assert.equal(u.passwordHash, undefined);
    }
  });

  test('GET /api/auth/me returns authenticated user with valid token', async () => {
    const { GET: meRoute } = await import('../src/app/api/auth/me/route');
    const { createSessionToken } = await import('../src/lib/auth/session');
    const { findUserByIdentifier } = await import('../src/lib/auth/user-store');

    const admin = findUserByIdentifier('admin')!;
    const token = createSessionToken(admin);

    const req = new Request('http://localhost:3000/api/auth/me', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const res = await meRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.authenticated, true);
    assert.equal(data.user.username, 'admin');
    assert.equal(data.user.role, 'ADMIN');
  });

  test('User CRUD operations (create, update, delete)', async () => {
    const { POST: createUserRoute } = await import('../src/app/api/auth/users/route');
    const { PUT: updateUserRoute, DELETE: deleteUserRoute } = await import('../src/app/api/auth/users/[id]/route');

    // 1. Create User
    const createReq = new Request('http://localhost:3000/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test_agent_2026',
        name: 'Test Agent 2026',
        email: 'testagent2026@central.co.th',
        role: 'SALES',
        businessUnits: ['MUJI', 'SSP'],
        password: 'TestPassword@2026!',
      }),
    });
    const createRes = await createUserRoute(createReq);
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    assert.equal(createData.user.username, 'test_agent_2026');
    assert.equal(createData.user.role, 'SALES');
    const newUserId = createData.user.id;

    // 2. Update User
    const updateReq = new Request(`http://localhost:3000/api/auth/users/${newUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Test Agent 2026',
        role: 'SUPERVISOR',
        businessUnits: ['MUJI', 'SSP', 'B2S'],
      }),
    });
    const updateRes = await updateUserRoute(updateReq, { params: { id: newUserId } });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.success, true);
    assert.equal(updateData.user.name, 'Updated Test Agent 2026');
    assert.equal(updateData.user.role, 'SUPERVISOR');

    // 3. Delete User
    const deleteReq = new Request(`http://localhost:3000/api/auth/users/${newUserId}`, {
      method: 'DELETE',
    });
    const deleteRes = await deleteUserRoute(deleteReq, { params: { id: newUserId } });
    assert.equal(deleteRes.status, 200);
    const deleteData = await deleteRes.json();
    assert.equal(deleteData.success, true);
  });
});

