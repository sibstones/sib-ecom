import * as Minio from 'minio';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';

async function restoreMinIOFromS3(s3ObjectName: string, targetBucket?: string) {
  try {
    console.log('☁️  Starting MinIO/S3 restoration...\n');

    const minioClient = new Minio.Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    const sourceBucketName = process.env.S3_BACKUP_BUCKET || `${config.minio.bucketName}-backups`;
    const restoreBucketName = targetBucket || config.minio.bucketName;

    console.log(`   Source backup: s3://${sourceBucketName}/${s3ObjectName}`);
    console.log(`   Target bucket: ${restoreBucketName}\n`);

    // Check if backup exists
    try {
      await minioClient.statObject(sourceBucketName, s3ObjectName);
    } catch (error) {
      throw new Error(`Backup file "${s3ObjectName}" not found in bucket "${sourceBucketName}"`);
    }

    // Ensure target bucket exists
    const targetExists = await minioClient.bucketExists(restoreBucketName);
    if (!targetExists) {
      console.log(`   Creating target bucket: ${restoreBucketName}...`);
      await minioClient.makeBucket(restoreBucketName, config.minio.region);
      console.log(`   ✅ Target bucket created\n`);
    }

    // Download backup archive
    console.log('   Downloading backup archive...');
    const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const archiveFileName = path.basename(s3ObjectName);
    const archivePath = path.join(backupDir, `restore_${archiveFileName}`);
    
    await minioClient.fGetObject(sourceBucketName, s3ObjectName, archivePath);
    console.log(`   ✅ Archive downloaded: ${archivePath}\n`);

    // Extract archive
    console.log('   Extracting archive...');
    const extractDir = path.join(backupDir, `extract_${Date.now()}`);
    fs.mkdirSync(extractDir, { recursive: true });

    await tar.extract({
      file: archivePath,
      cwd: extractDir,
    });
    console.log('   ✅ Archive extracted\n');

    // Upload files to MinIO
    console.log('   Uploading files to MinIO...');
    const uploadFiles = (dir: string, prefix: string = '') => {
      const files = fs.readdirSync(dir);
      let uploadedCount = 0;

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          uploadFiles(filePath, `${prefix}${file}/`);
        } else {
          const objectName = `${prefix}${file}`;
          minioClient.fPutObject(
            restoreBucketName,
            objectName,
            filePath,
            {
              'Content-Type': 'application/octet-stream',
            }
          ).then(() => {
            uploadedCount++;
            if (uploadedCount % 100 === 0) {
              process.stdout.write(`   Uploaded ${uploadedCount} files...\r`);
            }
          }).catch((error) => {
            console.warn(`   ⚠️  Failed to upload ${objectName}:`, error.message);
          });
        }
      }
    };

    // Find the extracted bucket directory
    const extractedDirs = fs.readdirSync(extractDir);
    const bucketDir = extractedDirs.find(dir => {
      const dirPath = path.join(extractDir, dir);
      return fs.statSync(dirPath).isDirectory();
    });

    if (bucketDir) {
      const sourceDir = path.join(extractDir, bucketDir);
      uploadFiles(sourceDir);
    } else {
      uploadFiles(extractDir);
    }

    // Wait a bit for uploads to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('\n   ✅ Files uploaded\n');

    // Clean up
    console.log('   Cleaning up temporary files...');
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(archivePath);
    console.log('   ✅ Cleanup completed\n');

    console.log('✅ MinIO/S3 restoration completed successfully!');
    console.log(`\n📦 Restored to bucket: ${restoreBucketName}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error restoring MinIO/S3:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('minio')) {
      console.error('\n💡 Make sure MinIO is running and accessible:');
      console.error('   docker-compose up -d minio');
      console.error('   Check MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY in .env');
    }
    
    process.exit(1);
  }
}

// Get S3 object name from command line arguments
const args = process.argv.slice(2);
const s3ObjectName = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));
const targetBucket = args.find(arg => arg.startsWith('--bucket='))?.split('=')[1];

if (!s3ObjectName) {
  console.error('❌ No S3 backup object specified');
  console.error('\nUsage:');
  console.error('  npm run restore:s3 -- backups/backup_file.tar.gz');
  console.error('  npm run restore:s3 -- backups/backup_file.tar.gz --bucket=my-bucket');
  console.error('\nTo list available backups, check your S3 backup bucket.');
  process.exit(1);
}

restoreMinIOFromS3(s3ObjectName, targetBucket);
