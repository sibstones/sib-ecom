import { apiClient } from './client';
import { normalizeUploadFile } from '$lib/utils/file-upload';

export interface FeatureSettings {
  reviewsEnabled: boolean;
  paymentGatewaysEnabled: boolean;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  brandsEnabled: boolean;
  showBrandFilter: boolean;
  loyaltyProgramEnabled: boolean;
  loyaltyPointsEarnPerUnit: number;
  loyaltyPointsSpendPerUnit: number;
  filtersEnabled: boolean;
  categoryFilterEnabled: boolean;
  priceFilterEnabled: boolean;
  brandFilterEnabled: boolean;
  searchEnabled: boolean;
  wishlistEnabled: boolean;
  compareEnabled: boolean;
  newsletterEnabled: boolean;
  socialLoginEnabled: boolean;
  lookbookEnabled: boolean;
  // OAuth Settings
  oauthGoogleEnabled: boolean;
  oauthGoogleClientId: string;
  oauthGoogleClientSecret: string;
  oauthYandexEnabled: boolean;
  oauthYandexClientId: string;
  oauthYandexClientSecret: string;
  oauthVkontakteEnabled: boolean;
  oauthVkontakteClientId: string;
  oauthVkontakteClientSecret: string;
  oauthFacebookEnabled: boolean;
  oauthFacebookClientId: string;
  oauthFacebookClientSecret: string;
  oauthAppleEnabled: boolean;
  oauthAppleClientId: string;
  oauthAppleTeamId: string;
  oauthAppleKeyId: string;
  oauthApplePrivateKey: string;
  quickViewEnabled: boolean;
  productRecommendationsEnabled: boolean;
  recentlyViewedEnabled: boolean;
  // Typography Settings
  fontFamily: string;
  fontSizeH1: string;
  fontSizeH2: string;
  fontSizeH3: string;
  fontSizeH4: string;
  fontSizeBody: string;
  fontSizeSmall: string;
  fontSizeButton: string;
  textTransformUppercase: boolean;
  // Border Radius Settings
  borderRadiusCard: string;
  borderRadiusButton: string;
  /** Public URL for favicon; empty uses default */
  siteFaviconUrl: string;
  /** Apple touch icon URL; empty omits link */
  siteAppleTouchIconUrl: string;
  // Color Settings
  colorWhite: string;
  colorDark: string;
  colorDarkLight: string;
  colorDarkLighter: string;
  colorAccent: string;
  colorAccentMuted: string;
  colorAccentLight: string;
  colorBackground: string;
  colorBackgroundSecondary: string;
  colorBlack: string;
  // Product Page Design
  productPageDesign: string;
  productImageAspectRatio: string;
  productPageCompleteTheLookEnabled: boolean;
  productPageYouMightLikeEnabled: boolean;
  productPageYouMightLikeMode: string; // 'smart' | 'similar'
  productPageYouViewedEnabled: boolean;
  productPageGridPanelBackgroundColor: string;
  productPageGridPanelOpacity: number;
  productPageGridPanelBlur: number;
  productPageGridPanelBorderColor: string;
  productPageGridPanelBorderOpacity: number;
  productPageGridPanelBorderRadius: number;
  // Shop Page Design
  shopGridColumns: string;
  shopGridGap: string;
  shopCardAspectRatio: string;
  shopCardHoverImage: boolean;
  shopCardHoverAnimation: string;
  shopCardVideoSupport: boolean;
  shopCardShowQuickAdd: boolean;
  shopHeaderStyle: string;
  shopHeaderSpacing: string;
  shopHeaderTitleScale: string;
  shopHeaderAlignment: string;
  shopHeaderShowBreadcrumbs: boolean;
  shopHeaderShowTitle: boolean;
  shopHeaderShowCategories: boolean;
  shopHeaderShowCount: boolean;
  shopHeaderShowSideMenuTab: boolean;
  shopHeaderCategoryLimit: string;
  shopMenuLabel: string;
  shopDefaultSort: string;
  shopDefaultInventoryStatus: string;
  shopToolbarStyle: string;
  shopToolbarCorners: string;
  shopToolbarDensity: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  footerMutedTextColor: string;
  footerAccentColor: string;
  footerSpacing: string;
  footerAlignment: string;
  footerBrandTitleScale: string;
  footerLinkTextSize: string;
  // Image Blur Feature
  imageBlurEnabled: boolean;
  // Marketing - Pinterest
  pinterestEnabled: boolean;
  pinterestAccessToken: string;
  pinterestBoardId: string;
  frontendBaseUrl: string;
  storeCurrencies: string[];
  defaultStoreCurrency: string;
  // Marketing - Email
  emailEnabled: boolean;
  emailProvider: string;
  emailFromEmail: string;
  emailFromName: string;
  emailNodemailerHost: string;
  emailNodemailerPort: number;
  emailNodemailerSecure: boolean;
  emailNodemailerUser: string;
  emailNodemailerPassword: string;
  emailSendgridApiKey: string;
  emailAwsSesRegion: string;
  emailAwsSesAccessKeyId: string;
  emailAwsSesSecretAccessKey: string;
  emailResendApiKey: string;
  emailMailgunApiKey: string;
  emailMailgunDomain: string;
  emailMailgunRegion: string;
  emailBrevoApiKey: string;
  // Email Styles
  emailPrimaryColor: string;
  emailSecondaryColor: string;
  emailBackgroundColor: string;
  emailTextColor: string;
  emailFontFamily: string;
  emailFontSize: string;
  emailButtonColor: string;
  emailButtonTextColor: string;
  // Delivery Tracking Settings
  deliveryTrackingEnabled: boolean;
  deliveryTrackingProvider: string;
  deliveryTrackingApiKey: string;
  deliveryTrackingApiUrl: string;
  deliveryTrackingAutoUpdate: boolean;
  deliveryTrackingUpdateInterval: number;
  deliveryTrackingStatusMapping: string;
  deliveryTrackingAutoMarkDelivered: boolean;
  deliveryTrackingAutoMarkNotReceived: boolean;
  deliveryTrackingNotReceivedDays: number;
  deliveryTrackingAutoMarkReturned: boolean;
  /** JSON: Record<providerCode, { apiKey: string; apiUrl?: string }> */
  deliveryTrackingProviders: string;
  /** API key for Yandex Geocoder (required for address geocoding in Yandex Delivery flow) */
  yandexGeocoderApiKey: string;
  // Marketing - Analytics
  analyticsEnabled: boolean;
  googleAnalyticsId: string; // GA4 Measurement ID (G-XXXXXXXXXX)
  yandexMetricaId: string; // Yandex Metrica counter ID
  // CAPTCHA Settings
  captchaEnabled: boolean;
  captchaProvider: string; // 'GOOGLE_RECAPTCHA_V2' | 'GOOGLE_RECAPTCHA_V3' | 'HCAPTCHA' | 'CLOUDFLARE_TURNSTILE'
  captchaSiteKey: string;
  captchaSecretKey: string;
  captchaThreshold: number; // Score threshold for reCAPTCHA v3 (0.0 to 1.0, default: 0.5)
  captchaRequiredForRegistration: boolean;
  captchaRequiredForLogin: boolean;
  registrationEnabled: boolean;
  loginEnabled: boolean;
  emailVerificationRequired: boolean;
  // Password policy
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  // Account lockout (failed login attempts)
  accountLockoutEnabled: boolean;
  accountLockoutAttempts: number;
  accountLockoutDurationMinutes: number;
  // Auth rate limits
  loginRateLimitMaxAttempts: number;
  loginRateLimitWindowMinutes: number;
  registrationRateLimitMaxAttempts: number;
  registrationRateLimitWindowMinutes: number;
  // Cart reservation (Awaiting Payment)
  cartReservationGuestMinutes: number;
  cartReservationRegisteredHours: number;
  cartMaxQuantityPerProduct: number;
  // Promo Code Settings
  promoCodeCreationDisabled: boolean;
}

