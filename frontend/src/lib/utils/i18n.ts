import { i18nStore } from '$lib/stores/i18n.store';
import { get } from 'svelte/store';
import { getTranslation, getLoadedTranslations } from './i18n-loader';
import { LOOKBOOK_SEASON_I18N } from '$lib/constants/lookbook-seasons';

// Backward-compatible translation cache used by this module.
export const translations = getLoadedTranslations();

/**
 * Get translation for a key in the current language
 * @param key - Translation key (e.g., 'common.save')
 * @param params - Optional parameters to replace in the translation
 * @returns Translated string
 */
/**
 * Translate backend error messages to localized strings
 * @param errorMessage - Error message from backend
 * @returns Translated error message
 */
export function translateError(errorMessage: string): string {
  const errorMap: Record<string, string> = {
    'Invalid email or password': 'error.invalidEmailOrPassword',
    'Account is deactivated. Please contact administrator.': 'error.accountDeactivated',
    'Account is deactivated': 'error.accountDeactivated',
    'User with this email already exists': 'error.userAlreadyExists',
    'Invalid or expired refresh token': 'error.invalidOrExpiredToken',
    'Invalid or expired token': 'error.invalidOrExpiredToken',
    'Invalid or expired access token': 'error.invalidOrExpiredToken',
    'No token provided': 'error.noTokenProvided',
    'Your session has expired. Please log in again.': 'error.sessionExpired',
    'Invalid or expired promo code': 'error.invalidPromoCode',
    'Invalid email': 'error.invalidEmail',
    'Please verify your email before signing in.': 'error.verifyEmailBeforeLogin',
    'Invalid or expired verification link. Please request a new verification email.':
      'error.invalidVerificationLink',
    'This email address is already verified.': 'error.emailAlreadyVerified',
    'Could not send verification email. Check email settings and try again.':
      'error.verificationEmailSendFailed',
    'Invalid authentication code': 'error.invalidAuthCode',
    'Invalid or expired two-factor login token': 'error.twoFactorTokenExpired',
    'Two-factor authentication requires a password on your account.': 'error.twoFaNeedsPassword',
    'Two-factor authentication is already enabled. Disable it before setting up again.':
      'error.twoFaAlreadyOn',
    'No two-factor setup in progress. Start setup first.': 'error.twoFaNoSetupInProgress',
    'Two-factor authentication is not enabled.': 'error.twoFaNotEnabled',
  };

  const splitValidationParts = (text: string): string[] => {
    // Split only when the next part looks like another "field: message" entry.
    // This avoids breaking Zod messages that contain commas (e.g. "Expected ..., received ...").
    return text
      .split(/,\s*(?=[^,]+:\s*)/g)
      .map((p) => p.trim())
      .filter(Boolean);
  };

  // Helper function to translate a single validation error
  const translateValidationError = (errorText: string): string => {
    // Handle validation errors in format "field: message" (e.g., "body.email: Invalid email")
    if (errorText.includes(':')) {
      const colonIndex = errorText.indexOf(':');
      const field = errorText.substring(0, colonIndex).trim();
      const message = errorText.substring(colonIndex + 1).trim();

      // Humanize common Zod enum errors (especially query params used by filters/sort UI)
      if (message.startsWith('Invalid enum value.')) {
        const match = message.match(/^Invalid enum value\.\s*Expected\s+(.+),\s*received\s+(.+)$/);
        if (match) {
          const expected = Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
          const received =
            Array.from(match[2].matchAll(/'([^']+)'/g)).map((m) => m[1])[0] ?? match[2];

          const fieldLabel =
            field === 'query.sortBy' ? t('filter.sortBy') : field.replace(/^query\./, '');

          const currentLang = get(i18nStore);
          if (currentLang === 'ru') {
            return `${fieldLabel}: недопустимое значение "${received}". Допустимо: ${expected.join(', ')}`;
          }
          return `${fieldLabel}: invalid value "${received}". Expected: ${expected.join(', ')}`;
        }
      }

      // Try to translate the message part
      const translationKey = errorMap[message];
      if (translationKey) {
        return `${field}: ${t(translationKey)}`;
      }

      // Check if message contains any of the error strings
      for (const [errorTextKey, key] of Object.entries(errorMap)) {
        if (message.includes(errorTextKey)) {
          return `${field}: ${t(key)}`;
        }
      }
    }
    return errorText;
  };

  // Handle errors in format "Validation error (field: message)" or "Error (field: message)"
  const bracketMatch = errorMessage.match(/^(.+?)\s*\((.+)\)$/);
  if (bracketMatch) {
    const prefix = bracketMatch[1].trim();
    const validationErrors = bracketMatch[2];

    // Translate validation errors inside brackets
    const translatedErrors = splitValidationParts(validationErrors)
      .map((err) => translateValidationError(err.trim()))
      .join(', ');

    return `${prefix} (${translatedErrors})`;
  }

  // Handle validation errors in format "field: message" (e.g., "body.email: Invalid email")
  // Also handle multiple errors separated by commas
  if (errorMessage.includes(':')) {
    // Split by comma first to handle multiple errors
    const errorParts = splitValidationParts(errorMessage);
    const translatedParts = errorParts.map((part) => translateValidationError(part));
    return translatedParts.join(', ');
  }

  // Check exact match first
  const translationKey = errorMap[errorMessage];
  if (translationKey) {
    return t(translationKey);
  }

  // Check if message contains any of the error strings (for partial matches)
  for (const [errorText, key] of Object.entries(errorMap)) {
    if (errorMessage.includes(errorText)) {
      return t(key);
    }
  }

  // Return original message if no translation found
  return errorMessage;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const currentLang = get(i18nStore);
  const translation = getTranslation(currentLang, key);

  if (params) {
    return Object.entries(params).reduce(
      (str, [paramKey, paramValue]) => str.replace(`{${paramKey}}`, String(paramValue)),
      translation
    );
  }

  return translation;
}

