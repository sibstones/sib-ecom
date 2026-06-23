import prisma from '../config/database';
import { comparePassword } from '../utils/hash';

/**
 * Check admin users and verify passwords
 * Useful for debugging authentication issues
 */
async function checkAdmins(): Promise<void> {
  try {
    console.log('🔍 Checking admin users...\n');

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Check Super Admin
    if (superAdminEmail) {
      console.log(`📧 Looking for Super Admin: ${superAdminEmail}`);
      const user = await prisma.user.findUnique({
        where: { email: superAdminEmail },
      });

      if (!user) {
        console.log(`❌ Super Admin NOT FOUND in database`);
        console.log(`   Email: ${superAdminEmail}`);
        console.log(`   Action: Run 'npm run init:admins' to create the user\n`);
      } else {
        console.log(`✅ Super Admin found:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Email Verified: ${user.emailVerified}`);

        if (superAdminPassword) {
          const passwordMatch = await comparePassword(superAdminPassword, user.passwordHash ?? '');
          if (passwordMatch) {
            console.log(`   ✅ Password matches environment variable\n`);
          } else {
            console.log(`   ❌ Password DOES NOT MATCH environment variable`);
            console.log(`   Expected password from env: ${superAdminPassword}`);
            console.log(`   Action: Run 'npm run reset:admins' to update password\n`);
          }
        } else {
          console.log(`   ⚠️  SUPER_ADMIN_PASSWORD not set in environment\n`);
        }
      }
    } else {
      console.log(`⚠️  SUPER_ADMIN_EMAIL not set in environment\n`);
    }

    // Check Admin
    if (adminEmail) {
      console.log(`📧 Looking for Admin: ${adminEmail}`);
      const user = await prisma.user.findUnique({
        where: { email: adminEmail },
      });

      if (!user) {
        console.log(`❌ Admin NOT FOUND in database`);
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Action: Run 'npm run init:admins' to create the user\n`);
      } else {
        console.log(`✅ Admin found:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Email Verified: ${user.emailVerified}`);

        if (adminPassword) {
          const passwordMatch = await comparePassword(adminPassword, user.passwordHash ?? '');
          if (passwordMatch) {
            console.log(`   ✅ Password matches environment variable\n`);
          } else {
            console.log(`   ❌ Password DOES NOT MATCH environment variable`);
            console.log(`   Expected password from env: ${adminPassword}`);
            console.log(`   Action: Run 'npm run reset:admins' to update password\n`);
          }
        } else {
          console.log(`   ⚠️  ADMIN_PASSWORD not set in environment\n`);
        }
      }
    } else {
      console.log(`⚠️  ADMIN_EMAIL not set in environment\n`);
    }

    // List all admin users
    console.log('📋 All admin users in database:');
    const allAdmins = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPER_ADMIN'],
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
      },
    });

    if (allAdmins.length === 0) {
      console.log('   No admin users found in database');
    } else {
      allAdmins.forEach((admin) => {
        console.log(`   - ${admin.email} (${admin.role})`);
      });
    }

    console.log('\n✅ Check completed');
  } catch (error) {
    console.error('❌ Failed to check admin users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  checkAdmins()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { checkAdmins };
