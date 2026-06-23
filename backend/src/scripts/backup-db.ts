import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DatabaseConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

function parseDatabaseUrl(url: string): DatabaseConfig {
  // Format: postgresql://user:password@host:port/database?schema=public
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  
  if (!match) {
    throw new Error('Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/database');
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
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

function checkPostgreSQLTools() {
  try {
    execSync('which pg_dump', { stdio: 'ignore' });
    execSync('which pg_restore', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function createBackup() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Check if PostgreSQL tools are available
    if (!checkPostgreSQLTools()) {
      throw new Error(
        'PostgreSQL client tools (pg_dump) not found.\n' +
        'Please install PostgreSQL client tools:\n' +
        '  macOS: brew install postgresql\n' +
        '  Ubuntu/Debian: sudo apt-get install postgresql-client\n' +
        '  Windows: Install PostgreSQL from https://www.postgresql.org/download/'
      );
    }

    console.log('📦 Starting database backup...\n');
    
    const config = parseDatabaseUrl(databaseUrl);
    console.log(`   Database: ${config.database}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   User: ${config.user}\n`);

    const backupDir = ensureBackupDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupFileName = `backup_${config.database}_${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFileName);

    // Set PGPASSWORD environment variable for pg_dump
    process.env.PGPASSWORD = config.password;

    // Create backup using pg_dump
    // Using custom format for better compression and flexibility
    const customBackupPath = backupPath.replace('.sql', '.dump');
    
    console.log('   Creating backup file...');
    execSync(
      `pg_dump -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -F c -f "${customBackupPath}"`,
      { stdio: 'inherit', env: { ...process.env, PGPASSWORD: config.password } }
    );

    // Also create SQL format backup for easier inspection
    console.log('   Creating SQL format backup...');
    execSync(
      `pg_dump -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -f "${backupPath}"`,
      { stdio: 'inherit', env: { ...process.env, PGPASSWORD: config.password } }
    );

    // Get file sizes
    const customSize = fs.statSync(customBackupPath).size;
    const sqlSize = fs.statSync(backupPath).size;
    
    console.log('\n✅ Backup completed successfully!\n');
    console.log('📁 Backup files:');
    console.log(`   Custom format: ${customBackupPath} (${(customSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   SQL format: ${backupPath} (${(sqlSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`\n💡 To restore, use: npm run restore:db -- ${customBackupPath}`);
    
    // Clean up password from environment
    delete process.env.PGPASSWORD;
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating backup:', error instanceof Error ? error.message : error);
    
    // Clean up password from environment
    delete process.env.PGPASSWORD;
    
    if (error instanceof Error && error.message.includes('pg_dump')) {
      console.error('\n💡 Make sure PostgreSQL client tools (pg_dump) are installed:');
      console.error('   macOS: brew install postgresql');
      console.error('   Ubuntu/Debian: sudo apt-get install postgresql-client');
      console.error('   Windows: Install PostgreSQL from https://www.postgresql.org/download/');
    }
    
    process.exit(1);
  }
}

createBackup();
