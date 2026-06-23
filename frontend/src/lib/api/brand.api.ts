import { apiClient } from './client';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

export const brandApi = {
  getAll: () => apiClient.get<{ brands: Brand[] }>('/brands'),
  getById: (id: string) => apiClient.get<{ brand: Brand }>(`/brands/${id}`),
  getBySlug: (slug: string) => apiClient.get<{ brand: Brand }>(`/brands/slug/${slug}`),
  create: (data: { name: string; slug?: string; logo?: string }) =>
    apiClient.post<{ brand: Brand }>('/brands', data),
  update: (id: string, data: Partial<Brand>) =>
    apiClient.put<{ brand: Brand }>(`/brands/${id}`, data),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/brands/${id}`),
};
