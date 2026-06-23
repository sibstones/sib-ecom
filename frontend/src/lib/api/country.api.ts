import { apiClient } from './client';

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
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutEstimate {
  subtotal: number;
  discount: number;
  subtotalAfterDiscount: number;
  tax: number;
  shipping: number;
  total: number;
  /** When requested via displayCurrency: amounts in this ISO code (aligned with server payment conversion). */
  displayCurrency?: string;
  display?: {
    subtotal: number;
    discount: number;
    subtotalAfterDiscount: number;
    tax: number;
    shipping: number;
    total: number;
  };
  /** When `display` is present: server suggests refreshing the quote after this instant. */
  quoteExpiresAt?: string;
}

export const countryApi = {
  getAll: (activeOnly = false, options?: RequestInit) =>
    apiClient.get<{ countries: Country[] }>(`/countries?activeOnly=${activeOnly}`, options),
  getById: (id: string) => apiClient.get<{ country: Country }>(`/countries/${id}`),
  getDefault: () => apiClient.get<{ country: Country | null }>('/countries/default'),
  getCheckoutEstimate: (
    countryCode: string,
    subtotal: number,
    discount = 0,
    displayCurrency?: string,
    loyaltyDiscount = 0
  ) => {
    const dc =
      displayCurrency && displayCurrency.trim()
        ? `&displayCurrency=${encodeURIComponent(displayCurrency.trim().toUpperCase())}`
        : '';
    const loyalty =
      loyaltyDiscount > 0 ? `&loyaltyDiscount=${encodeURIComponent(String(loyaltyDiscount))}` : '';
    return apiClient.get<CheckoutEstimate>(
      `/countries/estimate?countryCode=${encodeURIComponent(countryCode)}&subtotal=${subtotal}&discount=${discount}${dc}${loyalty}`
    );
  },
  create: (data: {
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
  }) => apiClient.post<{ country: Country }>('/countries', data),
  update: (id: string, data: Partial<Country>) =>
    apiClient.put<{ country: Country }>(`/countries/${id}`, data),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/countries/${id}`),
  setDefault: (id: string) => apiClient.post<{ country: Country }>(`/countries/${id}/set-default`),
};
