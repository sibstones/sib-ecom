import * as Minio from 'minio';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
// Using tar command instead of archiver for better compatibility

function getBackupDir(): string {
  return process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
}

function ensureBackupDirectory() {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

async function backupMinIOToS3() {
  try {
    console.log('☁️  Starting MinIO/S3 backup...\n');

    const minioClient = new Minio.Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    const bucketName = config.minio.bucketName;
    const backupBucketName = process.env.S3_BACKUP_BUCKET || `${bucketName}-backups`;
    const backupPrefix = process.env.S3_BACKUP_PREFIX || 'backups';

    console.log(`   Source bucket: ${bucketName}`);
    console.log(`   Backup bucket: ${backupBucketName}`);
    console.log(`   Backup prefix: ${backupPrefix}\n`);

    // Check if source bucket exists
    const sourceExists = await minioClient.bucketExists(bucketName);
    if (!sourceExists) {
      throw new Error(`Source bucket "${bucketName}" does not exist`);
    }

    // Ensure backup bucket exists
    const backupExists = await minioClient.bucketExists(backupBucketName);
    if (!backupExists) {
      console.log(`   Creating backup bucket: ${backupBucketName}...`);
      await minioClient.makeBucket(backupBucketName, config.minio.region);
      console.log(`   ✅ Backup bucket created\n`);
    }

    // List all objects in source bucket
    console.log('   Listing objects in source bucket...');
    const objectsList: string[] = [];
    const stream = minioClient.listObjects(bucketName, '', true);

    for await (const obj of stream) {
      if (obj.name) {
        objectsList.push(obj.name);
      }
    }

    console.log(`   Found ${objectsList.length} objects to backup\n`);

    if (objectsList.length === 0) {
      console.log('   ⚠️  No objects to backup');
      return;
    }

    // Create local temporary directory for backup
    const backupDir = ensureBackupDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const tempDir = path.join(backupDir, `s3_backup_${timestamp}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Download all objects
    console.log('   Downloading objects...');
    let downloadedCount = 0;
    for (const objectName of objectsList) {
      try {
        const objectPath = path.join(tempDir, objectName);
        const objectDir = path.dirname(objectPath);
        
        // Create directory structure
        if (!fs.existsSync(objectDir)) {
          fs.mkdirSync(objectDir, { recursive: true });
        }

        // Download object
        await minioClient.fGetObject(bucketName, objectName, objectPath);
        downloadedCount++;
        
        if (downloadedCount % 100 === 0) {
          process.stdout.write(`   Downloaded ${downloadedCount}/${objectsList.length} objects...\r`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to download ${objectName}:`, error instanceof Error ? error.message : error);
      }
    }
    console.log(`\n   ✅ Downloaded ${downloadedCount} objects\n`);

    // Create archive using tar command (more reliable)
    console.log('   Creating archive...');
    const archiveFileName = `s3_backup_${bucketName}_${timestamp}.tar.gz`;
    const archivePath = path.join(backupDir, archiveFileName);
    
    // Use tar command for better compatibility
    execSync(`tar -czf "${archivePath}" -C "${tempDir}" .`, { stdio: 'inherit' });

    const archiveSize = fs.statSync(archivePath).size;
    console.log(`   ✅ Archive created: ${archiveFileName} (${(archiveSize / 1024 / 1024).toFixed(2)} MB)\n`);

    // Upload archive to S3 backup bucket
    console.log('   Uploading archive to S3...');
    const s3ObjectName = `${backupPrefix}/${archiveFileName}`;
    await minioClient.fPutObject(backupBucketName, s3ObjectName, archivePath, {
      'Content-Type': 'application/gzip',
      'X-Backup-Date': new Date().toISOString(),
      'X-Source-Bucket': bucketName,
      'X-Object-Count': objectsList.length.toString(),
    });

    console.log(`   ✅ Archive uploaded to S3: ${s3ObjectName}\n`);

    // Clean up temporary directory
    console.log('   Cleaning up temporary files...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('   ✅ Cleanup completed\n');

    console.log('✅ MinIO/S3 backup completed successfully!\n');
    console.log('📁 Backup files:');
    console.log(`   Local archive: ${archivePath} (${(archiveSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   S3 location: s3://${backupBucketName}/${s3ObjectName}`);
    console.log(`\n💡 To restore, use: npm run restore:s3 -- ${s3ObjectName}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error backing up MinIO/S3:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('minio')) {
      console.error('\n💡 Make sure MinIO is running and accessible:');
      console.error('   docker-compose up -d minio');
      console.error('   Check MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY in .env');
    }
    
    process.exit(1);
  }
}

backupMinIOToS3();
