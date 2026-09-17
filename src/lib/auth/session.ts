import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'vcrm_enterprise_session_secret_2026_monday_crm';
export const SESSION_COOKIE_NAME = 'vcrm_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: string;
  businessUnits?: string[];
  issuedAt: number;
  expiresAt: number;
}

/**
 * Creates a signed token string: base64(payload).signature
 */
export function createSessionToken(user: {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  businessUnits?: string[];
}): string {
  const now = Date.now();
  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    businessUnits: user.businessUnits || ['MUJI'],
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies a signed session token. Returns the decoded SessionPayload or null if invalid/expired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  const expectedBuf = Buffer.from(expectedSignature);
  const actualBuf = Buffer.from(signature);

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson) as SessionPayload;

    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
