import crypto from 'crypto';

/**
 * Validate LINE webhook x-line-signature
 * @param body Raw string body received in HTTP POST request
 * @param signature Value from x-line-signature header
 * @param channelSecret The LINE channel secret
 */
export function verifyLineSignature(body: string, signature: string | null, channelSecret: string): boolean {
  if (!signature || !channelSecret) {
    // If channel secret is not yet configured, allow bypass or return false
    return false;
  }

  try {
    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(body, 'utf-8')
      .digest('base64');

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}
