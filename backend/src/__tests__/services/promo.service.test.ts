import { promoService } from '../../services/promo.service';
import { TestHelpers } from '../helpers/test-helpers';

describe('PromoService', () => {
  describe('create', () => {
    it('should create a new promo code', async () => {
      const promoData = {
        code: 'TEST2024',
        description: 'Test promo code',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        validFrom: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        isActive: true,
      };

      const promo = await promoService.create(promoData);

      expect(promo.code).toBe('TEST2024');
      expect(promo.discountType).toBe('PERCENTAGE');
      expect(Number(promo.discountValue)).toBe(10);
      expect(promo.isActive).toBe(true);
    });

    it('should throw error if promo code already exists', async () => {
      await TestHelpers.createPromoCode({
        code: 'EXISTING',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      await expect(
        promoService.create({
          code: 'EXISTING',
          description: 'Duplicate',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          isActive: true,
        })
      ).rejects.toThrow('Promo code already exists');
    });

    it('should convert code to uppercase', async () => {
      const promo = await promoService.create({
        code: 'lowercase',
        description: 'Test',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        isActive: true,
      });

      expect(promo.code).toBe('LOWERCASE');
    });
  });

  describe('getByCode', () => {
    it('should return active promo code', async () => {
      const promo = await TestHelpers.createPromoCode({
        code: 'ACTIVE2024',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const found = await promoService.getByCode('ACTIVE2024');

      expect(found).toBeDefined();
      expect(found?.id).toBe(promo.id);
      expect(found?.code).toBe('ACTIVE2024');
    });

    it('should return null for expired promo code', async () => {
      await TestHelpers.createPromoCode({
        code: 'EXPIRED',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        validUntil: new Date(Date.now() - 1000 * 60 * 60 * 24),
      });

      const found = await promoService.getByCode('EXPIRED');

      expect(found).toBeNull();
    });

    it('should return null for not yet valid promo code', async () => {
      await TestHelpers.createPromoCode({
        code: 'FUTURE',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(Date.now() + 1000 * 60 * 60 * 24),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      });

      const found = await promoService.getByCode('FUTURE');

      expect(found).toBeNull();
    });
  });

  describe('applyPromoCode', () => {
    it('should apply percentage discount correctly', async () => {
      await TestHelpers.createPromoCode({
        code: 'PERCENT10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const result = await promoService.applyPromoCode({
        code: 'PERCENT10',
        subtotal: 100,
      });

      expect(result.discount).toBe(10);
      expect(result.promoCode.discountType).toBe('PERCENTAGE');
    });

    it('should apply fixed discount correctly', async () => {
      await TestHelpers.createPromoCode({
        code: 'FIXED20',
        discountType: 'FIXED',
        discountValue: 20,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const result = await promoService.applyPromoCode({
        code: 'FIXED20',
        subtotal: 100,
      });

      expect(result.discount).toBe(20);
      expect(result.promoCode.discountType).toBe('FIXED');
    });

    it('should respect max discount limit', async () => {
      await TestHelpers.createPromoCode({
        code: 'MAXDISCOUNT',
        discountType: 'PERCENTAGE',
        discountValue: 50,
        maxDiscount: 25,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const result = await promoService.applyPromoCode({
        code: 'MAXDISCOUNT',
        subtotal: 100,
      });

      // 50% of 100 = 50, but max is 25, so should be 25
      expect(result.discount).toBe(25);
    });

    it('should not exceed subtotal for fixed discount', async () => {
      await TestHelpers.createPromoCode({
        code: 'TOOLARGE',
        discountType: 'FIXED',
        discountValue: 200,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const result = await promoService.applyPromoCode({
        code: 'TOOLARGE',
        subtotal: 100,
      });

      // Discount should not exceed subtotal
      expect(result.discount).toBe(100);
    });

    it('should check minimum purchase requirement', async () => {
      await TestHelpers.createPromoCode({
        code: 'MINPURCHASE',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minPurchase: 100,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      await expect(
        promoService.applyPromoCode({
          code: 'MINPURCHASE',
          subtotal: 50,
        })
      ).rejects.toThrow('Minimum purchase');
    });

    it('should check usage limit', async () => {
      const promo = await TestHelpers.createPromoCode({
        code: 'LIMITED',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        usageLimit: 1,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      // Increment usage to limit
      await promoService.incrementUsage(promo.id);

      await expect(
        promoService.applyPromoCode({
          code: 'LIMITED',
          subtotal: 100,
        })
      ).rejects.toThrow('usage limit reached');
    });

    it('should round discount to 2 decimals', async () => {
      await TestHelpers.createPromoCode({
        code: 'ROUNDING',
        discountType: 'PERCENTAGE',
        discountValue: 33.333,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const result = await promoService.applyPromoCode({
        code: 'ROUNDING',
        subtotal: 100,
      });

      // 33.333% of 100 = 33.333, should round to 33.33
      expect(result.discount).toBe(33.33);
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count', async () => {
      const promo = await TestHelpers.createPromoCode({
        code: 'USAGE',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      expect(promo.usedCount).toBe(0);

      const updated = await promoService.incrementUsage(promo.id);

      expect(updated.usedCount).toBe(1);
    });
  });
});
