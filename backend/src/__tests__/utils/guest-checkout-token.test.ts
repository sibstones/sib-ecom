import crypto from 'crypto';
import { config } from '../../config/env';
import {
  signGuestCheckoutPaymentToken,
  verifyGuestCheckoutPaymentToken,
} from '../../utils/guest-checkout-token';

describe('guest-checkout-token', () => {
  it('round-trips sign and verify with normalized email', () => {
    const token = signGuestCheckoutPaymentToken('order-uuid-1', '  User@Example.COM ');
    const payload = verifyGuestCheckoutPaymentToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.orderId).toBe('order-uuid-1');
    expect(payload!.email).toBe('user@example.com');
    expect(payload!.exp).toBeGreaterThan(Date.now());
  });

  it('returns null for invalid inputs', () => {
    expect(verifyGuestCheckoutPaymentToken('')).toBeNull();
    expect(verifyGuestCheckoutPaymentToken('not-two-parts')).toBeNull();
    expect(verifyGuestCheckoutPaymentToken('a.b.c')).toBeNull();
    expect(verifyGuestCheckoutPaymentToken(null as unknown as string)).toBeNull();
  });

  it('returns null when signature is tampered', () => {
    const token = signGuestCheckoutPaymentToken('o1', 'a@b.co');
    const [payloadB64] = token.split('.');
    const tampered = `${payloadB64}.wrongsig`;
    expect(verifyGuestCheckoutPaymentToken(tampered)).toBeNull();
  });

  it('returns null when token is expired', () => {
    const token = signGuestCheckoutPaymentToken('o1', 'a@b.co', -60_000);
    expect(verifyGuestCheckoutPaymentToken(token)).toBeNull();
  });

  it('returns null when payload JSON is invalid', () => {
    const PURPOSE = 'guest-checkout-payment-v1';
    const key = crypto.createHmac('sha256', config.jwt.secret).update(PURPOSE).digest();
    const badB64 = Buffer.from('{not json', 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', key).update(badB64).digest('base64url');
    expect(verifyGuestCheckoutPaymentToken(`${badB64}.${sig}`)).toBeNull();
  });
});
