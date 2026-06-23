import { writable } from 'svelte/store';
import { settingsApi, type FeatureSettings } from '../api/settings.api';
import { browser } from '$app/environment';

const DEFAULT_SETTINGS: FeatureSettings = {
  reviewsEnabled: false,
  paymentGatewaysEnabled: true,
  stripeEnabled: false,
  paypalEnabled: false,
  brandsEnabled: false,
  showBrandFilter: true,
  loyaltyProgramEnabled: false,
  loyaltyPointsEarnPerUnit: 1,
  loyaltyPointsSpendPerUnit: 100,
  filtersEnabled: true,
  categoryFilterEnabled: true,
  priceFilterEnabled: true,
  brandFilterEnabled: true,
  searchEnabled: true,
  wishlistEnabled: true,
  compareEnabled: false,
  newsletterEnabled: true,
  socialLoginEnabled: false,
  lookbookEnabled: false,
  quickViewEnabled: true,
  productRecommendationsEnabled: true,
  recentlyViewedEnabled: false,
  // Typography defaults
  fontFamily: 'Helvetica',
  fontSizeH1: '3rem',
  fontSizeH2: '2.25rem',
  fontSizeH3: '1.875rem',
  fontSizeH4: '1.5rem',
  fontSizeBody: '1rem',
  fontSizeSmall: '0.875rem',
  fontSizeButton: '1rem',
  textTransformUppercase: true,
  // Border Radius defaults
  borderRadiusCard: '0rem',
  borderRadiusButton: '0rem',
  siteFaviconUrl: '',
  siteAppleTouchIconUrl: '',
  // Color defaults
  colorWhite: '#ffffff',
  colorDark: '#e8e5e5',
  colorDarkLight: '#f5f5f5',
  colorDarkLighter: '#e5e5e5',
  colorAccent: '#1c1b1b',
  colorAccentMuted: '#666666',
  colorAccentLight: '#ded9d9',
  colorBackground: '#ffffff',
  colorBackgroundSecondary: '#f9f9f9',
  colorBlack: '#000000',
  // Product Page Design
  productPageDesign: 'classic',
  productImageAspectRatio: '9/16',
  productPageCompleteTheLookEnabled: true,
  productPageYouMightLikeEnabled: true,
  productPageYouMightLikeMode: 'similar',
  productPageYouViewedEnabled: true,
  productPageGridPanelBackgroundColor: '#ffffff',
  productPageGridPanelOpacity: 60,
  productPageGridPanelBlur: 12,
  productPageGridPanelBorderColor: '#e5e7eb',
  productPageGridPanelBorderOpacity: 0,
  productPageGridPanelBorderRadius: 0,
  // Shop Page Design
  shopGridColumns: '4',
  shopGridGap: '6',
  shopCardAspectRatio: '9/16',
  shopCardHoverImage: true,
  shopCardHoverAnimation: 'scale',
  shopCardVideoSupport: true,
  shopCardShowQuickAdd: false,
  shopHeaderStyle: 'plain',
  shopHeaderSpacing: 'comfortable',
  shopHeaderTitleScale: 'hero',
  shopHeaderAlignment: 'center',
  shopHeaderShowBreadcrumbs: true,
  shopHeaderShowTitle: true,
  shopHeaderShowCategories: true,
  shopHeaderShowCount: true,
  shopHeaderShowSideMenuTab: false,
  shopHeaderCategoryLimit: '8',
  shopMenuLabel: 'Menu',
  shopDefaultSort: 'createdAt_desc',
  shopDefaultInventoryStatus: '',
  shopToolbarStyle: 'minimal',
  shopToolbarCorners: 'square',
  shopToolbarDensity: 'comfortable',
  footerBackgroundColor: '#ffffff',
  footerTextColor: '#111111',
  footerMutedTextColor: '#6b7280',
  footerAccentColor: '#111111',
  footerSpacing: 'comfortable',
  footerAlignment: 'left',
  footerBrandTitleScale: 'medium',
  footerLinkTextSize: 'small',
  // Image Blur Feature
  imageBlurEnabled: false,
  // Marketing - Pinterest
  pinterestEnabled: false,
  pinterestAccessToken: '',
  pinterestBoardId: '',
  frontendBaseUrl: 'http://localhost:5173',
  storeCurrencies: ['USD', 'EUR', 'GBP', 'RUB', 'JPY', 'CNY', 'KRW'],
  defaultStoreCurrency: 'USD',
  // Marketing - Email
  emailEnabled: false,
  emailProvider: 'CONSOLE',
  emailFromEmail: 'noreply@example.com',
  emailFromName: 'Store',
  emailNodemailerHost: '',
  emailNodemailerPort: 587,
  emailNodemailerSecure: false,
  emailNodemailerUser: '',
  emailNodemailerPassword: '',
  emailSendgridApiKey: '',
  emailAwsSesRegion: '',
  emailAwsSesAccessKeyId: '',
  emailAwsSesSecretAccessKey: '',
  emailResendApiKey: '',
  emailMailgunApiKey: '',
  emailMailgunDomain: '',
  emailMailgunRegion: 'us',
  emailBrevoApiKey: '',
  // Email Styles
  emailPrimaryColor: '#111111',
  emailSecondaryColor: '#737373',
  emailBackgroundColor: '#ffffff',
  emailTextColor: '#171717',
  emailFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  emailFontSize: '16px',
  emailButtonColor: '#111111',
  emailButtonTextColor: '#ffffff',
  // Delivery Tracking defaults
  deliveryTrackingEnabled: false,
  deliveryTrackingProvider: 'MANUAL',
  deliveryTrackingApiKey: '',
  deliveryTrackingApiUrl: '',
  deliveryTrackingAutoUpdate: false,
  deliveryTrackingUpdateInterval: 60,
  deliveryTrackingStatusMapping: JSON.stringify({
    RUSSIAN_POST: {
      REGISTERED: 'SHIPPED',
      IN_TRANSIT: 'SHIPPED',
      ARRIVED: 'SHIPPED',
      DELIVERED: 'DELIVERED',
      RETURNED: 'RETURNED',
      NOT_RECEIVED: 'RETURN_REQUESTED',
    },
    CDEK: {
      ACCEPTED: 'SHIPPED',
      IN_TRANSIT: 'SHIPPED',
      ARRIVED: 'SHIPPED',
      DELIVERED: 'DELIVERED',
      RETURNED: 'RETURNED',
    },
  }),
  deliveryTrackingAutoMarkDelivered: false,
  deliveryTrackingAutoMarkNotReceived: false,
  deliveryTrackingNotReceivedDays: 30,
  deliveryTrackingAutoMarkReturned: false,
  deliveryTrackingProviders: '{}',
  yandexGeocoderApiKey: '',
  // Marketing - Analytics
  analyticsEnabled: false,
  googleAnalyticsId: '',
  yandexMetricaId: '',
  // CAPTCHA Settings
  captchaEnabled: false,
  captchaProvider: 'GOOGLE_RECAPTCHA_V3',
  captchaSiteKey: '',
  captchaSecretKey: '',
  captchaThreshold: 0.5,
  captchaRequiredForRegistration: false,
  captchaRequiredForLogin: false,
  // OAuth Settings
  oauthGoogleEnabled: false,
  oauthGoogleClientId: '',
  oauthGoogleClientSecret: '',
  oauthYandexEnabled: false,
  oauthYandexClientId: '',
  oauthYandexClientSecret: '',
  oauthVkontakteEnabled: false,
  oauthVkontakteClientId: '',
  oauthVkontakteClientSecret: '',
  oauthFacebookEnabled: false,
  oauthFacebookClientId: '',
  oauthFacebookClientSecret: '',
  oauthAppleEnabled: false,
  oauthAppleClientId: '',
  oauthAppleTeamId: '',
  oauthAppleKeyId: '',
  oauthApplePrivateKey: '',
  registrationEnabled: true,
  loginEnabled: true,
  emailVerificationRequired: false,
  // Password policy
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireLowercase: true,
  passwordRequireNumbers: false,
  passwordRequireSpecialChars: false,
  // Account lockout (failed login attempts)
  accountLockoutEnabled: true,
  accountLockoutAttempts: 5,
  accountLockoutDurationMinutes: 30,
  // Auth rate limits
  loginRateLimitMaxAttempts: 5,
  loginRateLimitWindowMinutes: 15,
  registrationRateLimitMaxAttempts: 3,
  registrationRateLimitWindowMinutes: 60,
  cartReservationGuestMinutes: 30,
  cartReservationRegisteredHours: 1,
  cartMaxQuantityPerProduct: 3,
  // Promo Code Settings
  promoCodeCreationDisabled: false,
};