/**
 * Translates a season name (Spring, Summer, Fall, Winter) to the current language
 */
export function translateSeason(season: string | null | undefined): string {
  if (!season) return '';

  const translationKey =
    LOOKBOOK_SEASON_I18N[season as keyof typeof LOOKBOOK_SEASON_I18N] ??
    `lookbook.${season.toLowerCase().replace(/\//g, '')}`;

  const currentLang = get(i18nStore);
  const translation = getTranslation(currentLang, translationKey);

  return translation || season;
}

/**
 * Get translation for a key in a specific language
 * @param key - Translation key
 * @param languageCode - Language code (e.g., 'en', 'ru')
 * @param params - Optional parameters to replace in the translation
 * @returns Translated string
 */
export function tLang(
  key: string,
  languageCode: string,
  params?: Record<string, string | number>
): string {
  const translation = getTranslation(languageCode, key);

  if (params) {
    return Object.entries(params).reduce(
      (str, [paramKey, paramValue]) => str.replace(`{${paramKey}}`, String(paramValue)),
      translation
    );
  }

  return translation;
}

/**
 * Format order status with translation
 * @param status - Order status code
 * @returns Translated status string
 */
export function formatOrderStatus(status: string): string {
  const statusKey = `status.${status.toLowerCase()}`;
  return t(statusKey) || status;
}

/**
 * Format payment status with translation
 * @param status - Payment status code
 * @returns Translated status string
 */
export function formatPaymentStatus(status: string): string {
  const statusKey = `payment.${status.toLowerCase()}`;
  return t(statusKey) || status;
}

/**
 * Format ticket status with translation
 * @param status - Ticket status code
 * @returns Translated status string
 */
export function formatTicketStatus(status: string): string {
  const statusKey = `ticket.${status.toLowerCase().replace('_', '')}`;
  return t(statusKey) || status;
}

/** Footer column/link i18n keys — when stored in DB, they are auto-translated per locale. */
export const FOOTER_I18N_KEYS = new Set([
  'footer.shop',
  'footer.company',
  'footer.customer',
  'footer.allProducts',
  'footer.about',
  'footer.contact',
  'footer.myAccount',
  'footer.orders',
  'footer.shipping',
  'footer.returns',
  'footer.privacy',
  'footer.terms',
]);

export function isFooterI18nKey(value: string): boolean {
  return typeof value === 'string' && value.trim() !== '' && FOOTER_I18N_KEYS.has(value.trim());
}

/**
 * Resolve footer column title or link text: if it's a known i18n key, return t(key); otherwise return as-is (custom text or from translations).
 */
export function resolveFooterText(keyOrText: string): string {
  if (!keyOrText) return '';
  return isFooterI18nKey(keyOrText) ? t(keyOrText.trim()) : keyOrText;
}
