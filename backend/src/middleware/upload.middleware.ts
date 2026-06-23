import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { normalizeUploadedFiles } from '../utils/file-upload';

// Configure multer to use memory storage (for MinIO upload)
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allow only image files
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only ${allowedMimes.join(', ')} are allowed.`
      )
    );
  }
};

// Single file upload middleware
// Supports both 'image' and 'file' field names for compatibility
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize, // 10MB default
  },
}).single('file');

// Multiple files upload middleware
// Supports 'files' field name (frontend sends 'files')
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 10, // Max 10 files at once
  },
}).array('files', 10);

// Field-based upload middleware (for multiple named fields)
export const uploadFields = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 10 },
]);

// File filter for images and videos (for homepage uploads)
const imageVideoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allow image, video, and audio files
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'video/mp4',
    'video/webm',
    'video/quicktime', // mov
    'video/x-msvideo', // avi
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/x-m4a',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only images, videos and audio are allowed.`
      )
    );
  }
};

// Single file upload middleware for homepage (supports images and videos)
export const uploadSingleImageOrVideo = multer({
  storage,
  fileFilter: imageVideoFileFilter,
  limits: {
    fileSize: config.upload.maxFileSize, // 10MB default
  },
}).single('file');

// Multiple files upload (images + videos) — for product media etc.
export const uploadMultipleImageOrVideo = multer({
  storage,
  fileFilter: imageVideoFileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 10,
  },
}).array('files', 10);

const zipFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ok =
    file.mimetype === 'application/zip' ||
    file.mimetype === 'application/x-zip-compressed' ||
    file.originalname.toLowerCase().endsWith('.zip');

  if (ok) cb(null, true);
  else cb(new Error('Invalid file type. Only .zip archives are allowed.'));
};

export const uploadZip = multer({
  storage,
  fileFilter: zipFileFilter,
  limits: {
    fileSize: Math.max(config.upload.maxFileSize, 50 * 1024 * 1024),
  },
}).single('file');

const documentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const lowerName = file.originalname.toLowerCase();
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.txt', '.md', '.doc', '.docx'];
  const hasAllowedExtension = allowedExtensions.some((ext) => lowerName.endsWith(ext));

  if (allowedMimes.includes(file.mimetype) || hasAllowedExtension) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only PDF, image, text, Markdown, DOC, and DOCX files are allowed.'
      )
    );
  }
};

export const uploadSingleDocument = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: Math.max(config.upload.maxFileSize, 25 * 1024 * 1024),
  },
}).single('file');

// Backup file: .json.gz only, up to 500MB
const BACKUP_MAX_SIZE = 500 * 1024 * 1024;
const backupFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ok =
    file.mimetype === 'application/gzip' ||
    file.mimetype === 'application/x-gzip' ||
    file.originalname.toLowerCase().endsWith('.json.gz');
  if (ok) cb(null, true);
  else cb(new Error('Invalid file type. Only .json.gz backup files are allowed.'));
};

export const uploadBackup = multer({
  storage,
  fileFilter: backupFileFilter,
  limits: { fileSize: BACKUP_MAX_SIZE },
}).single('file');

/** Use after uploadBackup to return backup-specific error messages (e.g. 500MB limit). */
export const handleBackupUploadError = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      error: `Backup file too large. Maximum size is ${BACKUP_MAX_SIZE / 1024 / 1024}MB`,
    });
    return;
  }
  handleUploadError(err, _req, res, next);
};

// Wrapper to handle multer errors
export const handleUploadError = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: `File too large. Maximum size is ${config.upload.maxFileSize / 1024 / 1024}MB`,
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Too many files. Maximum is 10 files.',
      });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        error: 'Unexpected file field.',
      });
      return;
    }
    res.status(400).json({
      error: err.message,
    });
    return;
  }

  if (err) {
    res.status(400).json({
      error: err.message,
    });
    return;
  }

  normalizeUploadedFiles(req.file);
  if (Array.isArray(req.files)) {
    normalizeUploadedFiles(req.files);
  }

  next();
};
