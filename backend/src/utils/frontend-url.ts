import { config } from '../config/env';
import { settingsService } from '../services/settings.service';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function isLocalDevUrl(url: string | null | undefined): boolean {
  if (!url || !String(url).trim()) return true;
  try {
    const { hostname } = new URL(String(url).trim());
    return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
  } catch {
    return true;
  }
}

/**
 * Storefront base URL for emails, pins, and admin notifications.
 * Admin DB setting wins when set to a real domain; otherwise FRONTEND_BASE_URL / PUBLIC_SITE_URL from env.
 */
export async function resolveFrontendBaseUrl(): Promise<string> {
  const dbRaw = String((await settingsService.getSetting('frontendBaseUrl')) || '').trim();
  const envRaw = String(
    process.env.FRONTEND_BASE_URL || process.env.PUBLIC_SITE_URL || config.frontend.baseUrl || ''
  ).trim();

  if (dbRaw && !isLocalDevUrl(dbRaw)) {
    return stripTrailingSlash(dbRaw);
  }
  if (envRaw && !isLocalDevUrl(envRaw)) {
    return stripTrailingSlash(envRaw);
  }

  const fallback = dbRaw || envRaw || 'http://localhost:5173';
  return stripTrailingSlash(fallback);
}
