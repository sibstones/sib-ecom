import { Response } from 'express';
import { backupService } from '../services/backup.service';
import { AuthRequest } from '../middleware/auth.middleware';
import * as path from 'path';

export class BackupController {
  /**
   * Create a new backup
   */
  async createBackup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await backupService.createBackup(req.user.userId);

      res.status(201).json({
        message: 'Backup created successfully',
        backup: {
          fileName: result.fileName,
          size: result.size,
          sizeFormatted: `${(result.size / 1024 / 1024).toFixed(2)} MB`,
        },
      });
    } catch (error) {
      console.error('Error creating backup:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create backup',
      });
    }
  }

  /**
   * List all backups
   */
  async listBackups(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const backups = await backupService.listBackups();

      res.json({
        backups: backups.map(backup => ({
          fileName: backup.fileName,
          size: backup.size,
          sizeFormatted: `${(backup.size / 1024 / 1024).toFixed(2)} MB`,
          createdAt: backup.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list backups',
      });
    }
  }

  /**
   * Get backup info
   */
  async getBackupInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { fileName } = req.params;
      const info = await backupService.getBackupInfo(fileName);

      res.json({ info });
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : 'Backup not found',
      });
    }
  }

  /**
   * Download backup file
   */
  async downloadBackup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { fileName } = req.params;
      const backups = await backupService.listBackups();
      const backup = backups.find(b => b.fileName === fileName);

      if (!backup) {
        res.status(404).json({ error: 'Backup not found' });
        return;
      }

      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.sendFile(path.resolve(backup.filePath));
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to download backup',
      });
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { fileName } = req.params;
      await backupService.deleteBackup(fileName);

      res.json({ message: 'Backup deleted successfully' });
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : 'Failed to delete backup',
      });
    }
  }

  /**
   * Upload an external backup file (e.g. drag-and-drop). Saves to backup dir; use restore to apply.
   */
  async uploadBackup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'No backup file uploaded' });
        return;
      }
      const result = backupService.saveUploadedBackup(
        req.file.buffer,
        req.file.originalname || 'backup.json.gz'
      );
      res.status(201).json({
        message: 'Backup file uploaded. You can now restore it below.',
        backup: {
          fileName: result.fileName,
          size: result.size,
          sizeFormatted: `${(result.size / 1024 / 1024).toFixed(2)} MB`,
        },
      });
    } catch (error) {
      console.error('Error uploading backup:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to upload backup',
      });
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { fileName } = req.params;
      const { skipUsers, skipOrders } = req.body || {};

      const backups = await backupService.listBackups();
      const backup = backups.find(b => b.fileName === fileName);

      if (!backup) {
        res.status(404).json({ error: 'Backup not found' });
        return;
      }

      // Restore backup (this will take time, but we wait for it)
      await backupService.restoreBackup(backup.filePath, req.user.userId, {
        skipUsers: skipUsers === true,
        skipOrders: skipOrders === true,
      });

      res.json({
        message: 'Backup restored successfully',
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to restore backup',
      });
    }
  }
}

export const backupController = new BackupController();
