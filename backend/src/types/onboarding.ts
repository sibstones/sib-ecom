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

export const DEFAULT_ONBOARDING: OnboardingState = {
  completedAt: null,
  currentStep: 0,
  skipped: false,
  data: {},
};
