import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DockerConfig {
  containerName: string;
  dbUser: string;
  dbName: string;
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
  const containerName = process.env.POSTGRES_CONTAINER_NAME || 'fashion-postgres';
  const dbUser = process.env.POSTGRES_USER || 'postgres';
  const dbName = process.env.POSTGRES_DB || 'fashion_db';

  return { containerName, dbUser, dbName };
}

function getBackupDir(): string {
  return process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
}

function findLatestBackup(): string | null {
  const backupDir = getBackupDir();
  
  if (!fs.existsSync(backupDir)) {
    return null;
  }

  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.dump') || file.endsWith('.sql'))
    .map(file => ({
      name: file,
      path: path.join(backupDir, file),
      time: fs.statSync(path.join(backupDir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  return files.length > 0 ? files[0].path : null;
}

function restoreDatabase(backupPath: string, dropFirst: boolean = false) {
  try {
    const config = getDockerConfig();

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Check if container is running
    if (!checkDockerContainer(config.containerName)) {
      throw new Error(
        `PostgreSQL container "${config.containerName}" is not running.\n` +
        `Start it with: docker-compose up -d postgres`
      );
    }

    console.log('🔄 Starting Docker database restoration...\n');
    console.log(`   Container: ${config.containerName}`);
    console.log(`   Database: ${config.dbName}`);
    console.log(`   User: ${config.dbUser}`);
    console.log(`   Backup file: ${backupPath}\n`);

    // Check if database exists and drop if requested
    if (dropFirst) {
      console.log('⚠️  Dropping existing database...');
      try {
        execSync(
          `docker exec ${config.containerName} psql -U ${config.dbUser} -d postgres -c "DROP DATABASE IF EXISTS ${config.dbName};"`,
          { stdio: 'inherit' }
        );
        console.log('   ✅ Database dropped\n');
      } catch (error) {
        console.warn('   ⚠️  Could not drop database (might not exist):', error instanceof Error ? error.message : error);
      }

      // Create database
      console.log('   Creating new database...');
      execSync(
        `docker exec ${config.containerName} psql -U ${config.dbUser} -d postgres -c "CREATE DATABASE ${config.dbName};"`,
        { stdio: 'inherit' }
      );
      console.log('   ✅ Database created\n');
    }

    // Copy backup file to container if it's a local file
    const backupFileName = path.basename(backupPath);
    const containerBackupPath = `/tmp/${backupFileName}`;

    console.log('   Copying backup file to container...');
    execSync(
      `docker cp "${backupPath}" ${config.containerName}:${containerBackupPath}`,
      { stdio: 'inherit' }
    );

    // Restore backup
    console.log('   Restoring backup...');
    
    if (backupPath.endsWith('.dump')) {
      // Custom format backup - use pg_restore
      execSync(
        `docker exec ${config.containerName} pg_restore -U ${config.dbUser} -d ${config.dbName} --clean --if-exists --no-owner --no-acl ${containerBackupPath}`,
        { stdio: 'inherit' }
      );
    } else {
      // SQL format backup - use psql
      execSync(
        `docker exec -i ${config.containerName} psql -U ${config.dbUser} -d ${config.dbName} < "${backupPath}"`,
        { stdio: 'inherit' }
      );
    }

    // Clean up backup file from container
    execSync(
      `docker exec ${config.containerName} rm ${containerBackupPath}`,
      { stdio: 'ignore' }
    );

    console.log('\n✅ Database restoration completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run migrations: npm run prisma:migrate');
    console.log('   2. Generate Prisma client: npm run prisma:generate');
    console.log('   3. Restart the application');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error restoring database:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('docker')) {
      console.error('\n💡 Make sure Docker is running and PostgreSQL container is started:');
      console.error('   docker-compose up -d postgres');
    }
    
    process.exit(1);
  }
}

// Get backup path from command line arguments or use latest
const args = process.argv.slice(2);
const dropFirst = args.includes('--drop') || args.includes('-d');
const useLatest = args.includes('--latest') || args.includes('-l');
const backupPathArg = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));

let backupPath: string | null;

if (useLatest) {
  backupPath = findLatestBackup();
  if (!backupPath) {
    console.error(`❌ No backup files found in ${getBackupDir()}`);
    process.exit(1);
  }
} else {
  backupPath = backupPathArg || findLatestBackup();
}

if (!backupPath) {
  console.error(`❌ No backup file specified and no backups found in ${getBackupDir()}`);
  console.error('\nUsage:');
  console.error('  npm run restore:db-docker -- <backup-file-path>');
  console.error('  npm run restore:db-docker -- <backup-file-path> --drop');
  console.error('  npm run restore:db-docker --latest');
  console.error('  npm run restore:db-docker --latest --drop');
  console.error('\nThe --drop flag will drop and recreate the database before restoration.');
  process.exit(1);
}

restoreDatabase(backupPath, dropFirst);
