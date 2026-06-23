import { apiClient } from './client';

export interface Language {
  id: string;
  code: string;
  name: string;
  nameNative?: string;
  flag?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const languageApi = {
  getAll: (activeOnly = false) =>
    apiClient.get<{ languages: Language[] }>(`/languages?activeOnly=${activeOnly}`),
  getById: (id: string) => apiClient.get<{ language: Language }>(`/languages/${id}`),
  getDefault: () => apiClient.get<{ language: Language | null }>('/languages/default'),
  create: (data: {
    code: string;
    name: string;
    nameNative?: string;
    flag?: string;
    isActive?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
  }) => apiClient.post<{ language: Language }>('/languages', data),
  update: (id: string, data: Partial<Language>) =>
    apiClient.put<{ language: Language }>(`/languages/${id}`, data),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/languages/${id}`),
  setDefault: (id: string) =>
    apiClient.post<{ language: Language }>(`/languages/${id}/set-default`),
};
