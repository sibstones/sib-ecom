import { Response } from 'express';

const EDGE_TTL_SECONDS = 300;
const BROWSER_TTL_SECONDS = 60;
const STALE_WHILE_REVALIDATE_SECONDS = 600;

export function setPublicStorefrontCache(res: Response): void {
  res.set(
    'Cache-Control',
    `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`
  );
  res.set('Vary', 'Accept-Encoding');
}

export function disableCache(res: Response): void {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
}
