import { apiClient } from './client';
import type { Product, ProductVariant } from './product.api';

export interface CartItem {
  id: string;
  userId?: string;
  sessionId?: string;
  productId: string;
  variantId?: string;
  size?: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product: Product;
  variant?: ProductVariant;
}

export interface CartResponse {
  items: CartItem[];
}

export const cartApi = {
  getCart: (sessionId?: string) =>
    apiClient.get<CartResponse>(
      '/cart',
      sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : undefined
    ),
  addToCart: (
    productId: string,
    quantity: number = 1,
    variantId?: string,
    size?: string,
    sessionId?: string
  ) => {
    const data = { productId, quantity, variantId, size };
    console.log('cartApi.addToCart - sending data:', data);
    console.log('cartApi.addToCart - size value:', size);
    console.log('cartApi.addToCart - size type:', typeof size);
    return apiClient.post<{ item: CartItem }>(
      '/cart',
      data,
      sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : undefined
    );
  },
  updateQuantity: (itemId: string, quantity: number, sessionId?: string) =>
    apiClient.put<{ item: CartItem }>(
      `/cart/${itemId}`,
      { quantity },
      sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : undefined
    ),
  removeFromCart: (itemId: string, sessionId?: string) =>
    apiClient.delete<{ message: string }>(
      `/cart/${itemId}`,
      sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : undefined
    ),
  clearCart: (sessionId?: string) =>
    apiClient.delete<{ message: string }>(
      '/cart',
      sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : undefined
    ),
};
