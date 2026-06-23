/** Allowed persisted providerType values (OpenAI-compatible client). */
export const ALLOWED_GPT_PROVIDER_TYPES = ['openai', 'anthropic', 'custom', 'lm_studio'] as const;

/** STT in chat: none | browser (Web Speech) | openai | custom (reserved for server STT). */
export const ALLOWED_STT_PROVIDER_TYPES = ['none', 'browser', 'openai', 'custom'] as const;

export function isAllowedSttProviderType(value: unknown): boolean {
  const s = String(value ?? '').toLowerCase();
  return (ALLOWED_STT_PROVIDER_TYPES as readonly string[]).includes(s);
}
export type AllowedGptProviderType = (typeof ALLOWED_GPT_PROVIDER_TYPES)[number];

export function isAllowedGptProviderType(value: unknown): value is AllowedGptProviderType {
  const s = String(value ?? '').toLowerCase();
  return (ALLOWED_GPT_PROVIDER_TYPES as readonly string[]).includes(s);
}

/**
 * Empty → null. Non-empty must be parseable http(s) URL.
 */
export function normalizeApiBaseUrlInput(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const s = String(raw).trim();
  if (s === '') {
    return { ok: true, value: null };
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, error: 'API base URL must use http:// or https://' };
    }
    return { ok: true, value: s };
  } catch {
    return { ok: false, error: 'Invalid API base URL' };
  }
}

/**
 * After merge of patch + existing row, enforce rules before DB write.
 */
export function validateGptProviderEndpointRules(
  providerType: string,
  apiBaseUrl: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  const pt = String(providerType || 'openai').toLowerCase();
  const base = apiBaseUrl?.trim() || null;

  if (pt === 'custom' && !base) {
    return {
      ok: false,
      error:
        'Custom provider requires an API base URL (OpenAI-compatible endpoint, usually ending with /v1).',
    };
  }

  return { ok: true };
}
