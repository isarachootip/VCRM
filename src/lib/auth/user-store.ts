import fs from 'fs';
import path from 'path';
import { hashPassword, verifyPassword } from './password';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
  businessUnits: string[];
  passwordHash: string;
  presence?: 'ONLINE' | 'OFFLINE';
  createdAt: string;
  updatedAt: string;
}

const USERS_FILE = path.join(process.cwd(), 'users.json');

// Default initial user definitions
export const DEFAULT_USERS: Omit<AuthUser, 'passwordHash' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'user_sysadmin',
    username: 'sysadmin',
    email: 'sysadmin@vcrm.internal',
    name: 'System Administrator',
    role: 'ADMIN',
    businessUnits: ['CENTRAL', 'CDS', 'CENTRAL_BEAUTY_CLUB', 'MUJI', 'SSP', 'B2S'],
  },
  {
    id: 'user_admin',
    username: 'admin',
    email: 'admin@vcrm.internal',
    name: 'CRM Administrator',
    role: 'ADMIN',
    businessUnits: ['CENTRAL', 'CDS', 'CENTRAL_BEAUTY_CLUB', 'MUJI', 'SSP', 'B2S'],
  },
  {
    id: 'user_manager',
    username: 'manager',
    email: 'manager@vcrm.internal',
    name: 'Sales & Service Manager',
    role: 'SUPERVISOR',
    businessUnits: ['CENTRAL', 'CDS', 'CENTRAL_BEAUTY_CLUB', 'MUJI', 'SSP', 'B2S'],
  },
  {
    id: 'user_sales',
    username: 'sales',
    email: 'sales@vcrm.internal',
    name: 'Sales Executive',
    role: 'AGENT',
    businessUnits: ['CENTRAL', 'CDS', 'CENTRAL_BEAUTY_CLUB'],
  },
];

export const DEFAULT_PASSWORDS: Record<string, string> = {
  sysadmin: 'SysAdmin@2026!',
  admin: 'Admin@2026!',
  manager: 'Manager@2026!',
  sales: 'Sales@2026!',
};

function initializeDefaultUsers(): Record<string, AuthUser> {
  const users: Record<string, AuthUser> = {};
  const now = new Date().toISOString();

  for (const def of DEFAULT_USERS) {
    const rawPass = DEFAULT_PASSWORDS[def.username] || 'Password@2026!';
    users[def.id] = {
      ...def,
      passwordHash: hashPassword(rawPass),
      presence: 'ONLINE',
      createdAt: now,
      updatedAt: now,
    };
  }

  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write users.json:', err);
  }

  return users;
}

export function loadUsers(): Record<string, AuthUser> {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading users.json, re-initializing defaults:', err);
  }

  return initializeDefaultUsers();
}

export function saveUsers(users: Record<string, AuthUser>): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving users.json:', err);
  }
}

/**
 * Find user by username or email (case-insensitive)
 */
export function findUserByIdentifier(identifier: string): AuthUser | null {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  const users = loadUsers();

  for (const user of Object.values(users)) {
    if (
      user.username.toLowerCase() === clean ||
      user.email.toLowerCase() === clean
    ) {
      return user;
    }
  }

  return null;
}

/**
 * Find user by ID
 */
export function findUserById(id: string): AuthUser | null {
  if (!id) return null;
  const users = loadUsers();
  return users[id] || null;
}

/**
 * Authenticate by identifier (username or email) and plain password
 */
export function authenticateUser(
  identifier: string,
  plainPassword: string
): { success: boolean; user?: Omit<AuthUser, 'passwordHash'>; error?: string } {
  const user = findUserByIdentifier(identifier);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const isValid = verifyPassword(plainPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid password' };
  }

  const { passwordHash: _, ...userSafe } = user;
  return { success: true, user: userSafe };
}

/**
 * Update user password
 */
export function updateUserPassword(id: string, newPlainPassword: string): boolean {
  const users = loadUsers();
  const user = users[id];
  if (!user) return false;

  user.passwordHash = hashPassword(newPlainPassword);
  user.updatedAt = new Date().toISOString();
  saveUsers(users);
  return true;
}

/**
 * List all users (excluding password hashes)
 */
export function listUsers(): Omit<AuthUser, 'passwordHash'>[] {
  const users = loadUsers();
  return Object.values(users).map(({ passwordHash: _, ...safe }) => safe);
}
