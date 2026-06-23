import { apiClient } from './client';

export interface LoyaltyPoints {
  id: string;
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
  transactions?: LoyaltyTransaction[];
}

export interface LoyaltyTransaction {
  id: string;
  loyaltyPointsId: string;
  orderId?: string;
  points: number;
  type: 'EARNED' | 'SPENT' | 'EXPIRED' | 'ADJUSTMENT';
  description?: string;
  createdAt: string;
}

export const loyaltyApi = {
  getPoints: () => apiClient.get<{ points: LoyaltyPoints }>('/loyalty'),
  spendPoints: (points: number, orderId?: string) =>
    apiClient.post<{ points: LoyaltyPoints }>('/loyalty/spend', { points, orderId }),
  getConversionRate: () =>
    apiClient.get<{
      pointsPerDollar: number;
      pointsPerDollarDiscount: number;
      example: { points: number; dollars: number };
    }>('/loyalty/conversion'),
};
