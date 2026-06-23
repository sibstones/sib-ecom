export interface FeatureSettings {
  // Reviews & Ratings
  reviewsEnabled: boolean;
  
  // Payment
  paymentGatewaysEnabled: boolean;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  
  // Brands
  brandsEnabled: boolean;
  showBrandFilter: boolean;
  
  // Loyalty
  loyaltyProgramEnabled: boolean;
  /** Points earned per 1 unit of currency (e.g. 1 = 1 point per $1) */
  loyaltyPointsEarnPerUnit: number;
  /** Points required for 1 unit of currency discount (e.g. 100 = 100 points for $1) */
  loyaltyPointsSpendPerUnit: number;
  
  // Filters
  filtersEnabled: boolean;
  categoryFilterEnabled: boolean;
  priceFilterEnabled: boolean;
  brandFilterEnabled: boolean;
  searchEnabled: boolean;
  
  // Other features
  wishlistEnabled: boolean;
  compareEnabled: boolean;
  newsletterEnabled: boolean;
  socialLoginEnabled: boolean;
  lookbookEnabled: boolean;
  
  // UI Features
  quickViewEnabled: boolean;
  productRecommendationsEnabled: boolean;
  recentlyViewedEnabled: boolean;
  
  // Typography Settings
  fontFamily: string; // e.g., "Inter", "Helvetica", "Arial", "Roboto", "Open Sans"
  fontSizeH1: string; // e.g., "4rem", "3.5rem", "3rem"
  fontSizeH2: string; // e.g., "3rem", "2.5rem", "2rem"
  fontSizeH3: string; // e.g., "2rem", "1.75rem", "1.5rem"
  fontSizeH4: string; // e.g., "1.5rem", "1.25rem", "1.125rem"
  fontSizeBody: string; // e.g., "1rem", "0.875rem", "1.125rem"
  fontSizeSmall: string; // e.g., "0.875rem", "0.75rem", "0.8125rem"
  fontSizeButton: string; // e.g., "1rem", "0.875rem", "1.125rem"
  textTransformUppercase: boolean; // Apply uppercase to all text
  
  // Border Radius Settings
  borderRadiusCard: string; // e.g., "0.5rem", "0.75rem", "1rem", "0" (for square corners)
  borderRadiusButton: string; // e.g., "0.5rem", "0.75rem", "1rem", "9999px" (for fully rounded)

  /** Public URL for site favicon (PNG, ICO, SVG, WebP); empty = built-in default */
  siteFaviconUrl: string;
  /** Public URL for Apple touch icon (PNG/JPEG/WebP, often 180×180); empty = omit link */
  siteAppleTouchIconUrl: string;

  // Color Settings
  colorWhite: string; // e.g., "#ffffff"
  colorDark: string; // e.g., "#e8e5e5"
  colorDarkLight: string; // e.g., "#f5f5f5"
  colorDarkLighter: string; // e.g., "#e5e5e5"
  colorAccent: string; // e.g., "#1c1b1b"
  colorAccentMuted: string; // e.g., "#666666"
  colorAccentLight: string; // e.g., "#ded9d9"
  colorBackground: string; // e.g., "#ffffff"
  colorBackgroundSecondary: string; // e.g., "#f9f9f9"
  colorBlack: string; // e.g., "#000000"
  
  // Product Page Design
  productPageDesign: string; // "classic" | "modern" | "minimalist" | "grid"
  productImageAspectRatio: string; // "9/16" | "3/4" | "16/9" | "1/1" | "4/5" | etc.
  /** Global toggle: show "Complete the Look" section on product pages */
  productPageCompleteTheLookEnabled: boolean;
  /** Show "You might like" recommendations section */
  productPageYouMightLikeEnabled: boolean;
  /** "You might like" mode: smart = use product relatedProducts, similar = same category/brand */
  productPageYouMightLikeMode: string; // "smart" | "similar"
  /** Show "You viewed" (recently viewed) section */
  productPageYouViewedEnabled: boolean;
  /** Journal/grid product info panel background tint */
  productPageGridPanelBackgroundColor: string;
  /** Journal/grid product info panel opacity in percent */
  productPageGridPanelOpacity: number;
  /** Journal/grid product info panel backdrop blur in px */
  productPageGridPanelBlur: number;
  /** Journal/grid product info panel border color */
  productPageGridPanelBorderColor: string;
  /** Journal/grid product info panel border opacity in percent */
  productPageGridPanelBorderOpacity: number;
  /** Journal/grid product info panel border radius in px */
  productPageGridPanelBorderRadius: number;
  
  // Shop Page Design (grid, card, hover, video)
  shopGridColumns: string; // "2" | "3" | "4" | "5" | "6"
  shopGridGap: string; // "2" | "4" | "6" | "8"
  shopCardAspectRatio: string; // "9/16" | "3/4" | "1/1" | "4/5" | "16/9"
  shopCardHoverImage: boolean; // show second image on hover
  shopCardHoverAnimation: string; // "scale" | "none" | "fade"
  shopCardVideoSupport: boolean; // show video if first media is video
  shopCardShowQuickAdd: boolean; // show Add to bag on card hover
  shopHeaderStyle: string; // "plain" | "card" | "soft"
  shopHeaderSpacing: string; // "compact" | "comfortable" | "airy"
  shopHeaderTitleScale: string; // "medium" | "large" | "hero"
  shopHeaderAlignment: string; // "left" | "center"
  shopHeaderShowBreadcrumbs: boolean;
  shopHeaderShowTitle: boolean;
  shopHeaderShowCategories: boolean;
  shopHeaderShowCount: boolean;
  shopHeaderShowSideMenuTab: boolean;
  shopHeaderCategoryLimit: string; // "4" | "6" | "8" | "12" | "15"
  shopMenuLabel: string;
  shopDefaultSort: string; // "createdAt_desc" | "price_asc" | "price_desc" | "name_asc"
  shopDefaultInventoryStatus: string; // "" | "COMING_SOON" | "IN_SALE" | "OUT_OF_STOCK"
  shopToolbarStyle: string; // "minimal" | "boxed" | "soft"
  shopToolbarCorners: string; // "square" | "rounded" | "pill"
  shopToolbarDensity: string; // "compact" | "comfortable" | "airy"
  footerBackgroundColor: string;
  footerTextColor: string;
  footerMutedTextColor: string;
  footerAccentColor: string;
  footerSpacing: string; // "compact" | "comfortable" | "airy"
  footerAlignment: string; // "left" | "center"
  footerBrandTitleScale: string; // "small" | "medium" | "large"
  footerLinkTextSize: string; // "small" | "medium" | "large"

  // Image Blur Feature
  imageBlurEnabled: boolean; // Enable image blur for non-authenticated users
  
  // Marketing - Pinterest
  pinterestEnabled: boolean;
  pinterestAccessToken: string;
  pinterestBoardId: string;
  frontendBaseUrl: string;
  storeCurrencies: string[];
  defaultStoreCurrency: string;
  
  // Marketing - Email
  emailEnabled: boolean;
  emailProvider: string; // 'NODEMAILER' | 'SENDGRID' | 'AWS_SES' | 'CONSOLE'
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
  // Resend settings
  emailResendApiKey: string;
  // Mailgun settings
  emailMailgunApiKey: string;
  emailMailgunDomain: string;
  emailMailgunRegion: string;
  // Brevo settings
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
  deliveryTrackingProvider: string; // 'RUSSIAN_POST' | 'CDEK' | 'BOXBERRY' | 'YANDEX_DELIVERY' | 'DHL' | 'FEDEX' | 'UPS' | 'USPS' | 'ARAMEX' | 'AFTERSHIP' | 'TRACKINGMORE' | 'MANUAL' | 'CUSTOM_API'
  deliveryTrackingApiKey: string;
  deliveryTrackingApiUrl: string;
  deliveryTrackingAutoUpdate: boolean; // Auto-update tracking statuses
  deliveryTrackingUpdateInterval: number; // Check interval in minutes (default 60)
  deliveryTrackingStatusMapping: string; // JSON string mapping provider statuses to order statuses
  // Auto status change settings
  deliveryTrackingAutoMarkDelivered: boolean; // Auto-mark as delivered
  deliveryTrackingAutoMarkNotReceived: boolean; // Auto-mark as not received (after deadline)
  deliveryTrackingNotReceivedDays: number; // Days until auto "not received" status (default 30)
  deliveryTrackingAutoMarkReturned: boolean; // Auto-mark returns
  /** JSON: Record<providerCode, { apiKey: string; apiUrl?: string }> — multiple providers with their own keys */
  deliveryTrackingProviders: string;

  // Marketing - Analytics
  analyticsEnabled: boolean;
  googleAnalyticsId: string; // GA4 Measurement ID (G-XXXXXXXXXX)
  yandexMetricaId: string; // Yandex Metrica counter ID
  
  // Authentication & Registration Settings
  registrationEnabled: boolean; // Enable/disable user registration
  loginEnabled: boolean; // Enable/disable user login
  passwordMinLength: number; // Minimum password length (default: 8)
  passwordRequireUppercase: boolean; // Require uppercase letters in password
  passwordRequireLowercase: boolean; // Require lowercase letters in password
  passwordRequireNumbers: boolean; // Require numbers in password
  passwordRequireSpecialChars: boolean; // Require special characters in password
  loginRateLimitMaxAttempts: number; // Maximum login attempts per window (default: 5)
  loginRateLimitWindowMinutes: number; // Rate limit window in minutes (default: 15)
  registrationRateLimitMaxAttempts: number; // Maximum registration attempts per window (default: 3)
  registrationRateLimitWindowMinutes: number; // Registration rate limit window in minutes (default: 60)
  accountLockoutEnabled: boolean; // Enable account lockout after failed attempts
  accountLockoutAttempts: number; // Number of failed attempts before lockout (default: 5)
  accountLockoutDurationMinutes: number; // Account lockout duration in minutes (default: 30)
  emailVerificationRequired: boolean; // Require verified email to sign in; registration sends link only (no session until verify)
  
  // CAPTCHA Settings
  captchaEnabled: boolean; // Enable CAPTCHA protection
  captchaProvider: string; // 'GOOGLE_RECAPTCHA_V2' | 'GOOGLE_RECAPTCHA_V3' | 'HCAPTCHA' | 'CLOUDFLARE_TURNSTILE'
  captchaSiteKey: string; // Public site key for CAPTCHA
  captchaSecretKey: string; // Secret key for CAPTCHA verification (stored securely)
  captchaThreshold: number; // Score threshold for reCAPTCHA v3 (0.0 to 1.0, default: 0.5)
  captchaRequiredForRegistration: boolean; // Require CAPTCHA for registration
  captchaRequiredForLogin: boolean; // Require CAPTCHA for login (after rate limit exceeded)
  
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
  oauthApplePrivateKey: string; // Base64 encoded private key
  
  // Yandex Delivery Settings
  yandexDeliveryEnabled: boolean;
  yandexDeliveryApiToken: string; // OAuth token for Yandex Delivery API
  yandexGeocoderApiKey: string; // API key for Yandex Geocoder (optional)
  yandexDeliverySenderName: string; // Sender name
  yandexDeliverySenderPhone: string; // Sender phone
  yandexDeliverySenderAddress: string; // Sender address (warehouse)
  yandexDeliverySenderCoordinates: string; // Sender coordinates "lat,lon"
  yandexDeliveryPickupPointsCache: string; // JSON pickup points cache (optional)

  // Cart reservation (Awaiting Payment)
  /** Guest cart reservation TTL in minutes (default: 30) */
  cartReservationGuestMinutes: number;
  /** Registered user cart reservation TTL in hours (default: 24) */
  cartReservationRegisteredHours: number;
  /** Max quantity per product (product+size) in cart for reservation (default: 3) */
  cartMaxQuantityPerProduct: number;

  // Promo Code Settings
  promoCodeCreationDisabled: boolean; // Disable promo creation via AI/GPT (admins can create manually)
}

