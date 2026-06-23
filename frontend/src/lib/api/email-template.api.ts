import { apiClient } from './client';

export type EmailTemplateType =
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFICATION'
  | 'WELCOME'
  | 'ORDER_CONFIRMATION'
  | 'SHIPPING'
  | 'DELIVERY'
  | 'PAYMENT_REQUEST'
  | 'PAYMENT_CONFIRMED'
  | 'RETURN_NOTIFICATION'
  | 'PROMOTIONAL';

/** Per-locale content (ISO 639-1: en, ru, de, ...) */
export interface EmailTemplateTranslation {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface EmailTemplate {
  type: EmailTemplateType;
  subject: string;
  htmlContent: string;
  textContent?: string;
  enabled: boolean;
  description?: string;
  variables?: Record<string, string>;
  /** Per-locale overrides for subject/htmlContent/textContent */
  translations?: Record<string, EmailTemplateTranslation>;
}

export interface EmailTemplatesResponse {
  templates: EmailTemplate[];
}

export interface EmailTemplateResponse {
  template: EmailTemplate;
}

export const emailTemplateApi = {
  getAll: () => apiClient.get<EmailTemplatesResponse>('/email-templates'),

  getByType: (type: EmailTemplateType) =>
    apiClient.get<EmailTemplateResponse>(`/email-templates/${type}`),

  createOrUpdate: (type: EmailTemplateType, data: Partial<EmailTemplate>) =>
    apiClient.put<EmailTemplateResponse>(`/email-templates/${type}`, data),

  delete: (type: EmailTemplateType) =>
    apiClient.delete<{ message: string }>(`/email-templates/${type}`),
};
