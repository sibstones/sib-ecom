/**
 * Verifies that expected schema is present (e.g. after migrate deploy in Docker).
 * Exits 0 if footers.socialLinks column exists, 1 otherwise.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    const result = await prisma.$queryRaw<
      { column_name: string }[]
    >`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'footers'
        AND column_name = 'socialLinks'
    `;
    if (result.length > 0) {
      console.log('[Backend] Verified: footers.socialLinks column exists.');
      process.exit(0);
    } else {
      console.error('[Backend] Verification failed: footers.socialLinks column not found.');
      process.exit(1);
    }
  } catch (e) {
    console.error('[Backend] Verification error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
