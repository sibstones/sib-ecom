import * as fs from 'fs';
import * as path from 'path';

function getBackupDir(): string {
  return process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
}

function listBackups() {
  try {
    const backupDir = getBackupDir();
    
    if (!fs.existsSync(backupDir)) {
      console.log('📁 No backups directory found.');
      console.log('   Run "npm run backup:db" to create your first backup.');
      return;
    }

    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.dump') || file.endsWith('.sql'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());

    if (files.length === 0) {
      console.log(`📁 No backup files found in ${backupDir}.`);
      console.log('   Run "npm run backup:db" to create your first backup.');
      return;
    }

    console.log(`📁 Found ${files.length} backup file(s):\n`);
    
    files.forEach((file, index) => {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const isLatest = index === 0;
      const marker = isLatest ? '⭐ (latest)' : '';
      
      console.log(`${index + 1}. ${file.name} ${marker}`);
      console.log(`   Size: ${sizeMB} MB`);
      console.log(`   Created: ${file.created.toLocaleString()}`);
      console.log(`   Modified: ${file.modified.toLocaleString()}`);
      console.log(`   Path: ${file.path}`);
      console.log('');
    });

    if (files.length > 0) {
      console.log('💡 To restore a backup:');
      console.log(`   npm run restore:db -- ${files[0].path}`);
      console.log(`   npm run restore:db -- ${files[0].path} --drop`);
      console.log('\n💡 To restore the latest backup:');
      console.log('   npm run restore:db --latest');
      console.log('   npm run restore:db --latest --drop');
    }
  } catch (error) {
    console.error('❌ Error listing backups:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

listBackups();
