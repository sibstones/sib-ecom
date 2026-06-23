export interface Country {
  id: string;
  code: string;
  name: string;
  nameNative?: string;
  currency: string;
  language: string;
  taxRate: number; // Tax rate as decimal (e.g., 0.1 = 10%)
  shippingCost: number; // Base shipping cost
  freeShippingThreshold: number | null; // Order total threshold for free shipping (null = no free shipping)
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCountryDto {
  code: string;
  name: string;
  nameNative?: string;
  currency: string;
  language: string;
  taxRate?: number;
  shippingCost?: number;
  freeShippingThreshold?: number | null;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface UpdateCountryDto {
  name?: string;
  nameNative?: string;
  currency?: string;
  language?: string;
  taxRate?: number;
  shippingCost?: number;
  freeShippingThreshold?: number | null;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}
