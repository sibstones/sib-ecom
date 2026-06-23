import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend folder (works when running from monorepo root)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback: cwd

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDurationToMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const s = value.trim();
  if (!s) return fallbackMs;
  if (/^\d+$/.test(s)) return parseInt(s, 10) * 1000;
  const m = s.match(/^(\d+)([smhd])$/i);
  if (!m) return fallbackMs;
  const amount = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (unitMs[unit] || 1000);
}

function parseSameSite(
  value: string | undefined
): 'strict' | 'lax' | 'none' {
  const v = (value || 'lax').toLowerCase();
  if (v === 'strict' || v === 'none') return v;
  return 'lax';
}

function isValidEncryptionKey(raw: string | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < 32) return false;

  // Accept hex keys (at least 32 bytes => 64 hex chars).
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length >= 64) {
    return true;
  }

  // Accept base64 keys that decode to at least 32 bytes.
  try {
    const buf = Buffer.from(trimmed, 'base64');
    return buf.length >= 32;
  } catch {
    return false;
  }
}

function hasNonEmptyValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSecureSecret(raw: string | undefined, minLength: number = 32): boolean {
  return hasNonEmptyValue(raw) && raw!.trim().length >= minLength;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  rag: {
    enabled: parseBoolean(process.env.RAG_ENABLED, false),
    databaseUrl: process.env.RAG_DATABASE_URL || '',
    databaseDirectUrl: process.env.RAG_DATABASE_DIRECT_URL || '',
    embeddingProvider: process.env.RAG_EMBEDDING_PROVIDER || 'openai',
    embeddingModel: process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-large',
    retrievalTopK: parseInteger(process.env.RAG_RETRIEVAL_TOP_K, 8),
    retrievalMinScore: parseFloatNumber(process.env.RAG_RETRIEVAL_MIN_SCORE, 0.2),
    hybridSearchEnabled: parseBoolean(process.env.RAG_HYBRID_SEARCH_ENABLED, true),
    rerankEnabled: parseBoolean(process.env.RAG_RERANK_ENABLED, false),
    citationsEnabled: parseBoolean(process.env.RAG_CITATIONS_ENABLED, true),
    adminEnabled: parseBoolean(process.env.RAG_ADMIN_ENABLED, false),
    customerEnabled: parseBoolean(process.env.RAG_CUSTOMER_ENABLED, false),
    guestEnabled: parseBoolean(process.env.RAG_GUEST_ENABLED, false),
    healthCacheMs: parseInteger(process.env.RAG_HEALTH_CACHE_MS, 30000),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key-min-32-chars-for-testing',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-key-min-32-chars-for-testing',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  auth: {
    requireAdminTwoFactorInProduction: parseBoolean(
      process.env.REQUIRE_ADMIN_TWO_FACTOR_IN_PRODUCTION,
      true
    ),
    maxActiveSessionsPerUser: parseInteger(process.env.MAX_ACTIVE_SESSIONS_PER_USER, 5),
  },
  authCookies: {
    accessName: process.env.AUTH_ACCESS_COOKIE_NAME || 'access_token',
    refreshName: process.env.AUTH_REFRESH_COOKIE_NAME || 'refresh_token',
    secure: process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: parseSameSite(process.env.AUTH_COOKIE_SAMESITE),
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    path: '/',
    accessMaxAgeMs: parseDurationToMs(process.env.JWT_EXPIRES_IN || '15m', 15 * 60 * 1000),
    refreshMaxAgeMs: parseDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN || '7d', 7 * 24 * 60 * 60 * 1000),
  },
  cors: {
    origin: (() => {
      // If CORS_ORIGIN is set, use it (supports comma-separated origins)
      if (process.env.CORS_ORIGIN) {
        const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
        return origins.length === 1 ? origins[0] : origins;
      }
      // In development, allow common Vite dev server ports
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        return [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://localhost:5176',
          'http://localhost:3000',
        ];
      }
      // In production, default to empty (should be set via env var)
      return process.env.CORS_ORIGIN || '';
    })(),
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '20971520', 10),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    region: process.env.MINIO_REGION || 'us-east-1',
    bucketName: process.env.MINIO_BUCKET_NAME || 'fashion-uploads',
    privateBucketName:
      process.env.MINIO_PRIVATE_BUCKET_NAME ||
      `${process.env.MINIO_BUCKET_NAME || 'fashion-uploads'}-private`,
    publicUrl: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
  },
  pinterest: {
    accessToken: process.env.PINTEREST_ACCESS_TOKEN || '',
    boardId: process.env.PINTEREST_BOARD_ID,
    enabled: process.env.PINTEREST_ENABLED === 'true',
  },
  frontend: {
    baseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
  },
  /** TOTP issuer label shown in authenticator apps (e.g. Google Authenticator). */
  twoFactor: {
    issuer: process.env.TWO_FACTOR_ISSUER || 'Fashion',
  },
  /** ClamAV (optional). When CLAMAV_ENABLED=true and clamscan is installed, uploads are scanned. */
  avScan: {
    enabled: process.env.CLAMAV_ENABLED === 'true',
    socket: process.env.CLAMAV_SOCKET || '',
    host: process.env.CLAMAV_HOST || '',
    port: parseInt(process.env.CLAMAV_PORT || '3310', 10) || 3310,
    timeout: parseInt(process.env.CLAMAV_TIMEOUT_MS || '60000', 10) || 60000,
  },
  /** CSRF double-submit cookie. */
  csrf: {
    cookieName: process.env.CSRF_COOKIE_NAME || 'csrf_token',
    cookieMaxAgeMs: parseInt(process.env.CSRF_COOKIE_MAX_AGE_MS || '3600000', 10) || 3600000, // 1 hour
    /** lax (default): reliable with Vite proxy and API on another port. Use CSRF_COOKIE_SAME_SITE=strict only if you know you need it. */
    sameSite: parseSameSite(process.env.CSRF_COOKIE_SAME_SITE),
  },
  botProtection: {
    failClosedInProduction: parseBoolean(process.env.BOT_PROTECTION_FAIL_CLOSED_IN_PRODUCTION, true),
    captcha: {
      enabledInProduction: parseBoolean(process.env.CAPTCHA_ENABLED_IN_PRODUCTION, true),
      provider: process.env.CAPTCHA_PROVIDER || 'CLOUDFLARE_TURNSTILE',
      siteKey: process.env.CAPTCHA_SITE_KEY || '',
      secretKey: process.env.CAPTCHA_SECRET_KEY || '',
      threshold: parseFloatNumber(process.env.CAPTCHA_THRESHOLD, 0.5),
      requireForRegistrationInProduction: parseBoolean(
        process.env.CAPTCHA_REQUIRE_FOR_REGISTRATION_IN_PRODUCTION,
        true
      ),
      requireForLoginInProduction: parseBoolean(
        process.env.CAPTCHA_REQUIRE_FOR_LOGIN_IN_PRODUCTION,
        true
      ),
    },
  },
  /** Auth-only rate limits (login, register, forgot-password). Do not affect the rest of the API. */
  authRateLimit: {
    disabled: process.env.AUTH_RATE_LIMIT_DISABLED === 'true',
    login: {
      max: parseInt(process.env.AUTH_RATE_LIMIT_LOGIN_MAX || '10', 10) || 10,
      windowMs: (parseInt(process.env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MINUTES || '15', 10) || 15) * 60 * 1000,
    },
    register: {
      max: parseInt(process.env.AUTH_RATE_LIMIT_REGISTER_MAX || '5', 10) || 5,
      windowMs: (parseInt(process.env.AUTH_RATE_LIMIT_REGISTER_WINDOW_MINUTES || '60', 10) || 60) * 60 * 1000,
    },
    forgotPassword: {
      max: parseInt(process.env.AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX || '3', 10) || 3,
      windowMs: (parseInt(process.env.AUTH_RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MINUTES || '60', 10) || 60) * 60 * 1000,
    },
    verifyEmail: {
      max: parseInt(process.env.AUTH_RATE_LIMIT_VERIFY_EMAIL_MAX || '20', 10) || 20,
      windowMs:
        (parseInt(process.env.AUTH_RATE_LIMIT_VERIFY_EMAIL_WINDOW_MINUTES || '60', 10) || 60) *
        60 *
        1000,
    },
  },
  /** Rate limits: only one place. By default 1 billion (actually disabled). */
  rateLimit: {
    /** Limit on requests per window (global API, API key, GPT). */
    defaultMax: (() => {
      const env = process.env.API_RATE_LIMIT_MAX;
      if (env !== undefined && env !== '') {
        const n = parseInt(env, 10);
        if (!Number.isNaN(n) && n > 0) return n;
      }
      return 1000;
    })(),
    apiDisabled: process.env.API_RATE_LIMIT_DISABLED === 'true' || process.env.API_RATE_LIMIT_MAX === '0',
    apiMax: (() => {
      const env = process.env.API_RATE_LIMIT_MAX;
      if (env !== undefined && env !== '') {
        const n = parseInt(env, 10);
        if (!Number.isNaN(n) && n > 0) return n;
      }
      return 1000;
    })(),
    apiWindowMinutes: parseInt(process.env.API_RATE_LIMIT_WINDOW_MINUTES || '15', 10) || 15,
    checkoutMax: parseInteger(process.env.CHECKOUT_RATE_LIMIT_MAX, 20),
    checkoutWindowMinutes: parseInteger(process.env.CHECKOUT_RATE_LIMIT_WINDOW_MINUTES, 15),
    searchMax: parseInteger(process.env.SEARCH_RATE_LIMIT_MAX, 120),
    searchWindowMinutes: parseInteger(process.env.SEARCH_RATE_LIMIT_WINDOW_MINUTES, 15),
    uploadMax: parseInteger(process.env.UPLOAD_RATE_LIMIT_MAX, 30),
    uploadWindowMinutes: parseInteger(process.env.UPLOAD_RATE_LIMIT_WINDOW_MINUTES, 15),
  },
};

