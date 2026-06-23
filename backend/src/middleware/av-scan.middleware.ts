import { Request, Response, NextFunction } from 'express';
import { scanBuffer } from '../services/av-scan.service';

/**
 * Middleware to scan uploaded file(s) with ClamAV. Place after multer, before controller.
 * If AV is disabled or clamscan unavailable, passes through.
 * On infection returns 400 with { error: "File failed security scan." }.
 */
export async function scanUploadedFiles(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);

  if (files.length === 0) {
    return next();
  }

  for (const file of files) {
    const buffer = (file as Express.Multer.File & { buffer?: Buffer }).buffer ?? file;
    if (!Buffer.isBuffer(buffer)) {
      continue;
    }
    const result = await scanBuffer(buffer);
    if (!result.ok) {
      res.status(400).json({
        error: 'File failed security scan.',
        message: result.message,
      });
      return;
    }
  }

  next();
}
