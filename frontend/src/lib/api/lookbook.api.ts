import { apiClient } from './client';

export interface LookbookImage {
  id: string;
  lookbookId: string;
  url: string;
  alt?: string;
  order: number;
  createdAt: string;
  productTags?: ProductTag[];
}

export interface ProductTag {
  id: string;
  lookbookImageId: string;
  productId: string;
  x: number;
  y: number;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images?: Array<{ url: string }>;
  };
}

export interface Lookbook {
  id: string;
  title: string;
  slug: string;
  description?: string;
  season?: string;
  year?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  images?: LookbookImage[];
}

export interface CreateLookbookDto {
  title: string;
  slug?: string;
  description?: string;
  season?: string;
  year?: number;
  isActive: boolean;
}

export interface UpdateLookbookDto extends Partial<CreateLookbookDto> {}

export interface CreateLookbookImageDto {
  lookbookId: string;
  url: string;
  alt?: string;
  order: number;
}

export interface CreateProductTagDto {
  lookbookImageId: string;
  productId: string;
  x: number;
  y: number;
}

export const lookbookApi = {
  getAll: (activeOnly: boolean = false, languageCode?: string) => {
    const params = new URLSearchParams({
      active: activeOnly.toString(),
    });
    if (languageCode) {
      params.append('languageCode', languageCode);
    }
    return apiClient.get<{ lookbooks: Lookbook[] }>(`/lookbook?${params.toString()}`);
  },
  getById: (id: string) => apiClient.get<{ lookbook: Lookbook }>(`/lookbook/${id}`),
  getBySlug: (slug: string, languageCode?: string) => {
    const params = languageCode ? `?languageCode=${languageCode}` : '';
    return apiClient.get<{ lookbook: Lookbook }>(`/lookbook/slug/${slug}${params}`);
  },
  create: (data: CreateLookbookDto) => apiClient.post<{ lookbook: Lookbook }>('/lookbook', data),
  update: (id: string, data: UpdateLookbookDto) =>
    apiClient.put<{ lookbook: Lookbook }>(`/lookbook/admin/${id}`, data),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/lookbook/admin/${id}`),
  addImage: (data: CreateLookbookImageDto) =>
    apiClient.post<{ image: LookbookImage }>('/lookbook/images', data),
  updateImage: (imageId: string, data: Partial<CreateLookbookImageDto>) =>
    apiClient.put<{ image: LookbookImage }>(`/lookbook/images/${imageId}`, data),
  deleteImage: (imageId: string) =>
    apiClient.delete<{ message: string }>(`/lookbook/images/${imageId}`),
  reorderImages: (lookbookId: string, imageOrders: { id: string; order: number }[]) =>
    apiClient.post<{ message: string }>(`/lookbook/${lookbookId}/images/reorder`, {
      imageOrders,
    }),
  addProductTag: (data: CreateProductTagDto) =>
    apiClient.post<{ tag: ProductTag }>('/lookbook/images/tags', data),
  deleteProductTag: (tagId: string) =>
    apiClient.delete<{ message: string }>(`/lookbook/images/tags/${tagId}`),
};
