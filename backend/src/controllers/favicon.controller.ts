import { Request, Response } from 'express';
import { faviconService, type SiteIconPayload } from '../services/favicon.service';

function sendIcon(req: Request, res: Response, payload: SiteIconPayload): void {
  if (req.headers['if-none-match'] === payload.etag) {
    res.status(304).end();
    return;
  }

  res.set('Content-Type', payload.contentType);
  res.set('ETag', payload.etag);
  res.set('Cache-Control', `public, max-age=${payload.cacheMaxAge}`);
  res.send(payload.buffer);
}

export class FaviconController {
  async getFavicon(req: Request, res: Response): Promise<void> {
    try {
      const payload = await faviconService.getFavicon();
      sendIcon(req, res, payload);
    } catch (error) {
      console.error('[Favicon] getFavicon failed:', error);
      res.status(500).end();
    }
  }

  async getFaviconSvg(req: Request, res: Response): Promise<void> {
    try {
      const result = await faviconService.getFaviconSvg();
      if (result === 'redirect-favicon' || result === 'use-default') {
        res.redirect(302, '/favicon.ico');
        return;
      }
      sendIcon(req, res, result);
    } catch (error) {
      console.error('[Favicon] getFaviconSvg failed:', error);
      res.status(500).end();
    }
  }

  async getAppleTouchIcon(req: Request, res: Response): Promise<void> {
    try {
      const payload = await faviconService.getAppleTouchIcon();
      sendIcon(req, res, payload);
    } catch (error) {
      console.error('[Favicon] getAppleTouchIcon failed:', error);
      res.status(500).end();
    }
  }
}

export const faviconController = new FaviconController();
