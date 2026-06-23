import * as Minio from 'minio';
import { config } from '../config/env';

async function listS3Backups() {
  try {
    console.log('☁️  Listing S3 backups...\n');

    const minioClient = new Minio.Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    const backupBucketName = process.env.S3_BACKUP_BUCKET || `${config.minio.bucketName}-backups`;
    const backupPrefix = process.env.S3_BACKUP_PREFIX || 'backups';

    console.log(`   Backup bucket: ${backupBucketName}`);
    console.log(`   Backup prefix: ${backupPrefix}\n`);

    // Check if backup bucket exists
    const backupExists = await minioClient.bucketExists(backupBucketName);
    if (!backupExists) {
      console.log(`   ⚠️  Backup bucket "${backupBucketName}" does not exist.`);
      console.log(`   Run "npm run backup:s3" to create your first backup.`);
      return;
    }

    // List backup objects
    const backups: Array<{
      name: string;
      size: number;
      lastModified: Date;
    }> = [];

    const stream = minioClient.listObjects(backupBucketName, backupPrefix, true);

    for await (const obj of stream) {
      if (obj.name && obj.name.endsWith('.tar.gz')) {
        backups.push({
          name: obj.name,
          size: obj.size || 0,
          lastModified: obj.lastModified || new Date(),
        });
      }
    }

    if (backups.length === 0) {
      console.log(`   ⚠️  No backup files found in "${backupPrefix}/" prefix.`);
      console.log(`   Run "npm run backup:s3" to create your first backup.`);
      return;
    }

    // Sort by date (newest first)
    backups.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    console.log(`📁 Found ${backups.length} backup file(s):\n`);

    backups.forEach((backup, index) => {
      const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
      const isLatest = index === 0;
      const marker = isLatest ? '⭐ (latest)' : '';
      
      console.log(`${index + 1}. ${backup.name} ${marker}`);
      console.log(`   Size: ${sizeMB} MB`);
      console.log(`   Date: ${backup.lastModified.toLocaleString()}`);
      console.log(`   S3: s3://${backupBucketName}/${backup.name}`);
      console.log('');
    });

    if (backups.length > 0) {
      console.log('💡 To restore a backup:');
      console.log(`   npm run restore:s3 -- ${backups[0].name}`);
      console.log(`   npm run restore:s3 -- ${backups[0].name} --bucket=my-bucket`);
    }
  } catch (error) {
    console.error('❌ Error listing S3 backups:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('minio')) {
      console.error('\n💡 Make sure MinIO is running and accessible:');
      console.error('   docker-compose up -d minio');
      console.error('   Check MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY in .env');
    }
    
    process.exit(1);
  }
}

listS3Backups();
