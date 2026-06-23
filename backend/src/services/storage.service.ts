import * as Minio from 'minio';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { normalizeUploadedFileName } from '../utils/file-upload';

class StorageService {
  private minioClient: Minio.Client;
  private bucketName: string;
  private privateBucketName: string;
  private ensureBucketPromise: Promise<void> | null = null;
  private readonly ensureBucketRetryDelayMs = 3000;
  private readonly ensureBucketMaxAttempts = 20;
  private static readonly PRIVATE_REF_PREFIX = 'private:';

  constructor() {
    this.minioClient = new Minio.Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });
    this.bucketName = config.minio.bucketName;
    this.privateBucketName = config.minio.privateBucketName;
    void this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    if (this.ensureBucketPromise) {
      return this.ensureBucketPromise;
    }

    this.ensureBucketPromise = this.ensureBucketExistsWithRetry();

    try {
      await this.ensureBucketPromise;
    } finally {
      this.ensureBucketPromise = null;
    }
  }

  private async ensureBucketExistsWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= this.ensureBucketMaxAttempts; attempt += 1) {
      const isLastAttempt = attempt === this.ensureBucketMaxAttempts;

      try {
        const exists = await this.minioClient.bucketExists(this.bucketName);
        if (!exists) {
          await this.minioClient.makeBucket(this.bucketName, config.minio.region);
          // Set bucket policy to allow public read access
          const policy = {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucketName}/*`],
              },
            ],
          };
          await this.minioClient.setBucketPolicy(
            this.bucketName,
            JSON.stringify(policy)
          );
          console.log(`✅ Created bucket: ${this.bucketName}`);
        }

        const privateExists = await this.minioClient.bucketExists(this.privateBucketName);
        if (!privateExists) {
          await this.minioClient.makeBucket(this.privateBucketName, config.minio.region);
          console.log(`✅ Created private bucket: ${this.privateBucketName}`);
        }

        return;
      } catch (error) {
        if (isLastAttempt) {
          console.error('❌ Error ensuring bucket exists:', error);
          return;
        }

        console.warn(
          `MinIO bucket '${this.bucketName}' is not ready yet (${attempt}/${this.ensureBucketMaxAttempts}). Retrying in ${
            this.ensureBucketRetryDelayMs / 1000
          }s...`
        );
        await new Promise((resolve) => setTimeout(resolve, this.ensureBucketRetryDelayMs));
      }
    }
  }

  private async ensureBucketReady(): Promise<void> {
    try {
      await this.ensureBucketExists();
    } catch (error) {
      console.error('❌ Error waiting for bucket readiness:', error);
    }
  }

  /**
   * Upload a file to MinIO
   * @param file - Multer file object
   * @param folder - Folder path in bucket (e.g., 'products', 'lookbook')
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads'
  ): Promise<string> {
    try {
      await this.ensureBucketReady();

      const normalizedOriginalName = normalizeUploadedFileName(file.originalname);
      const fileExtension = path.extname(normalizedOriginalName);
      const fileName = `${folder}/${uuidv4()}${fileExtension}`;
      const metaData = {
        'Content-Type': file.mimetype,
        'Original-Name': normalizedOriginalName,
        'Cache-Control': 'public, max-age=31536000, immutable',
      };

      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file.buffer,
        file.size,
        metaData
      );

      // Return public URL
      const publicUrl = this.getPublicUrl(fileName);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading file to MinIO:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  /**
   * Upload multiple files to MinIO
   * @param files - Array of Multer file objects
   * @param folder - Folder path in bucket
   * @returns Array of public URLs
   */
  async uploadFiles(
    files: Express.Multer.File[],
    folder: string = 'uploads'
  ): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async uploadPrivateFile(
    file: Express.Multer.File,
    folder: string = 'private'
  ): Promise<string> {
    try {
      await this.ensureBucketReady();

      const normalizedOriginalName = normalizeUploadedFileName(file.originalname);
      const fileExtension = path.extname(normalizedOriginalName);
      const objectName = `${folder}/${uuidv4()}${fileExtension}`;
      const metaData = {
        'Content-Type': file.mimetype,
        'Original-Name': normalizedOriginalName,
        'Cache-Control': 'private, no-store',
      };

      await this.minioClient.putObject(
        this.privateBucketName,
        objectName,
        file.buffer,
        file.size,
        metaData
      );

      return `${StorageService.PRIVATE_REF_PREFIX}${objectName}`;
    } catch (error) {
      console.error('Error uploading private file to MinIO:', error);
      throw new Error('Failed to upload private file to storage');
    }
  }

  /**
   * Delete a file from MinIO
   * @param fileUrl - Public URL or object name
   * @returns true if deleted successfully
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      await this.ensureBucketReady();

      const location = this.resolveFileLocation(fileUrl);
      if (!location) {
        throw new Error('Invalid file URL');
      }

      await this.minioClient.removeObject(location.bucketName, location.objectName);
      return true;
    } catch (error) {
      console.error('Error deleting file from MinIO:', error);
      return false;
    }
  }

  /**
   * Delete multiple files from MinIO
   * @param fileUrls - Array of public URLs or object names
   * @returns Array of deletion results
   */
  async deleteFiles(fileUrls: string[]): Promise<boolean[]> {
    const deletePromises = fileUrls.map((url) => this.deleteFile(url));
    return Promise.all(deletePromises);
  }

  /**
   * Get public URL for an object
   * @param objectName - Object name in bucket
   * @returns Public URL
   */
  private getPublicUrl(objectName: string): string {
    const normalizedBase = config.minio.publicUrl.replace(/\/+$/, '');

    try {
      const url = new URL(normalizedBase);
      const currentPath = url.pathname.replace(/\/+$/, '');
      const bucketPath = `/${this.bucketName}`;
      const basePath = currentPath.endsWith(bucketPath)
        ? currentPath
        : `${currentPath}${bucketPath}`;

      url.pathname = `${basePath}/${objectName}`;
      return url.toString();
    } catch {
      const basePath = normalizedBase.endsWith(`/${this.bucketName}`)
        ? normalizedBase
        : `${normalizedBase}/${this.bucketName}`;
      return `${basePath}/${objectName}`;
    }
  }

  private resolveFileLocation(fileUrl: string): { bucketName: string; objectName: string } | null {
    if (!fileUrl || typeof fileUrl !== 'string') return null;

    if (fileUrl.startsWith(StorageService.PRIVATE_REF_PREFIX)) {
      const objectName = fileUrl.slice(StorageService.PRIVATE_REF_PREFIX.length).trim();
      if (!objectName) return null;
      return {
        bucketName: this.privateBucketName,
        objectName,
      };
    }

    const objectName = this.extractObjectName(fileUrl);
    if (!objectName) return null;
    return {
      bucketName: this.bucketName,
      objectName,
    };
  }

  /**
   * Extract object name from public URL
   * @param url - Public URL
   * @returns Object name or null
   */
  private extractObjectName(url: string): string | null {
    try {
      // Handle different URL formats
      // Format: http://localhost:9000/bucket-name/folder/file.jpg
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      // Remove bucket name from path (some public URLs already include the bucket path).
      while (pathParts[0] === this.bucketName) {
        pathParts.shift();
      }
      
      return pathParts.join('/') || null;
    } catch (error) {
      // If URL parsing fails, assume it's already an object name
      return url;
    }
  }

  /**
   * Read file bytes from MinIO by public URL or object name.
   */
  async getFileBuffer(
    fileUrl: string
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      await this.ensureBucketReady();

      const location = this.resolveFileLocation(fileUrl);
      if (!location) {
        return null;
      }

      const stat = await this.minioClient.statObject(location.bucketName, location.objectName);
      const stream = await this.minioClient.getObject(location.bucketName, location.objectName);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      const meta = stat.metaData ?? {};
      const contentType =
        meta['content-type'] ??
        meta['Content-Type'] ??
        'application/octet-stream';

      return {
        buffer: Buffer.concat(chunks),
        contentType,
      };
    } catch (error) {
      console.warn('[Storage] getFileBuffer failed:', error);
      return null;
    }
  }

  /**
   * Check if file exists
   * @param fileUrl - Public URL or object name
   * @returns true if file exists
   */
  async fileExists(fileUrl: string): Promise<boolean> {
    try {
      await this.ensureBucketReady();

      const location = this.resolveFileLocation(fileUrl);
      if (!location) {
        return false;
      }

      await this.minioClient.statObject(location.bucketName, location.objectName);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const storageService = new StorageService();
