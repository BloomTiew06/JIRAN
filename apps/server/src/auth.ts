import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Prototype session tokens: residentId.expiry.signature (HMAC-SHA256).
 * In production JIRAN would trust the Sime Darby Property app's own login
 * (the app passes its session to the JIRAN tab), so residents never sign in twice.
 */
const DAY = 24 * 60 * 60 * 1000;

export function signToken(residentId: string, secret: string, ttlMs = 30 * DAY): string {
  const exp = Date.now() + ttlMs;
  const body = `${Buffer.from(residentId).toString('base64url')}.${exp}`;
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id64, exp, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${id64}.${exp}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now()) return null;
  return Buffer.from(id64, 'base64url').toString();
}
