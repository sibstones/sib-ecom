import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MAX_RETRIES = 30;
const RETRY_DELAY = 2000; // 2 seconds

async function waitForDatabase() {
  console.log('Waiting for database to be ready...');
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database is ready!');
      await prisma.$disconnect();
      return true;
    } catch (error) {
      const attempt = i + 1;
      if (attempt < MAX_RETRIES) {
        console.log(`Attempt ${attempt}/${MAX_RETRIES}: Database not ready, retrying in ${RETRY_DELAY / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        console.error('❌ Failed to connect to database after', MAX_RETRIES, 'attempts');
        throw error;
      }
    }
  }
  
  throw new Error('Database connection timeout');
}

waitForDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error waiting for database:', error);
    process.exit(1);
  });