export interface UpdateSettingsDto {
  key: string;
  value: boolean | string | number | object;
  description?: string;
}

export const DEFAULT_SETTINGS: FeatureSettings = {
  reviewsEnabled: true,
  paymentGatewaysEnabled: true,
  stripeEnabled: false,
  paypalEnabled: false,
  brandsEnabled: true,
  showBrandFilter: true,
  loyaltyProgramEnabled: true,
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
  textTransformUppercase: false,
  // Border Radius defaults
  borderRadiusCard: '0',
  borderRadiusButton: '0',
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
  emailFromName: 'Fashion Store',
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
  // Email Styles (minimal defaults; wrapper uses soft gray outer + white card)
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
    // Example mapping for Russian Post
    'RUSSIAN_POST': {
      'REGISTERED': 'SHIPPED',
      'IN_TRANSIT': 'SHIPPED',
      'ARRIVED': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'RETURNED': 'RETURNED',
      'NOT_RECEIVED': 'RETURN_REQUESTED'
    },
    // Example mapping for CDEK
    'CDEK': {
      'ACCEPTED': 'SHIPPED',
      'IN_TRANSIT': 'SHIPPED',
      'ARRIVED': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'RETURNED': 'RETURNED'
    },
    // Example mapping for DHL
    'DHL': {
      'PRE_TRANSIT': 'SHIPPED',
      'TRANSIT': 'SHIPPED',
      'OUT_FOR_DELIVERY': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'RETURNED': 'RETURNED',
      'RETURNED_TO_SHIPPER': 'RETURNED',
      'EXCEPTION': 'RETURN_REQUESTED'
    },
    // Example mapping for FedEx
    'FEDEX': {
      'OC': 'SHIPPED',
      'OD': 'DELIVERED',
      'DL': 'DELIVERED',
      'DP': 'SHIPPED',
      'AF': 'SHIPPED',
      'RS': 'RETURNED',
      'CA': 'RETURN_REQUESTED'
    },
    // Example mapping for UPS
    'UPS': {
      'I': 'SHIPPED',
      'P': 'SHIPPED',
      'D': 'DELIVERED',
      'X': 'RETURNED',
      'R': 'RETURNED'
    },
    // Example mapping for USPS
    'USPS': {
      'In Transit': 'SHIPPED',
      'Out for Delivery': 'SHIPPED',
      'Delivered': 'DELIVERED',
      'Returned': 'RETURNED',
      'Return to Sender': 'RETURNED',
      'Exception': 'RETURN_REQUESTED'
    },
    // Example mapping for Aramex
    'ARAMEX': {
      'SH': 'SHIPPED',
      'IT': 'SHIPPED',
      'OD': 'SHIPPED',
      'DR': 'DELIVERED',
      'RT': 'RETURNED',
      'RS': 'RETURNED',
      'EX': 'RETURN_REQUESTED'
    }
  }),
  deliveryTrackingAutoMarkDelivered: false,
  deliveryTrackingAutoMarkNotReceived: false,
  deliveryTrackingNotReceivedDays: 30,
  deliveryTrackingAutoMarkReturned: false,
  deliveryTrackingProviders: '{}',
  // Marketing - Analytics
  analyticsEnabled: false,
  googleAnalyticsId: '',
  yandexMetricaId: '',
  // Authentication & Registration defaults
  registrationEnabled: true,
  loginEnabled: true,
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireLowercase: true,
  passwordRequireNumbers: false,
  passwordRequireSpecialChars: false,
  loginRateLimitMaxAttempts: 5,
  loginRateLimitWindowMinutes: 15,
  registrationRateLimitMaxAttempts: 3,
  registrationRateLimitWindowMinutes: 60,
  accountLockoutEnabled: true,
  accountLockoutAttempts: 5,
  accountLockoutDurationMinutes: 30,
  emailVerificationRequired: false,
  // CAPTCHA defaults
  captchaEnabled: false,
  captchaProvider: 'GOOGLE_RECAPTCHA_V3',
  captchaSiteKey: '',
  captchaSecretKey: '',
  captchaThreshold: 0.5,
  captchaRequiredForRegistration: false,
  captchaRequiredForLogin: false,
  // OAuth defaults
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
  // Yandex Delivery defaults
  yandexDeliveryEnabled: false,
  yandexDeliveryApiToken: '',
  yandexGeocoderApiKey: '',
  yandexDeliverySenderName: '',
  yandexDeliverySenderPhone: '',
  yandexDeliverySenderAddress: '',
  yandexDeliverySenderCoordinates: '',
  yandexDeliveryPickupPointsCache: '',
  // Cart reservation defaults
  cartReservationGuestMinutes: 30,
  cartReservationRegisteredHours: 1,
  cartMaxQuantityPerProduct: 3,
  // Promo Code defaults
  promoCodeCreationDisabled: false, // Creation allowed by default
};
