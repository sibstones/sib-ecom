import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX = 'enc:';

/**
 * Get encryption key from env. Must be 32 bytes (base64 or hex).
 * If not set or invalid, returns null (encryption disabled).
 */
function getEncryptionKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 32) return null;
  try {
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length >= 64) {
      return Buffer.from(trimmed.slice(0, 64), 'hex');
    }
    return Buffer.from(trimmed, 'base64').slice(0, KEY_LENGTH);
  } catch {
    return null;
  }
}

/**
 * Encrypt a string. Returns prefixed base64 (iv + authTag + ciphertext).
 * If ENCRYPTION_KEY is not set, returns plaintext as-is (dev mode).
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  if (!key || key.length < KEY_LENGTH) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key.slice(0, KEY_LENGTH), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return PREFIX + combined.toString('base64');
}

/**
 * Decrypt a string. Input must be prefixed with "enc:".
 * If not prefixed or decrypt fails, returns original string (backward compat for plaintext).
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;

  const key = getEncryptionKey();
  if (!key || key.length < KEY_LENGTH) return ciphertext;

  try {
    const raw = Buffer.from(ciphertext.slice(PREFIX.length), 'base64');
    if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) return ciphertext;
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key.slice(0, KEY_LENGTH), iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return ciphertext;
  }
}

/**
 * Whether encryption is enabled (ENCRYPTION_KEY set and valid).
 */
export function isEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null;
}

/**
 * Decrypt apiKey and testApiKey on a GPTAssistantSettings record (from DB).
 */
export function decryptGptAssistantSecrets<T extends { apiKey?: string | null; testApiKey?: string | null }>(
  record: T | null
): T | null {
  if (!record) return record;
  return {
    ...record,
    apiKey: record.apiKey ? decrypt(record.apiKey) : record.apiKey,
    testApiKey: record.testApiKey ? decrypt(record.testApiKey) : record.testApiKey,
  } as T;
}

/**
 * Encrypt apiKey and testApiKey for writing to DB. Skips placeholder '***hidden***'.
 */
export function encryptGptAssistantSecrets(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (typeof data.apiKey === 'string' && data.apiKey && data.apiKey !== '***hidden***') {
    out.apiKey = encrypt(data.apiKey);
  }
  if (typeof data.testApiKey === 'string' && data.testApiKey && data.testApiKey !== '***hidden***') {
    out.testApiKey = encrypt(data.testApiKey);
  }
  return out;
}

const PAYMENT_CONFIG_ENC_KEY = '_enc';

/**
 * Encrypt payment gateway config for DB. Stores as { _enc: "base64..." }.
 */
export function encryptPaymentConfig(config: object): Record<string, unknown> {
  const key = getEncryptionKey();
  if (!key || key.length < KEY_LENGTH) return config as Record<string, unknown>;
  try {
    const json = JSON.stringify(config);
    return { [PAYMENT_CONFIG_ENC_KEY]: encrypt(json) } as Record<string, unknown>;
  } catch {
    return config as Record<string, unknown>;
  }
}

/**
 * Decrypt payment gateway config from DB. If not encrypted, returns config as-is.
 */
export function decryptPaymentConfig(config: unknown): Record<string, unknown> {
  if (config == null) return {};
  const obj = config as Record<string, unknown>;
  if (typeof obj[PAYMENT_CONFIG_ENC_KEY] !== 'string') return obj;
  try {
    const decrypted = decrypt(obj[PAYMENT_CONFIG_ENC_KEY] as string);
    return JSON.parse(decrypted) as Record<string, unknown>;
  } catch {
    return obj;
  }
}
