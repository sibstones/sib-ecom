import crypto from 'crypto';
import { config } from '../config/env';

const PURPOSE = 'guest-checkout-payment-v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function signingKey(): Buffer {
  return crypto.createHmac('sha256', config.jwt.secret).update(PURPOSE).digest();
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export type GuestCheckoutTokenPayload = {
  orderId: string;
  email: string;
  exp: number;
};

export function signGuestCheckoutPaymentToken(
  orderId: string,
  email: string,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const normEmail = email.trim().toLowerCase();
  const exp = Date.now() + ttlMs;
  const payload: GuestCheckoutTokenPayload = { orderId, email: normEmail, exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', signingKey()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyGuestCheckoutPaymentToken(token: string): GuestCheckoutTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  const expected = crypto.createHmac('sha256', signingKey()).update(payloadB64).digest('base64url');
  if (!timingSafeEqual(sig, expected)) return null;
  let parsed: GuestCheckoutTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as GuestCheckoutTokenPayload;
  } catch {
    return null;
  }
  if (!parsed?.orderId || !parsed?.email || typeof parsed.exp !== 'number') return null;
  if (parsed.exp < Date.now()) return null;
  parsed.email = parsed.email.trim().toLowerCase();
  return parsed;
}
