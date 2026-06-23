export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  /** ISO 639-1 language code (e.g. "en", "ru"). Saved when user changes language on frontend. */
  preferredLanguage?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface CreateAddressDto {
  firstName: string;
  lastName: string;
  phone?: string;
  address: string;
  city: string;
  country: string;
  postalCode?: string;
  isDefault?: boolean;
}

export interface UpdateAddressDto extends Partial<CreateAddressDto> {}

export interface CreateOrderDto {
  shippingAddressId: string;
  notes?: string;
  paymentMethod?: 'GATEWAY' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT';
  currency?: string;
  countryCode?: string;
  promoCode?: string;
  loyaltyRedeemPoints?: number;
  /** ISO 639-1 storefront language used to pick localized payment instructions. */
  languageCode?: string;
}

export interface CreateGuestOrderDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address: string;
  city: string;
  country: string;
  postalCode?: string;
  notes?: string;
  paymentMethod?: 'GATEWAY' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT';
  currency?: string;
  countryCode?: string;
  promoCode?: string;
  loyaltyRedeemPoints?: number;
  /** ISO 639-1 storefront language used to pick localized payment instructions. */
  languageCode?: string;
}

export interface UpdatePaymentMethodDto {
  paymentMethod: 'GATEWAY' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT';
}
