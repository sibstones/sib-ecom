export interface RegisterDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  promoCode?: string; // Promo code required for registration
  captchaToken?: string; // CAPTCHA token for bot protection
}

export interface LoginDto {
  email: string;
  password: string;
  captchaToken?: string; // CAPTCHA token for bot protection (required after rate limit)
  /** Short-lived JWT from the first login step when 2FA is enabled */
  twoFactorToken?: string;
  /** TOTP code from authenticator app */
  twoFactorCode?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    isPartner?: boolean;
    partnerStatus?: string | null;
    emailVerified?: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
  /** True when registration completed but session was not issued until email is verified */
  requiresEmailVerification?: boolean;
  /** Password verified; client must send TOTP with twoFactorToken */
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}

export interface RefreshTokenDto {
  refreshToken?: string;
}