function validateProductionSecurityConfig(): void {
  if (config.nodeEnv !== 'production') return;

  const errors: string[] = [];
  const insecureJwtDefaults = new Set([
    '',
    'default-secret-key-min-32-chars-for-testing',
    'default-refresh-secret-key-min-32-chars-for-testing',
    'your-super-secret-jwt-key-change-in-production',
    'your-super-secret-refresh-key-change-in-production',
  ]);

  if (insecureJwtDefaults.has(config.jwt.secret) || config.jwt.secret.length < 32) {
    errors.push('JWT_SECRET must be set to a strong value (at least 32 chars) in production');
  }
  if (insecureJwtDefaults.has(config.jwt.refreshSecret) || config.jwt.refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be set to a strong value (at least 32 chars) in production');
  }
  if (config.authCookies.sameSite === 'none' && !config.authCookies.secure) {
    errors.push('AUTH_COOKIE_SAMESITE=none requires AUTH_COOKIE_SECURE=true in production');
  }
  if (config.auth.maxActiveSessionsPerUser <= 0) {
    errors.push('MAX_ACTIVE_SESSIONS_PER_USER must be a positive integer in production');
  }
  if (!isValidEncryptionKey(process.env.ENCRYPTION_KEY)) {
    errors.push(
      'ENCRYPTION_KEY must be set to a valid key in production (base64 >= 32 bytes or hex >= 64 chars)'
    );
  }
  if (config.botProtection.failClosedInProduction && config.botProtection.captcha.enabledInProduction) {
    if (!hasNonEmptyValue(config.botProtection.captcha.siteKey)) {
      errors.push('CAPTCHA_SITE_KEY must be set in production when CAPTCHA is enforced');
    }
    if (!isSecureSecret(config.botProtection.captcha.secretKey)) {
      errors.push('CAPTCHA_SECRET_KEY must be set to a strong value in production when CAPTCHA is enforced');
    }
  }
  if (config.rateLimit.apiMax <= 0 || config.rateLimit.apiWindowMinutes <= 0) {
    errors.push('Global API rate limit must be configured with positive values in production');
  }
  if (config.rateLimit.checkoutMax <= 0 || config.rateLimit.checkoutWindowMinutes <= 0) {
    errors.push('Checkout rate limit must be configured with positive values in production');
  }
  if (config.rateLimit.searchMax <= 0 || config.rateLimit.searchWindowMinutes <= 0) {
    errors.push('Search rate limit must be configured with positive values in production');
  }
  if (config.rateLimit.uploadMax <= 0 || config.rateLimit.uploadWindowMinutes <= 0) {
    errors.push('Upload rate limit must be configured with positive values in production');
  }

  if (errors.length > 0) {
    throw new Error(`Security configuration invalid:\n- ${errors.join('\n- ')}`);
  }
}

validateProductionSecurityConfig();
