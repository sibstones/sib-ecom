import { Request, Response } from 'express';
import { config } from '../config/env';
import { storageService } from '../services/storage.service';
import { normalizePublicObjectKey } from '../utils/media-object-key';

function parseRangeHeader(
  rangeHeader: string | undefined,
  totalSize: number
): { start: number; end: number } | null {
  if (!rangeHeader || totalSize <= 0) return null;

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  let start = match[1] ? Number.parseInt(match[1], 10) : 0;
  let end = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1;

  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (start >= totalSize) return null;

  end = Math.min(end, totalSize - 1);
  if (start > end) return null;

  return { start, end };
}

export class MediaController {
  async streamPublicObject(req: Request, res: Response): Promise<void> {
    try {
      const rawPath = req.path.replace(/^\/+/, '');
      const objectKey = normalizePublicObjectKey(rawPath, config.minio.bucketName);

      if (!objectKey) {
        res.status(404).json({ error: 'Media not found' });
        return;
      }

      const payload = await storageService.getPublicObjectStream(objectKey);
      if (!payload) {
        res.status(404).json({ error: 'Media not found' });
        return;
      }

      const range = parseRangeHeader(
        typeof req.headers.range === 'string' ? req.headers.range : undefined,
        payload.contentLength
      );

      res.set('Accept-Ranges', 'bytes');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');

      if (payload.etag) {
        res.set('ETag', payload.etag);
        if (!range && req.headers['if-none-match'] === payload.etag) {
          payload.stream.destroy();
          res.status(304).end();
          return;
        }
      }

      let stream = payload.stream;
      let statusCode = 200;
      let contentLength = payload.contentLength;
      let contentType = payload.contentType;

      if (range) {
        const ranged = await storageService.getPublicObjectRange(objectKey, range.start, range.end);
        if (!ranged) {
          payload.stream.destroy();
          res.status(404).json({ error: 'Media not found' });
          return;
        }

        payload.stream.destroy();
        stream = ranged.stream;
        contentLength = ranged.contentLength;
        contentType = ranged.contentType;
        statusCode = 206;
        res.set(
          'Content-Range',
          `bytes ${range.start}-${range.end}/${payload.contentLength}`
        );
      }

      res.status(statusCode);
      res.set('Content-Type', contentType);
      res.set('Content-Length', String(contentLength));

      if (req.method === 'HEAD') {
        stream.destroy();
        res.end();
        return;
      }

      stream.on('error', (error: Error) => {
        console.warn('[Media] stream failed:', objectKey, error);
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error('[Media] streamPublicObject failed:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to load media' });
      }
    }
  }
}

export const mediaController = new MediaController();