const createSettingsStore = () => {
  const { subscribe, set, update } = writable<FeatureSettings>(DEFAULT_SETTINGS);

  // Load settings on init
  if (browser) {
    loadSettings();
  }

  async function loadSettings() {
    try {
      const response = await settingsApi.getAll();
      set(response.settings);
      applyTypographySettings(response.settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use defaults if loading fails
      set(DEFAULT_SETTINGS);
      applyTypographySettings(DEFAULT_SETTINGS);
    }
  }

  function loadGoogleFont(fontFamily: string) {
    if (!browser) return;

    // Google Fonts that need to be loaded
    const googleFonts: Record<string, string> = {
      Inter: 'Inter:wght@300;400;500;600;700',
      Roboto: 'Roboto:wght@300;400;500;700',
      'Open Sans': 'Open+Sans:wght@300;400;600;700',
      Montserrat: 'Montserrat:wght@300;400;500;600;700',
      Lato: 'Lato:wght@300;400;700',
      Poppins: 'Poppins:wght@300;400;500;600;700',
      Raleway: 'Raleway:wght@300;400;500;600;700',
      'Playfair Display': 'Playfair+Display:wght@400;700',
    };

    // System fonts don't need loading
    const systemFonts = ['Helvetica', 'Arial', 'Copperplate'];
    if (systemFonts.includes(fontFamily)) {
      return;
    }

    const fontUrl = googleFonts[fontFamily];
    if (!fontUrl) {
      console.warn(`Font ${fontFamily} not found in Google Fonts list`);
      return;
    }

    // Check if font is already loaded
    const existingLink = document.querySelector(`link[data-font="${fontFamily}"]`);
    if (existingLink) {
      return;
    }

    // Create and append link tag
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontUrl}&display=swap`;
    link.setAttribute('data-font', fontFamily);
    document.head.appendChild(link);
  }

  function applyTypographySettings(settings: FeatureSettings) {
    if (!browser) return;

    // Load Google Font if needed
    loadGoogleFont(settings.fontFamily);

    const root = document.documentElement;

    // Apply font family
    root.style.setProperty('--font-family', settings.fontFamily);

    // Apply font sizes
    root.style.setProperty('--font-size-h1', settings.fontSizeH1);
    root.style.setProperty('--font-size-h2', settings.fontSizeH2);
    root.style.setProperty('--font-size-h3', settings.fontSizeH3);
    root.style.setProperty('--font-size-h4', settings.fontSizeH4);
    root.style.setProperty('--font-size-body', settings.fontSizeBody);
    root.style.setProperty('--font-size-small', settings.fontSizeSmall);
    root.style.setProperty('--font-size-button', settings.fontSizeButton);

    // Apply text transform
    if (settings.textTransformUppercase) {
      root.style.setProperty('--text-transform', 'uppercase');
    } else {
      root.style.setProperty('--text-transform', 'none');
    }

    // Apply colors
    root.style.setProperty('--color-white', settings.colorWhite);
    root.style.setProperty('--color-dark', settings.colorDark);
    root.style.setProperty('--color-dark-light', settings.colorDarkLight);
    root.style.setProperty('--color-dark-lighter', settings.colorDarkLighter);
    root.style.setProperty('--color-accent', settings.colorAccent);
    root.style.setProperty('--color-accent-muted', settings.colorAccentMuted);
    root.style.setProperty('--color-accent-light', settings.colorAccentLight);
    root.style.setProperty('--color-background', settings.colorBackground);
    root.style.setProperty('--color-background-secondary', settings.colorBackgroundSecondary);
    root.style.setProperty('--color-black', settings.colorBlack);

    // Apply border radius
    root.style.setProperty('--border-radius-card', settings.borderRadiusCard);
    root.style.setProperty('--border-radius-button', settings.borderRadiusButton);
  }

  return {
    subscribe,
    load: loadSettings,
    updateSetting: async (key: keyof FeatureSettings, value: boolean | string | number) => {
      try {
        await settingsApi.updateSetting(key, value);
        update((settings) => {
          const updated = {
            ...settings,
            [key]: value,
          };
          applyTypographySettings(updated);
          return updated;
        });
      } catch (error) {
        console.error('Failed to update setting:', error);
        throw error;
      }
    },
    updateMultiple: async (updates: Partial<FeatureSettings>) => {
      try {
        const response = await settingsApi.updateMultiple(updates);
        set(response.settings);
        applyTypographySettings(response.settings);
      } catch (error) {
        console.error('Failed to update settings:', error);
        throw error;
      }
    },
    reset: async () => {
      try {
        const response = await settingsApi.resetToDefaults();
        set(response.settings);
        applyTypographySettings(response.settings);
      } catch (error) {
        console.error('Failed to reset settings:', error);
        throw error;
      }
    },
    getSetting: async (key: string) => {
      try {
        const response = await settingsApi.getSetting(key);
        return response.value;
      } catch (error) {
        console.error('Failed to get setting:', error);
        throw error;
      }
    },
  };
};

export const settingsStore = createSettingsStore();