export const settingsApi = {
  getAll: () => apiClient.get<{ settings: FeatureSettings }>('/settings'),
  getSetting: (key: string) => apiClient.get<{ key: string; value: unknown }>(`/settings/${key}`),
  updateSetting: (key: string, value: boolean | string | number | object, description?: string) =>
    apiClient.put<{ setting: { key: string; value: unknown } }>(`/settings/${key}`, {
      value,
      description,
    }),
  updateMultiple: (settings: Partial<FeatureSettings>) =>
    apiClient.put<{ settings: FeatureSettings }>('/settings', { settings }),
  resetToDefaults: () =>
    apiClient.post<{ settings: FeatureSettings; message: string }>('/settings/reset'),
  testEmail: (email?: string) =>
    apiClient.post<{ success: boolean; message?: string; error?: string }>('/settings/test-email', {
      email,
    }),
  testPinterest: () =>
    apiClient.post<{ success: boolean; message?: string; error?: string }>(
      '/settings/test-pinterest'
    ),
  uploadSiteFavicon: (file: File) => {
    const formData = new FormData();
    formData.append('file', normalizeUploadFile(file));
    return apiClient.post<{ url: string }>('/settings/favicon/upload', formData);
  },
  uploadSiteAppleTouchIcon: (file: File) => {
    const formData = new FormData();
    formData.append('file', normalizeUploadFile(file));
    return apiClient.post<{ url: string }>('/settings/apple-touch-icon/upload', formData);
  },
};
