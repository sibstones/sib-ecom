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

function checkPostgreSQLTools() {
  try {
    execSync('which psql', { stdio: 'ignore' });
    execSync('which pg_restore', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function restoreDatabase(backupPath: string, dropFirst: boolean = false) {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Check if PostgreSQL tools are available
    if (!checkPostgreSQLTools()) {
      throw new Error(
        'PostgreSQL client tools (psql, pg_restore) not found.\n' +
        'Please install PostgreSQL client tools:\n' +
        '  macOS: brew install postgresql\n' +
        '  Ubuntu/Debian: sudo apt-get install postgresql-client\n' +
        '  Windows: Install PostgreSQL from https://www.postgresql.org/download/'
      );
    }

    console.log('🔄 Starting database restoration...\n');
    
    const config = parseDatabaseUrl(databaseUrl);
    console.log(`   Database: ${config.database}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   User: ${config.user}`);
    console.log(`   Backup file: ${backupPath}\n`);

    // Set PGPASSWORD environment variable
    process.env.PGPASSWORD = config.password;

    // Check if database exists and drop if requested
    if (dropFirst) {
      console.log('⚠️  Dropping existing database...');
      try {
        // Connect to postgres database to drop the target database
        execSync(
          `psql -h ${config.host} -p ${config.port} -U ${config.user} -d postgres -c "DROP DATABASE IF EXISTS ${config.database};"`,
          { stdio: 'inherit', env: { ...process.env, PGPASSWORD: config.password } }
        );
        console.log('   ✅ Database dropped\n');
      } catch (error) {
        console.warn('   ⚠️  Could not drop database (might not exist):', error instanceof Error ? error.message : error);
      }

      // Create database
      console.log('   Creating new database...');
      execSync(
        `psql -h ${config.host} -p ${config.port} -U ${config.user} -d postgres -c "CREATE DATABASE ${config.database};"`,
        { stdio: 'inherit', env: { ...process.env, PGPASSWORD: config.password } }
      );
      console.log('   ✅ Database created\n');
    }

    // Restore backup
    console.log('   Restoring backup...');
    
    if (backupPath.endsWith('.dump')) {
      // Custom format backup - use pg_restore
      execSync(
        `pg_restore -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} --clean --if-exists --no-owner --no-acl "${backupPath}"`,
        { stdio: 'inherit', env: { ...process.env, PGPASSWORD: config.password } }
      );
    } else {
      // SQL format backup - use psql
      execSync(
        `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -f "${backupPath}"`,
        { stdio: 'inherit', env: { ...process.env, PGPASSWORD: config.password } }
      );
    }

    console.log('\n✅ Database restoration completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run migrations: npm run prisma:migrate');
    console.log('   2. Generate Prisma client: npm run prisma:generate');
    console.log('   3. Restart the application');
    
    // Clean up password from environment
    delete process.env.PGPASSWORD;
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error restoring database:', error instanceof Error ? error.message : error);
    
    // Clean up password from environment
    delete process.env.PGPASSWORD;
    
    if (error instanceof Error && (error.message.includes('pg_restore') || error.message.includes('psql'))) {
      console.error('\n💡 Make sure PostgreSQL client tools are installed:');
      console.error('   macOS: brew install postgresql');
      console.error('   Ubuntu/Debian: sudo apt-get install postgresql-client');
      console.error('   Windows: Install PostgreSQL from https://www.postgresql.org/download/');
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
  console.error('  npm run restore:db -- <backup-file-path>');
  console.error('  npm run restore:db -- <backup-file-path> --drop');
  console.error('  npm run restore:db --latest');
  console.error('  npm run restore:db --latest --drop');
  console.error('\nThe --drop flag will drop and recreate the database before restoration.');
  process.exit(1);
}

restoreDatabase(backupPath, dropFirst);
