import OpenAI from 'openai';
import { IntentType, ChatMessage } from '../types/gpt-assistant';

/** Only gpt-3.5* and gpt-4* support custom temperature. gpt-5-nano, gpt-5.2, o1, o3: omit. */
const SUPPORTS_CUSTOM_TEMPERATURE = /^gpt-(3\.5|4)/i;

export type GptAssistantSettingsLike = {
  providerType?: string | null;
  mode?: string | null;
  apiKey?: string | null;
  testApiKey?: string | null;
  apiBaseUrl?: string | null;
};

/** Ensure URL ends with `/v1` for OpenAI-compatible servers (LM Studio, etc.). */
export function normalizeOpenAiCompatibleBaseUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, '');
  if (/\/v1$/i.test(u)) return u;
  return `${u}/v1`;
}

/**
 * Build OpenAI SDK client options from assistant settings.
 * LM Studio: optional API key (placeholder ok), default base http://127.0.0.1:1234/v1
 */
export function resolveGptClientConfig(settings: GptAssistantSettingsLike): { apiKey: string; baseURL?: string } | null {
  const mode = settings.mode || 'production';
  const rawKey = mode === 'test' ? settings.testApiKey : settings.apiKey;
  const pt = String(settings.providerType || 'openai').toLowerCase();

  if (pt === 'lm_studio') {
    const key = (rawKey && String(rawKey).trim()) || 'lm-studio';
    const baseRaw = settings.apiBaseUrl?.trim();
    const base = baseRaw ? normalizeOpenAiCompatibleBaseUrl(baseRaw) : 'http://127.0.0.1:1234/v1';
    return { apiKey: key, baseURL: base };
  }

  const key = rawKey && String(rawKey).trim();
  if (!key) return null;

  const baseRaw = settings.apiBaseUrl?.trim();
  if (pt === 'custom' && baseRaw) {
    return { apiKey: key, baseURL: normalizeOpenAiCompatibleBaseUrl(baseRaw) };
  }
  if (pt === 'openai' && baseRaw) {
    return { apiKey: key, baseURL: normalizeOpenAiCompatibleBaseUrl(baseRaw) };
  }
  if (pt === 'anthropic' && baseRaw) {
    return { apiKey: key, baseURL: normalizeOpenAiCompatibleBaseUrl(baseRaw) };
  }
  return { apiKey: key };
}

function isOpenRouterBaseUrl(baseURL?: string): boolean {
  if (!baseURL) return false;
  try {
    return new URL(baseURL).hostname === 'openrouter.ai';
  } catch {
    return baseURL.includes('openrouter.ai');
  }
}

