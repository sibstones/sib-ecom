import { apiClient } from './client';
import { normalizeUploadFile } from '$lib/utils/file-upload';

export interface Backup {
  fileName: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
}

export interface BackupInfo {
  version: string;
  createdAt: string;
  createdBy?: string;
  metadata: {
    totalRecords: number;
    tables: string[];
  };
}

export interface CreateBackupResponse {
  message: string;
  backup: {
    fileName: string;
    size: number;
    sizeFormatted: string;
  };
}

export interface UploadBackupResponse {
  message: string;
  backup: {
    fileName: string;
    size: number;
    sizeFormatted: string;
  };
}

export interface ListBackupsResponse {
  backups: Backup[];
}

export interface BackupInfoResponse {
  info: BackupInfo;
}

export interface RestoreBackupRequest {
  skipUsers?: boolean;
  skipOrders?: boolean;
}

export const backupApi = {
  // Create a new backup
  createBackup: () => apiClient.post<CreateBackupResponse>('/backups'),

  // Upload external backup file (.json.gz) for restore
  uploadBackup: (file: File) => {
    const formData = new FormData();
    formData.append('file', normalizeUploadFile(file));
    return apiClient.post<UploadBackupResponse>('/backups/upload', formData);
  },

  // List all backups
  listBackups: () => apiClient.get<ListBackupsResponse>('/backups'),

  // Get backup info
  getBackupInfo: (fileName: string) =>
    apiClient.get<BackupInfoResponse>(`/backups/${encodeURIComponent(fileName)}/info`),

  // Download backup file
  downloadBackup: async (fileName: string): Promise<Blob> => {
    const url = `/backups/${encodeURIComponent(fileName)}/download`;
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${url}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.blob();
  },

  // Restore from backup
  restoreBackup: (fileName: string, options?: RestoreBackupRequest) =>
    apiClient.post<{ message: string }>(
      `/backups/${encodeURIComponent(fileName)}/restore`,
      options
    ),

  // Delete backup
  deleteBackup: (fileName: string) =>
    apiClient.delete<{ message: string }>(`/backups/${encodeURIComponent(fileName)}`),
};
