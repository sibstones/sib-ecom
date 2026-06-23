import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DockerConfig {
  containerName: string;
  dbUser: string;
  dbName: string;
}

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

function checkDockerContainer(containerName: string): boolean {
  try {
    const result = execSync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, {
      encoding: 'utf-8',
    });
    return result.trim() === containerName;
  } catch {
    return false;
  }
}

function getDockerConfig(): DockerConfig {
  // Try to get from environment or use defaults
  const containerName = process.env.POSTGRES_CONTAINER_NAME || 'fashion-postgres';
  const dbUser = process.env.POSTGRES_USER || 'postgres';
  const dbName = process.env.POSTGRES_DB || 'fashion_db';

  return { containerName, dbUser, dbName };
}

function createBackup() {
  try {
    console.log('🐳 Starting Docker database backup...\n');

    const config = getDockerConfig();
    console.log(`   Container: ${config.containerName}`);
    console.log(`   Database: ${config.dbName}`);
    console.log(`   User: ${config.dbUser}\n`);

    // Check if container is running
    if (!checkDockerContainer(config.containerName)) {
      throw new Error(
        `PostgreSQL container "${config.containerName}" is not running.\n` +
        `Start it with: docker-compose up -d postgres`
      );
    }

    const backupDir = ensureBackupDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupFileName = `backup_${config.dbName}_${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFileName);

    // Create backup using pg_dump inside Docker container
    console.log('   Creating backup file...');
    execSync(
      `docker exec ${config.containerName} pg_dump -U ${config.dbUser} -d ${config.dbName} > "${backupPath}"`,
      { stdio: 'inherit' }
    );

    // Also create custom format backup
    const customBackupFileName = `backup_${config.dbName}_${timestamp}.dump`;
    const customBackupPath = path.join(backupDir, customBackupFileName);
    
    console.log('   Creating custom format backup...');
    execSync(
      `docker exec ${config.containerName} pg_dump -U ${config.dbUser} -d ${config.dbName} -F c -f /tmp/${customBackupFileName}`,
      { stdio: 'inherit' }
    );

    // Copy custom format backup from container to host
    execSync(
      `docker cp ${config.containerName}:/tmp/${customBackupFileName} "${customBackupPath}"`,
      { stdio: 'inherit' }
    );

    // Clean up file from container
    execSync(
      `docker exec ${config.containerName} rm /tmp/${customBackupFileName}`,
      { stdio: 'ignore' }
    );

    // Get file sizes
    const customSize = fs.statSync(customBackupPath).size;
    const sqlSize = fs.statSync(backupPath).size;
    
    console.log('\n✅ Backup completed successfully!\n');
    console.log('📁 Backup files:');
    console.log(`   Custom format: ${customBackupPath} (${(customSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   SQL format: ${backupPath} (${(sqlSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`\n💡 To restore, use: npm run restore:db-docker -- ${customBackupPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating backup:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('docker')) {
      console.error('\n💡 Make sure Docker is running and PostgreSQL container is started:');
      console.error('   docker-compose up -d postgres');
    }
    
    process.exit(1);
  }
}

createBackup();
