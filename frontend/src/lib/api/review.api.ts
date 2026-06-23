import { apiClient } from './client';
import type { Product } from './product.api';

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  orderId?: string;
  rating: number;
  title?: string;
  comment?: string;
  isVerified: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
  product?: Product;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}

export interface ReviewsResponse {
  reviews: ProductReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  averageRating: number;
  totalReviews: number;
}

export const reviewApi = {
  getByProduct: (productId: string, page: number = 1, limit: number = 20) =>
    apiClient.get<ReviewsResponse>(`/reviews/product/${productId}?page=${page}&limit=${limit}`),
  getProductStats: (productId: string) =>
    apiClient.get<{ stats: ReviewStats }>(`/reviews/product/${productId}/stats`),
  getByUser: () => apiClient.get<{ reviews: ProductReview[] }>('/reviews/user'),
  create: (data: {
    productId: string;
    orderId?: string;
    rating: number;
    title?: string;
    comment?: string;
  }) => apiClient.post<{ review: ProductReview }>('/reviews', data),
  update: (reviewId: string, data: { rating?: number; title?: string; comment?: string }) =>
    apiClient.put<{ review: ProductReview }>(`/reviews/${reviewId}`, data),
  delete: (reviewId: string) => apiClient.delete<{ message: string }>(`/reviews/${reviewId}`),
};