async function openRouterRequest<T>(
  baseURL: string,
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${baseURL.replace(/\/+$/, '')}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const errorMessage =
      (parsed as { error?: { message?: string }; message?: string } | null)?.error?.message ||
      (parsed as { message?: string } | null)?.message ||
      `${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return parsed as T;
}

export class GPTApiService {
  private openai: OpenAI | null = null;
  private lastApiKey: string | null = null;
  private lastBaseURL: string | undefined;

  /**
   * Create or refresh the OpenAI-compatible client when key or base URL changes.
   */
  ensureClient(config: { apiKey: string; baseURL?: string }): void {
    const base = config.baseURL ?? '';
    const same =
      this.openai !== null &&
      this.lastApiKey === config.apiKey &&
      (this.lastBaseURL || '') === base;
    if (same) return;

    this.lastApiKey = config.apiKey;
    this.lastBaseURL = base || undefined;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || undefined,
    });
  }

  /** @deprecated Prefer ensureClient with resolveGptClientConfig(settings). */
  initialize(apiKey: string): void {
    this.ensureClient({ apiKey });
  }

  isInitialized(): boolean {
    return this.openai !== null;
  }

  /**
   * List model ids from GET /v1/models (OpenAI-compatible).
   */
  async listModelIds(config: { apiKey: string; baseURL?: string }): Promise<string[]> {
    if (isOpenRouterBaseUrl(config.baseURL)) {
      const data = await openRouterRequest<{ data?: Array<{ id?: string }> }>(
        config.baseURL!,
        config.apiKey,
        '/models'
      );
      const ids = (data.data || []).map((m) => m.id).filter(Boolean) as string[];
      return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
    }

    this.ensureClient(config);
    if (!this.openai) {
      throw new Error('OpenAI client is not initialized');
    }
    const page = await this.openai.models.list();
    const ids = (page.data || []).map((m) => m.id).filter(Boolean) as string[];
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Generate chat completion using OpenAI-compatible API
   */
  async chatCompletion(
    messages: ChatMessage[],
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client is not initialized');
    }

    try {
      // Preserve system role — LM Studio / local chat templates expect real system messages for intent JSON etc.
      const formattedMessages = messages.map(msg => {
        const role =
          msg.role === 'system'
            ? ('system' as const)
            : msg.role === 'user'
              ? ('user' as const)
              : ('assistant' as const);
        return { role, content: msg.content };
      });

      const model = String(options?.model || 'gpt-4').trim();
      // OpenAI gpt-3.5/4 names support temp; LM Studio / local models need temp when callers pass it (e.g. intent 0.3)
      const sendTemperature =
        SUPPORTS_CUSTOM_TEMPERATURE.test(model) || typeof options?.temperature === 'number';
      const body: Record<string, unknown> = {
        model,
        messages: formattedMessages,
        max_completion_tokens: options?.maxTokens ?? 2000,
      };
      if (sendTemperature) {
        body.temperature = options?.temperature ?? 0.7;
      }

      if (isOpenRouterBaseUrl(this.lastBaseURL)) {
        const openRouterBody: Record<string, unknown> = {
          ...body,
          max_tokens: Math.max(Number(options?.maxTokens ?? 2000), 16),
        };
        delete openRouterBody.max_completion_tokens;

        const response = await openRouterRequest<{
          choices?: Array<{
            message?: { content?: string | null };
            finish_reason?: string | null;
          }>;
        }>(this.lastBaseURL!, this.lastApiKey!, '/chat/completions', {
          method: 'POST',
          body: JSON.stringify(openRouterBody),
        });

        const firstChoice = response.choices?.[0];
        const content = firstChoice?.message?.content;
        if (content == null || (typeof content === 'string' && content.trim() === '')) {
          const finishReason = firstChoice?.finish_reason ?? 'unknown';
          throw new Error(`No response content from OpenRouter (${finishReason})`);
        }

        return typeof content === 'string' ? content : String(content);
      }

      let response: Awaited<ReturnType<OpenAI['chat']['completions']['create']>>;
      try {
        response = await this.openai.chat.completions.create(body as any);
      } catch (firstErr: unknown) {
        const err = firstErr as { code?: string; error?: { param?: string; message?: string }; param?: string; message?: string };
        const isTempError =
          body.temperature !== undefined &&
          (err?.param === 'temperature' ||
            err?.error?.param === 'temperature' ||
            err?.code === 'unsupported_value' ||
            String(err?.message ?? err?.error?.message ?? '').includes('temperature'));
        if (isTempError) {
          delete body.temperature;
          try {
            response = await this.openai.chat.completions.create(body as any);
          } catch (secondErr: unknown) {
            // LM Studio / older servers often expect max_tokens instead of max_completion_tokens
            if ('max_completion_tokens' in body) {
              const alt = { ...body, max_tokens: body.max_completion_tokens } as Record<string, unknown>;
              delete alt.max_completion_tokens;
              response = await this.openai.chat.completions.create(alt as any);
            } else {
              throw secondErr;
            }
          }
        } else if (
          String(err?.message ?? err?.error?.message ?? '').includes('max_completion_tokens') ||
          String(err?.message ?? err?.error?.message ?? '').includes('max_tokens')
        ) {
          if ('max_completion_tokens' in body) {
            const alt = { ...body, max_tokens: body.max_completion_tokens } as Record<string, unknown>;
            delete alt.max_completion_tokens;
            response = await this.openai.chat.completions.create(alt as any);
          } else {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      const firstChoice = response.choices?.[0];
      const content = firstChoice?.message?.content;
      if (content == null || (typeof content === 'string' && content.trim() === '')) {
        const finishReason = firstChoice?.finish_reason ?? 'unknown';
        const ref = firstChoice?.message?.refusal ?? null;
        const detail = [finishReason, ref].filter(Boolean).join('; ');
        console.warn('OpenAI response had no content:', {
          choicesLength: response.choices?.length ?? 0,
          finishReason,
          refusal: ref,
          usage: response.usage,
        });
        throw new Error(
          detail
            ? `No response content from OpenAI (${detail})`
            : 'No response content from OpenAI. Check API key, model name, and account limits.'
        );
      }

      return typeof content === 'string' ? content : String(content);
    } catch (error: unknown) {
      console.error('OpenAI API error:', error);
      const msg =
        error instanceof Error
          ? error.message
          : typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : 'Failed to get response from OpenAI';
      throw new Error(msg);
    }
  }

  /**
   * Extract structured data from GPT response
   */
  async extractStructuredData<T>(
    response: string,
    _schema?: any
  ): Promise<T | null> {
    try {
      // Try to parse as JSON if response looks like JSON
      if (response.trim().startsWith('{') || response.trim().startsWith('[')) {
        return JSON.parse(response) as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate prompt for specific intent
   */
  generatePrompt(intent: IntentType, context: any): string {
    // Base prompts will be loaded from database
    // This is a fallback
    return `You are an AI assistant. Intent: ${intent}. Context: ${JSON.stringify(context)}`;
  }
}

export const gptApiService = new GPTApiService();
