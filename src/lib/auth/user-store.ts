import fs from 'fs';
import path from 'path';
import { hashPassword, verifyPassword } from './password';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'SYSADMIN' | 'ADMIN' | 'SUPERVISOR' | 'SALES';
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
    role: 'SYSADMIN',
    businessUnits: ['MUJI', 'SSP', 'B2S'],
  },
  {
    id: 'user_admin',
    username: 'admin',
    email: 'admin@vcrm.internal',
    name: 'CRM Administrator',
    role: 'ADMIN',
    businessUnits: ['MUJI', 'SSP', 'B2S'],
  },
  {
    id: 'user_manager',
    username: 'manager',
    email: 'manager@vcrm.internal',
    name: 'Sales & Service Manager',
    role: 'SUPERVISOR',
    businessUnits: ['MUJI', 'SSP', 'B2S'],
  },
  {
    id: 'user_sales',
    username: 'sales',
    email: 'sales@vcrm.internal',
    name: 'Sales Executive',
    role: 'SALES',
    businessUnits: ['MUJI', 'SSP', 'B2S'],
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

/**
 * Create a new user
 */
export function createUser(
  data: {
    username: string;
    email: string;
    name: string;
    role: 'SYSADMIN' | 'ADMIN' | 'SUPERVISOR' | 'SALES';
    businessUnits?: string[];
    password?: string;
  }
): { success: boolean; user?: Omit<AuthUser, 'passwordHash'>; error?: string } {
  const { username, email, name, role, businessUnits = ['MUJI'], password } = data;

  if (!username || !email || !name || !role) {
    return { success: false, error: 'Username, email, name, and role are required' };
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  const users = loadUsers();
  for (const existing of Object.values(users)) {
    if (existing.username.toLowerCase() === cleanUsername) {
      return { success: false, error: `Username '${username}' is already taken` };
    }
    if (existing.email.toLowerCase() === cleanEmail) {
      return { success: false, error: `Email '${email}' is already registered` };
    }
  }

  const rawPass = password && password.length >= 6 ? password : 'Password@2026!';
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newUser: AuthUser = {
    id,
    username: username.trim(),
    email: email.trim(),
    name: name.trim(),
    role,
    businessUnits: businessUnits.length > 0 ? businessUnits : ['MUJI'],
    passwordHash: hashPassword(rawPass),
    presence: 'ONLINE',
    createdAt: now,
    updatedAt: now,
  };

  users[id] = newUser;
  saveUsers(users);

  const { passwordHash: _, ...userSafe } = newUser;
  return { success: true, user: userSafe };
}

/**
 * Update user details
 */
export function updateUser(
  id: string,
  updates: {
    name?: string;
    email?: string;
    username?: string;
    role?: 'SYSADMIN' | 'ADMIN' | 'SUPERVISOR' | 'SALES';
    businessUnits?: string[];
    presence?: 'ONLINE' | 'OFFLINE';
    password?: string;
  }
): { success: boolean; user?: Omit<AuthUser, 'passwordHash'>; error?: string } {
  const users = loadUsers();
  const user = users[id];
  if (!user) {
    return { success: false, error: `User with ID '${id}' not found` };
  }

  // Check username uniqueness if changed
  if (updates.username && updates.username.trim().toLowerCase() !== user.username.toLowerCase()) {
    const cleanUsername = updates.username.trim().toLowerCase();
    for (const other of Object.values(users)) {
      if (other.id !== id && other.username.toLowerCase() === cleanUsername) {
        return { success: false, error: `Username '${updates.username}' is already in use` };
      }
    }
    user.username = updates.username.trim();
  }

  // Check email uniqueness if changed
  if (updates.email && updates.email.trim().toLowerCase() !== user.email.toLowerCase()) {
    const cleanEmail = updates.email.trim().toLowerCase();
    for (const other of Object.values(users)) {
      if (other.id !== id && other.email.toLowerCase() === cleanEmail) {
        return { success: false, error: `Email '${updates.email}' is already in use` };
      }
    }
    user.email = updates.email.trim();
  }

  if (updates.name !== undefined) user.name = updates.name.trim();
  if (updates.role !== undefined) user.role = updates.role;
  if (updates.businessUnits !== undefined) user.businessUnits = updates.businessUnits;
  if (updates.presence !== undefined) user.presence = updates.presence;
  if (updates.password && updates.password.length >= 6) {
    user.passwordHash = hashPassword(updates.password);
  }

  user.updatedAt = new Date().toISOString();
  saveUsers(users);

  const { passwordHash: _, ...userSafe } = user;
  return { success: true, user: userSafe };
}

/**
 * Delete a user
 */
export function deleteUser(id: string): { success: boolean; error?: string } {
  const users = loadUsers();
  const target = users[id];
  if (!target) {
    return { success: false, error: `User with ID '${id}' not found` };
  }

  // Prevent deleting the last SYSADMIN or last ADMIN
  if (target.role === 'SYSADMIN') {
    const sysadminCount = Object.values(users).filter((u) => u.role === 'SYSADMIN').length;
    if (sysadminCount <= 1) {
      return { success: false, error: 'Cannot delete the only remaining System Administrator account' };
    }
  }
  if (target.role === 'ADMIN') {
    const adminCount = Object.values(users).filter((u) => u.role === 'ADMIN').length;
    if (adminCount <= 1) {
      return { success: false, error: 'Cannot delete the only remaining CRM Administrator account' };
    }
  }

  delete users[id];
  saveUsers(users);
  return { success: true };
}


