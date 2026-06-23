import { apiClient } from './client';

export interface FooterColumn {
  title: string;
  links: Array<{
    text: string;
    url: string;
  }>;
}

export interface FooterLink {
  text: string;
  url: string;
}

/** Follow us: social network URLs (B&W icons: Instagram, TikTok, Facebook, YouTube) */
export interface FooterSocialLinks {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  youtube?: string;
}

export interface Footer {
  id: string;
  brandName: string;
  tagline?: string;
  columns: FooterColumn[];
  copyright: string;
  links?: FooterLink[];
  socialLinks?: FooterSocialLinks;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFooterDto {
  brandName?: string;
  tagline?: string;
  columns?: FooterColumn[];
  copyright?: string;
  links?: FooterLink[];
  socialLinks?: FooterSocialLinks;
  isActive?: boolean;
}

export interface UpdateFooterDto extends Partial<CreateFooterDto> {}

export const footerApi = {
  get: (languageCode?: string) => {
    const params = languageCode ? `?languageCode=${languageCode}` : '';
    return apiClient.get<{ footer: Footer }>(`/footer${params}`);
  },
  getById: (id: string) => apiClient.get<{ footer: Footer }>(`/footer/${id}`),
  create: (data: CreateFooterDto) => apiClient.post<{ footer: Footer }>('/footer', data),
  update: (id: string, data: UpdateFooterDto) =>
    apiClient.put<{ footer: Footer }>(`/footer/${id}`, data),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/footer/${id}`),
};
