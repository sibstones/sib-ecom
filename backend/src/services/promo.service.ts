import prisma from '../config/database';
import { CreatePromoCodeDto, UpdatePromoCodeDto, ApplyPromoCodeDto } from '../types/promo';
import { Prisma } from '@prisma/client';

export class PromoService {
  async getAll(activeOnly: boolean = false) {
    const where = activeOnly
      ? {
          isActive: true,
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() },
        }
      : {};

    return prisma.promoCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    return prisma.promoCode.findUnique({
      where: { id },
    });
  }

  async getByCode(code: string) {
    return prisma.promoCode.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    });
  }

  async create(data: CreatePromoCodeDto) {
    // Note: Promo code creation restriction check is handled at controller/executor level
    // This allows admins to bypass restrictions while AI/regular users are restricted

    // Check if code already exists
    const existing = await prisma.promoCode.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (existing) {
      throw new Error('Promo code already exists');
    }

    return prisma.promoCode.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description,
        discountType: data.discountType,
        discountValue: new Prisma.Decimal(data.discountValue),
        minPurchase: data.minPurchase ? new Prisma.Decimal(data.minPurchase) : null,
        maxDiscount: data.maxDiscount ? new Prisma.Decimal(data.maxDiscount) : null,
        usageLimit: data.usageLimit,
        userId: data.userId || null,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        isActive: data.isActive,
        // Partner promo code fields
        isPartnerPromo: data.isPartnerPromo || false,
        partnerId: data.partnerId || null,
        partnerCommissionRate: data.partnerCommissionRate ? new Prisma.Decimal(data.partnerCommissionRate) : null,
      },
    });
  }

  async update(id: string, data: UpdatePromoCodeDto) {
    return prisma.promoCode.update({
      where: { id },
      data: {
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.discountType && { discountType: data.discountType }),
        ...(data.discountValue !== undefined && {
          discountValue: new Prisma.Decimal(data.discountValue),
        }),
        ...(data.minPurchase !== undefined && {
          minPurchase: data.minPurchase ? new Prisma.Decimal(data.minPurchase) : null,
        }),
        ...(data.maxDiscount !== undefined && {
          maxDiscount: data.maxDiscount ? new Prisma.Decimal(data.maxDiscount) : null,
        }),
        ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit }),
        ...(data.userId !== undefined && { userId: data.userId || null }),
        ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
        ...(data.validUntil && { validUntil: new Date(data.validUntil) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        // Partner promo code fields
        ...(data.isPartnerPromo !== undefined && { isPartnerPromo: data.isPartnerPromo }),
        ...(data.partnerId !== undefined && { partnerId: data.partnerId || null }),
        ...(data.partnerCommissionRate !== undefined && {
          partnerCommissionRate: data.partnerCommissionRate ? new Prisma.Decimal(data.partnerCommissionRate) : null,
        }),
      },
    });
  }

  async delete(id: string) {
    return prisma.promoCode.delete({
      where: { id },
    });
  }

  async applyPromoCode(data: ApplyPromoCodeDto) {
    const promoCode = await this.getByCode(data.code);

    if (!promoCode) {
      throw new Error('Invalid or expired promo code');
    }

    // Check if promo code is restricted to a specific user
    if (promoCode.userId) {
      if (!data.userId) {
        throw new Error('This promo code requires authentication');
      }
      if (promoCode.userId !== data.userId) {
        throw new Error('This promo code is not available for your account');
      }
    }

    // Check usage limit
    if (promoCode.usageLimit && promoCode.usedCount >= promoCode.usageLimit) {
      throw new Error('Promo code usage limit reached');
    }

    // Check minimum purchase
    if (promoCode.minPurchase && data.subtotal < Number(promoCode.minPurchase)) {
      throw new Error(
        `Minimum purchase of $${promoCode.minPurchase} required for this promo code`
      );
    }

    let discount = 0;

    if (promoCode.discountType === 'PERCENTAGE') {
      discount = (data.subtotal * Number(promoCode.discountValue)) / 100;
      // Apply max discount if set
      if (promoCode.maxDiscount && discount > Number(promoCode.maxDiscount)) {
        discount = Number(promoCode.maxDiscount);
      }
    } else if (promoCode.discountType === 'BALANCE') {
      // BALANCE type: deducts balance (like gift card)
      // discountValue is the balance amount that can be applied
      discount = Number(promoCode.discountValue);
      // Don't allow discount to exceed subtotal
      if (discount > data.subtotal) {
        discount = data.subtotal;
      }
      // For BALANCE type, usageLimit should typically be 1 (one-time use)
      // But we'll respect the usageLimit if set
    } else {
      // FIXED type
      discount = Number(promoCode.discountValue);
      // Don't allow discount to exceed subtotal
      if (discount > data.subtotal) {
        discount = data.subtotal;
      }
    }

    return {
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
      },
      discount: Math.round(discount * 100) / 100, // Round to 2 decimals
    };
  }

  async incrementUsage(id: string) {
    return prisma.promoCode.update({
      where: { id },
      data: {
        usedCount: { increment: 1 },
      },
    });
  }
}

export const promoService = new PromoService();
