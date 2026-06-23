import { apiClient } from './client';
import type { Product } from './product.api';

export interface CustomerAddress {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address: string;
  city: string;
  country: string;
  postalCode?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  size?: string; // Selected size (e.g., "M", "42", "50cm")
  quantity: number;
  price: number;
  createdAt: string;
  product: Product;
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: 'GATEWAY' | 'BANK_TRANSFER' | 'P2P' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT';
  /** ISO code used at checkout (amounts in subtotal/tax/shipping/total are catalog USD). */
  checkoutCurrency?: string;
  checkoutFxRatesSnapshot?: Record<string, number> | null;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  loyaltyDiscount?: number;
  loyaltyPointsSpent?: number;
  shippingAddressId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  shippingAddress?: CustomerAddress;
  statusHistory?: OrderStatusHistory[];
  tickets?: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  paymentRequest?: {
    id: string;
    status?: 'PENDING' | 'PAID' | 'CANCELLED';
    logisticsInfo?: {
      trackingNumber?: string;
      carrier?: string;
      estimatedDelivery?: string;
      shippedDate?: string;
      notes?: string;
    };
    shippedAt?: string;
  };
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
  product: Product;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: string;
  preferredLanguage?: string;
  emailVerified?: boolean;
  createdAt: string;
}

export interface NotificationCounts {
  ordersInProgress: number;
  unreadTickets: number;
}

export const customerApi = {
  // Profile
  getProfile: () => apiClient.get<{ profile: UserProfile }>('/customer/profile'),
  updateProfile: (data: Partial<UserProfile>) =>
    apiClient.put<{ profile: UserProfile }>('/customer/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<{ message: string }>('/customer/profile/change-password', {
      currentPassword,
      newPassword,
    }),
  getNotificationCounts: () => apiClient.get<NotificationCounts>('/customer/notifications'),

  // Addresses
  getAddresses: () => apiClient.get<{ addresses: CustomerAddress[] }>('/customer/addresses'),
  createAddress: (data: Omit<CustomerAddress, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<{ address: CustomerAddress }>('/customer/addresses', data),
  updateAddress: (addressId: string, data: Partial<CustomerAddress>) =>
    apiClient.put<{ address: CustomerAddress }>(`/customer/addresses/${addressId}`, data),
  deleteAddress: (addressId: string) =>
    apiClient.delete<{ message: string }>(`/customer/addresses/${addressId}`),

  // Orders
  getOrders: (page: number = 1, limit: number = 20) =>
    apiClient.get<{
      orders: Order[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/customer/orders?page=${page}&limit=${limit}`),
  getOrder: (orderId: string) => apiClient.get<{ order: Order }>(`/customer/orders/${orderId}`),
  createOrder: (
    data: {
      shippingAddressId: string;
      notes?: string;
      paymentMethod?: 'GATEWAY' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT';
      currency?: string;
      countryCode?: string;
      promoCode?: string;
      loyaltyRedeemPoints?: number;
      languageCode?: string;
    },
    sessionId?: string
  ) =>
    apiClient.post<{ order: Order }>(
      '/customer/orders',
      data,
      sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : undefined
    ),
  createGuestOrder: (
    data: {
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
      languageCode?: string;
    },
    sessionId: string
  ) =>
    apiClient.post<{ order: Order; guestPaymentToken: string }>('/customer/guest/orders', data, {
      headers: { 'x-session-id': sessionId },
    }),
  checkGuestCheckoutEmail: (email: string) =>
    apiClient.get<{ canCheckout: boolean }>('/customer/guest/check-email', {
      params: { email },
    }),
  updatePaymentMethod: (
    orderId: string,
    paymentMethod: 'GATEWAY' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT'
  ) =>
    apiClient.put<{ order: Order }>(`/customer/orders/${orderId}/payment-method`, {
      paymentMethod,
    }),

  // Wishlist
  getWishlist: () => apiClient.get<{ items: WishlistItem[] }>('/customer/wishlist'),
  addToWishlist: (productId: string) =>
    apiClient.post<{ item: WishlistItem }>('/customer/wishlist', { productId }),
  removeFromWishlist: (productId: string) =>
    apiClient.delete<{ message: string }>(`/customer/wishlist/${productId}`),
  checkWishlist: (productId: string) =>
    apiClient.get<{ isInWishlist: boolean }>(`/customer/wishlist/check/${productId}`),

  // Promo Codes
  getPromoCodes: () =>
    apiClient.get<{
      used: import('./promo.api').PromoCode[];
      available: import('./promo.api').PromoCode[];
    }>('/customer/promo-codes'),
};
