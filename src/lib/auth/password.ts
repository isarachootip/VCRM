import crypto from 'crypto';

const KEY_LENGTH = 64;

/**
 * Hashes a plain-text password using crypto.scryptSync with a cryptographically secure random salt.
 * Output format: `<salt_hex>:<hash_hex>`
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plain-text password against a stored `<salt_hex>:<hash_hex>` string
 * using constant-time equality comparison to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) {
    return false;
  }

  const storedBuffer = Buffer.from(keyHex, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}
