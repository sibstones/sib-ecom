import QRCode from 'qrcode';
import { generateSecret, generateURI, verifySync } from 'otplib';
import prisma from '../config/database';
import { config } from '../config/env';
import { encryptTfaSecret, decryptTfaSecret } from '../utils/two-factor-crypto';
import { comparePassword } from '../utils/hash';

export class TwoFactorService {
  async startSetup(userId: string): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new Error('Two-factor authentication requires a password on your account.');
    }
    if (user.twoFactorEnabled) {
      throw new Error(
        'Two-factor authentication is already enabled. Disable it before setting up again.'
      );
    }
    const secret = generateSecret();
    const enc = encryptTfaSecret(secret);
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorPendingSecret: enc },
    });
    const issuer = config.twoFactor.issuer;
    const otpauthUrl = generateURI({
      issuer,
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    return { otpauthUrl, qrDataUrl };
  }

  async confirmSetup(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorPendingSecret) {
      throw new Error('No two-factor setup in progress. Start setup first.');
    }
    const plain = decryptTfaSecret(user.twoFactorPendingSecret);
    const token = code.replace(/\s+/g, '');
    const { valid } = verifySync({ secret: plain, token });
    if (!valid) {
      throw new Error('Invalid authentication code');
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorEnabled: true,
      },
    });
  }

  async cancelSetup(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, twoFactorEnabled: false },
      data: { twoFactorPendingSecret: null },
    });
  }

  async disable(userId: string, password: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new Error('Two-factor authentication is not enabled.');
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      throw new Error('Invalid password');
    }
    const plain = decryptTfaSecret(user.twoFactorSecret);
    const token = code.replace(/\s+/g, '');
    const { valid } = verifySync({ secret: plain, token });
    if (!valid) {
      throw new Error('Invalid authentication code');
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
      },
    });
  }
}

export const twoFactorService = new TwoFactorService();
