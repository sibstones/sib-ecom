export interface CreatePromoCodeDto {
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED' | 'BALANCE';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  userId?: string; // Optional: restrict to specific user (for gift cards/personal promo codes)
  validFrom: string; // ISO date string
  validUntil: string; // ISO date string
  isActive: boolean;
  // Partner promo code fields
  isPartnerPromo?: boolean;
  partnerId?: string; // Partner who created this promo code
  partnerCommissionRate?: number; // Partner commission rate (e.g., 10.00 for 10%)
}

export interface UpdatePromoCodeDto extends Partial<CreatePromoCodeDto> {}

export interface ApplyPromoCodeDto {
  code: string;
  subtotal: number;
  userId?: string; // Required when checking user-specific promo codes
}
