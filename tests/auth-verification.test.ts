import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { hashPassword, verifyPassword } from '../src/lib/auth/password';
import { createSessionToken, verifySessionToken } from '../src/lib/auth/session';
import { 
  authenticateUser, 
  findUserByIdentifier, 
  updateUserPassword, 
  listUsers, 
  DEFAULT_PASSWORDS 
} from '../src/lib/auth/user-store';

describe('VCRM User Password & Authentication Verification', () => {
  test('1. Password Hashing & Verification', () => {
    const raw = 'SysAdmin@2026!';
    const hashed = hashPassword(raw);

    assert.ok(hashed.includes(':'), 'Hash must contain salt delimiter');
    assert.equal(verifyPassword(raw, hashed), true, 'Valid password must verify');
    assert.equal(verifyPassword('WrongPassword!', hashed), false, 'Invalid password must fail');
  });

  test('2. Verify All 4 Seed Accounts Can Authenticate with Default Passwords', () => {
    const accounts = ['sysadmin', 'admin', 'manager', 'sales'];

    for (const username of accounts) {
      const expectedPass = DEFAULT_PASSWORDS[username];
      assert.ok(expectedPass, `Password definition for ${username} must exist`);

      // Test login with username
      const resultByUsername = authenticateUser(username, expectedPass);
      assert.equal(resultByUsername.success, true, `${username} must authenticate by username`);
      assert.equal(resultByUsername.user?.username, username);

      // Test login with email
      const user = findUserByIdentifier(username);
      assert.ok(user, `User ${username} must be found`);
      const resultByEmail = authenticateUser(user.email, expectedPass);
      assert.equal(resultByEmail.success, true, `${username} must authenticate by email (${user.email})`);

      // Test rejection of incorrect password
      const failedResult = authenticateUser(username, 'IncorrectPassword123');
      assert.equal(failedResult.success, false, `${username} must reject incorrect password`);
      assert.equal(failedResult.error, 'Invalid password');
    }
  });

  test('3. Verify Correct RBAC Roles Assigned', () => {
    const sysadmin = findUserByIdentifier('sysadmin');
    const admin = findUserByIdentifier('admin');
    const manager = findUserByIdentifier('manager');
    const sales = findUserByIdentifier('sales');

    assert.equal(sysadmin?.role, 'ADMIN');
    assert.equal(admin?.role, 'ADMIN');
    assert.equal(manager?.role, 'SUPERVISOR');
    assert.equal(sales?.role, 'AGENT');
  });

  test('4. Session Token Signing & Validation', () => {
    const user = findUserByIdentifier('sales')!;
    const token = createSessionToken(user);
    assert.ok(token && token.includes('.'), 'Token must have signed structure');

    const payload = verifySessionToken(token);
    assert.ok(payload, 'Session token must decode successfully');
    assert.equal(payload.username, 'sales');
    assert.equal(payload.role, 'AGENT');

    // Tampered token test
    const tampered = token.slice(0, -3) + 'abc';
    assert.equal(verifySessionToken(tampered), null, 'Tampered token must fail validation');
  });

  test('5. Password Update Self-Service & Admin Reset', () => {
    const user = findUserByIdentifier('sales')!;
    const newPass = 'NewSalesPass@2026!';

    // Update password
    const updated = updateUserPassword(user.id, newPass);
    assert.equal(updated, true, 'Password update must succeed');

    // Verify new password works
    const newAuth = authenticateUser('sales', newPass);
    assert.equal(newAuth.success, true, 'New password must authenticate');

    // Verify old password fails
    const oldAuth = authenticateUser('sales', DEFAULT_PASSWORDS['sales']);
    assert.equal(oldAuth.success, false, 'Old password must fail');

    // Revert password back to default
    updateUserPassword(user.id, DEFAULT_PASSWORDS['sales']);
    const revertedAuth = authenticateUser('sales', DEFAULT_PASSWORDS['sales']);
    assert.equal(revertedAuth.success, true, 'Reverted password must authenticate');
  });

  test('6. List Users Without Exposing Hashes', () => {
    const users = listUsers();
    assert.equal(users.length >= 4, true, 'Must have at least 4 users');
    for (const u of users) {
      assert.equal((u as any).passwordHash, undefined, 'Password hash must never be returned in safe user list');
    }
  });
});
