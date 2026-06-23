import { Request, Response } from 'express';
import { sitemapService } from '../services/sitemap.service';

const XML_CACHE_SECONDS = 3600;

function sendXml(res: Response, xml: string): void {
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', `public, max-age=${XML_CACHE_SECONDS}`);
  res.send(xml);
}

function sendText(res: Response, body: string): void {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', `public, max-age=${XML_CACHE_SECONDS}`);
  res.send(body);
}

function parseChunkParam(raw: string | undefined): number | null {
  if (!raw) return 1;
  const chunk = Number.parseInt(raw, 10);
  if (!Number.isFinite(chunk) || chunk < 1) return null;
  return chunk;
}

export class SitemapController {
  async getIndex(_req: Request, res: Response): Promise<void> {
    try {
      const xml = await sitemapService.getSitemapIndexXml();
      sendXml(res, xml);
    } catch (error) {
      console.error('Error in sitemapController.getIndex:', error);
      res.status(500).send('Failed to generate sitemap index');
    }
  }

  async getStatic(_req: Request, res: Response): Promise<void> {
    try {
      const xml = await sitemapService.getStaticSitemapXml();
      sendXml(res, xml);
    } catch (error) {
      console.error('Error in sitemapController.getStatic:', error);
      res.status(500).send('Failed to generate static sitemap');
    }
  }

  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const chunk = parseChunkParam(req.params.chunk);
      if (chunk == null) {
        res.status(400).send('Invalid sitemap chunk');
        return;
      }

      const xml = await sitemapService.getProductsSitemapXml(chunk);
      if (!xml) {
        res.status(404).send('Sitemap chunk not found');
        return;
      }

      sendXml(res, xml);
    } catch (error) {
      console.error('Error in sitemapController.getProducts:', error);
      res.status(500).send('Failed to generate products sitemap');
    }
  }

  async getBlog(_req: Request, res: Response): Promise<void> {
    try {
      const xml = await sitemapService.getBlogSitemapXml();
      if (!xml) {
        res.status(404).send('Blog sitemap is empty');
        return;
      }
      sendXml(res, xml);
    } catch (error) {
      console.error('Error in sitemapController.getBlog:', error);
      res.status(500).send('Failed to generate blog sitemap');
    }
  }

  async getLookbook(_req: Request, res: Response): Promise<void> {
    try {
      const xml = await sitemapService.getLookbookSitemapXml();
      if (!xml) {
        res.status(404).send('Lookbook sitemap is empty');
        return;
      }
      sendXml(res, xml);
    } catch (error) {
      console.error('Error in sitemapController.getLookbook:', error);
      res.status(500).send('Failed to generate lookbook sitemap');
    }
  }

  async getRobots(_req: Request, res: Response): Promise<void> {
    try {
      const body = await sitemapService.getRobotsTxt();
      sendText(res, body);
    } catch (error) {
      console.error('Error in sitemapController.getRobots:', error);
      res.status(500).send('Failed to generate robots.txt');
    }
  }
}

export const sitemapController = new SitemapController();
