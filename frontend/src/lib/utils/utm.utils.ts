/**
 * UTM params for analytics (campaigns, source, medium, content, term).
 * All fields optional; only provided keys are appended to URL.
 */
export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

/**
 * Appends UTM query params to a URL. Preserves existing search params and hash.
 * Safe to use in browser and SSR (SvelteKit). Works with full URLs and path-only (e.g. /shop/product/x).
 */
export function appendUtmParams(url: string, params: UtmParams): string {
  const keys: (keyof UtmParams)[] = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ];
  const filtered = keys
    .filter((k) => params[k] != null && String(params[k]).trim() !== '')
    .reduce((acc, k) => ({ ...acc, [k]: String(params[k]).trim() }), {} as Record<string, string>);
  if (Object.keys(filtered).length === 0) return url;

  const query = new URLSearchParams(filtered).toString();
  if (!query) return url;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      for (const [key, value] of Object.entries(filtered)) {
        parsed.searchParams.set(key, value);
      }
      return parsed.toString();
    } catch {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}${query}`;
    }
  }

  const sep = url.includes('?') ? '&' : '?';
  const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
  const base = hash ? url.slice(0, url.indexOf('#')) : url;
  return `${base}${sep}${query}${hash}`;
}

/** Preset: partner affiliate link (utm_source=partner, utm_medium=affiliate, utm_campaign=partner_<id>) */
export function partnerProductUtm(partnerId: string, productSlug?: string): UtmParams {
  return {
    utm_source: 'partner',
    utm_medium: 'affiliate',
    utm_campaign: `partner_${partnerId}`,
    ...(productSlug ? { utm_content: productSlug } : {}),
  };
}

/** Preset: Pinterest (utm_source=pinterest, utm_medium=social) */
export function pinterestUtm(): UtmParams {
  return { utm_source: 'pinterest', utm_medium: 'social' };
}

/** Preset: newsletter / email (utm_source=newsletter, utm_medium=email) */
export function newsletterUtm(campaign?: string): UtmParams {
  return {
    utm_source: 'newsletter',
    utm_medium: 'email',
    ...(campaign ? { utm_campaign: campaign } : {}),
  };
}
