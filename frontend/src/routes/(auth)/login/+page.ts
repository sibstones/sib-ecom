import type { PageLoad } from './$types';
import type { FeatureSettings } from '$lib/api/settings.api';

type LoginPageConfig = {
  imageUrl?: string;
  badge?: string;
  eyebrow?: string;
  sideTitle?: string;
  description?: string;
};

type LoginPageContent = {
  config?: LoginPageConfig;
};

const FALLBACK_LOGIN_CONFIG: Required<LoginPageConfig> = {
  imageUrl: '/login-showcase.png',
  badge: 'Content Management',
  eyebrow: 'Admin access',
  sideTitle: 'Visual workspace for your shop operations.',
  description:
    'Left panel is ready for a branded image, campaign visual, or showroom-style artwork while the form stays focused on the right.',
};

async function loadLoginConfig(fetcher: typeof fetch, languageCode?: string): Promise<Required<LoginPageConfig>> {
  const params = languageCode ? `?languageCode=${encodeURIComponent(languageCode)}` : '';

  try {
    const response = await fetcher(`/api/pages/slug/login${params}`);
    if (!response.ok) {
      return FALLBACK_LOGIN_CONFIG;
    }

    const payload = (await response.json()) as {
      page?: {
        content?: string;
      };
    };

    const rawContent = payload.page?.content;
    if (!rawContent) {
      return FALLBACK_LOGIN_CONFIG;
    }

    const parsed = JSON.parse(rawContent) as LoginPageContent;
    const config = parsed.config ?? {};

    return {
      imageUrl: config.imageUrl || FALLBACK_LOGIN_CONFIG.imageUrl,
      badge: config.badge || FALLBACK_LOGIN_CONFIG.badge,
      eyebrow: config.eyebrow || FALLBACK_LOGIN_CONFIG.eyebrow,
      sideTitle: config.sideTitle || FALLBACK_LOGIN_CONFIG.sideTitle,
      description: config.description || FALLBACK_LOGIN_CONFIG.description,
    };
  } catch {
    return FALLBACK_LOGIN_CONFIG;
  }
}

async function loadThemeSettings(fetcher: typeof fetch): Promise<FeatureSettings | null> {
  try {
    const response = await fetcher('/api/settings');
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { settings?: FeatureSettings };
    return payload.settings ?? null;
  } catch {
    return null;
  }
}

export const load: PageLoad = async ({ fetch, url }) => {
  const languageCode = url.searchParams.get('lang')?.trim() || undefined;
  const [loginConfig, themeSettings] = await Promise.all([
    loadLoginConfig(fetch, languageCode),
    loadThemeSettings(fetch),
  ]);

  return {
    loginConfig,
    themeSettings,
  };
};
