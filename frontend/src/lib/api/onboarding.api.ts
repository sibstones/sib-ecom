import { apiClient } from './client';

export interface OnboardingData {
  storeName?: string;
  frontendBaseUrl?: string;
  gptEnabledCustomer?: boolean;
  gptModel?: string;
  borderRadiusCard?: string;
  borderRadiusButton?: string;
  siteFaviconUrl?: string;
  siteAppleTouchIconUrl?: string;
  emailEnabled?: boolean;
  emailProvider?: string;
  emailFromEmail?: string;
  emailFromName?: string;
  emailNodemailerHost?: string;
  emailNodemailerPort?: number;
  emailNodemailerSecure?: boolean;
  emailNodemailerUser?: string;
  emailTestTo?: string;
  languageIds?: string[];
  defaultLanguageId?: string;
  countryIds?: string[];
  defaultCountryId?: string;
  currencyCodes?: string[];
  defaultCurrencyCode?: string;
  brandsEnabled?: boolean;
  lookbookEnabled?: boolean;
  reviewsEnabled?: boolean;
  wishlistEnabled?: boolean;
  fontFamily?: string;
  colorAccent?: string;
}

export interface OnboardingState {
  completedAt: string | null;
  currentStep: number;
  skipped: boolean;
  data: OnboardingData;
}

export const onboardingApi = {
  getStatus: () => apiClient.get<OnboardingState>('/admin/onboarding'),
  update: (data: Partial<OnboardingState>) =>
    apiClient.put<OnboardingState>('/admin/onboarding', data),
  complete: (data?: { data?: OnboardingData }) =>
    apiClient.post<OnboardingState>('/admin/onboarding/complete', data ?? {}),
  skip: () => apiClient.post<OnboardingState>('/admin/onboarding/skip'),
  reset: () => apiClient.post<OnboardingState>('/admin/onboarding/reset'),
};
