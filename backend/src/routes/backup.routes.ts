import { Router } from 'express';
import { backupController } from '../controllers/backup.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { uploadBackup, handleBackupUploadError } from '../middleware/upload.middleware';
import { uploadLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

// All routes require authentication and admin/super admin role
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Create backup
router.post('/', backupController.createBackup.bind(backupController));

// Upload external backup file (for restore from file / drag-and-drop)
router.post(
  '/upload',
  uploadLimiter,
  uploadBackup,
  handleBackupUploadError,
  backupController.uploadBackup.bind(backupController)
);

// List all backups
router.get('/', backupController.listBackups.bind(backupController));

// Get backup info
router.get('/:fileName/info', backupController.getBackupInfo.bind(backupController));

// Download backup
router.get('/:fileName/download', backupController.downloadBackup.bind(backupController));

// Restore from backup
router.post('/:fileName/restore', backupController.restoreBackup.bind(backupController));

// Delete backup
router.delete('/:fileName', backupController.deleteBackup.bind(backupController));

export default router;
