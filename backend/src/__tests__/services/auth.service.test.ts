jest.mock('otplib', () => ({
  verifySync: jest.fn(),
}));

import { authService } from '../../services/auth.service';
import { TestHelpers } from '../helpers/test-helpers';
import prisma from '../../config/database';
import { PaymentStatus, UserRole } from '@prisma/client';

describe('AuthService', () => {
  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = await authService.register(userData);

      expect(result.user.email).toBe(userData.email);
      expect(result.user.firstName).toBe(userData.firstName);
      expect(result.user.lastName).toBe(userData.lastName);
      expect(result.user.role).toBe(UserRole.CUSTOMER);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
      };

      await TestHelpers.createUser({ email: userData.email });

      await expect(authService.register(userData)).rejects.toThrow(
        'Registration failed. Please check your information and try again.'
      );
    });

    it('should require promo code if active promo codes exist', async () => {
      // Create an active promo code
      await TestHelpers.createPromoCode({
        code: 'TEST2024',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day from now
      });

      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
      };

      await expect(authService.register(userData)).rejects.toThrow(
        'Registration requires a valid promo code'
      );
    });

    it('should register user with valid promo code', async () => {
      const promoCode = await TestHelpers.createPromoCode({
        code: 'WELCOME2024',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        promoCode: promoCode.code,
      };

      const result = await authService.register(userData);

      expect(result.user.email).toBe(userData.email);
      expect(result.accessToken).toBeDefined();
    });

    it('should throw error for invalid promo code', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        promoCode: 'INVALID_CODE',
      };

      await expect(authService.register(userData)).rejects.toThrow(
        'Invalid or expired promo code'
      );
    });

    it('should complete registration for existing passwordless guest and preserve linked orders', async () => {
      const email = 'guest-upgrade@example.com';
      const guestUser = await prisma.user.create({
        data: {
          email,
          passwordHash: null,
          firstName: 'Guest',
          lastName: 'Checkout',
          phone: '+10000000000',
          role: UserRole.CUSTOMER,
        },
      });

      const address = await prisma.customerAddress.create({
        data: {
          userId: guestUser.id,
          firstName: 'Guest',
          lastName: 'Checkout',
          phone: '+10000000000',
          address: '123 Guest Street',
          city: 'New York',
          country: 'US',
          postalCode: '10001',
        },
      });

      const order = await prisma.order.create({
        data: {
          userId: guestUser.id,
          orderNumber: `GUEST-UPGRADE-${Date.now()}`,
          status: 'PENDING',
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: 'BANK_TRANSFER',
          subtotal: 100,
          tax: 10,
          shipping: 0,
          total: 110,
          checkoutCurrency: 'USD',
          shippingAddressId: address.id,
        },
      });

      const result = await authService.register({
        email,
        password: 'Password123!',
        firstName: 'Registered',
        lastName: 'Customer',
        phone: '+12223334444',
      });

      expect(result.user.id).toBe(guestUser.id);
      expect(result.user.email).toBe(email);
      expect(result.user.firstName).toBe('Registered');
      expect(result.user.lastName).toBe('Customer');

      const updatedUser = await prisma.user.findUnique({
        where: { id: guestUser.id },
      });
      expect(updatedUser?.passwordHash).toBeTruthy();
      expect(updatedUser?.phone).toBe('+12223334444');

      const linkedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(linkedOrder?.userId).toBe(guestUser.id);
    });

    it('should preserve partner flags when completing registration for existing passwordless partner', async () => {
      const email = 'partner-upgrade@example.com';
      const guestPartner = await prisma.user.create({
        data: {
          email,
          passwordHash: null,
          firstName: 'Partner',
          lastName: 'Guest',
          role: UserRole.CUSTOMER,
          isPartner: true,
          partnerStatus: 'ACTIVE',
        },
      });

      const result = await authService.register({
        email,
        password: 'Password123!',
        firstName: 'Partner',
        lastName: 'Registered',
      });

      expect(result.user.id).toBe(guestPartner.id);
      expect(result.user.isPartner).toBe(true);
      expect(result.user.partnerStatus).toBe('ACTIVE');

      const updatedUser = await prisma.user.findUnique({
        where: { id: guestPartner.id },
      });
      expect(updatedUser?.isPartner).toBe(true);
      expect(updatedUser?.partnerStatus).toBe('ACTIVE');
      expect(updatedUser?.passwordHash).toBeTruthy();
    });
  });

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      const email = 'login@example.com';
      const password = 'password123';

      await TestHelpers.createUser({
        email,
        password,
        isActive: true,
      });

      const result = await authService.login({ email, password });

      expect(result.user.email).toBe(email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should return partner flags for partner login', async () => {
      const email = 'partner-login@example.com';
      const password = 'password123';

      await TestHelpers.createUser({
        email,
        password,
        isPartner: true,
        partnerStatus: 'ACTIVE',
      });

      const result = await authService.login({ email, password });

      expect(result.user.email).toBe(email);
      expect(result.user.isPartner).toBe(true);
      expect(result.user.partnerStatus).toBe('ACTIVE');
    });

    it('should throw error for incorrect password', async () => {
      const email = 'login2@example.com';
      await TestHelpers.createUser({
        email,
        password: 'correctpassword',
      });

      await expect(
        authService.login({ email, password: 'wrongpassword' })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for deactivated account', async () => {
      const email = 'deactivated@example.com';
      await TestHelpers.createUser({
        email,
        password: 'password123',
        isActive: false,
      });

      await expect(
        authService.login({ email, password: 'password123' })
      ).rejects.toThrow('Account is deactivated');
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const user = await TestHelpers.createUser({
        email: 'refresh@example.com',
      });

      // Create a session with refresh token
      const { generateRefreshToken } = await import('../../utils/jwt');
      const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.session.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const result = await authService.refreshToken(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.accessToken).not.toBe(refreshToken);
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(
        authService.refreshToken('invalid-token')
      ).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('logout', () => {
    it('should delete session on logout', async () => {
      const user = await TestHelpers.createUser({
        email: 'logout@example.com',
      });

      const { generateRefreshToken } = await import('../../utils/jwt');
      const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.session.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await authService.logout(refreshToken);

      const session = await prisma.session.findUnique({
        where: { token: refreshToken },
      });

      expect(session).toBeNull();
    });
  });
});
