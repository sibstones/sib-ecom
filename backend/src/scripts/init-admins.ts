import prisma from '../config/database';
import { hashPassword } from '../utils/hash';
import { UserRole } from '@prisma/client';

interface AdminConfig {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}

/**
 * Initialize admin users from environment variables
 * Creates super admin and admin if they don't exist
 */
export async function initAdmins(): Promise<void> {
  try {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    const superAdminFirstName = process.env.SUPER_ADMIN_FIRST_NAME;
    const superAdminLastName = process.env.SUPER_ADMIN_LAST_NAME;

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminFirstName = process.env.ADMIN_FIRST_NAME;
    const adminLastName = process.env.ADMIN_LAST_NAME;

    const adminsToCreate: AdminConfig[] = [];

    // Super Admin
    if (superAdminEmail && superAdminPassword) {
      adminsToCreate.push({
        email: superAdminEmail,
        password: superAdminPassword,
        firstName: superAdminFirstName,
        lastName: superAdminLastName,
        role: UserRole.SUPER_ADMIN,
      });
    }

    // Admin
    if (adminEmail && adminPassword) {
      adminsToCreate.push({
        email: adminEmail,
        password: adminPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: UserRole.ADMIN,
      });
    }

    if (adminsToCreate.length === 0) {
      console.log('ℹ️  No admin users configured in environment variables');
      return;
    }

    console.log('🔐 Initializing admin users...');

    // Check if password reset is enabled
    // In development mode, passwords are always reset
    // In production, set RESET_ADMIN_PASSWORDS=true to enable password reset
    const resetPasswords = 
      process.env.RESET_ADMIN_PASSWORDS === 'true' || 
      process.env.NODE_ENV === 'development';
    
    if (resetPasswords) {
      console.log('🔄 Password reset enabled - passwords will be updated if users exist');
    }

    for (const adminConfig of adminsToCreate) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: adminConfig.email },
      });

      if (existingUser) {
        const updates: { role?: UserRole; passwordHash?: string; firstName?: string; lastName?: string } = {};
        let hasUpdates = false;

        // Update role if user exists but has different role
        if (existingUser.role !== adminConfig.role) {
          updates.role = adminConfig.role;
          hasUpdates = true;
        }

        // Update password if reset is enabled (for Docker/development environments)
        if (resetPasswords) {
          const passwordHash = await hashPassword(adminConfig.password);
          updates.passwordHash = passwordHash;
          hasUpdates = true;
        }

        // Update name fields if provided
        if (adminConfig.firstName && existingUser.firstName !== adminConfig.firstName) {
          updates.firstName = adminConfig.firstName;
          hasUpdates = true;
        }
        if (adminConfig.lastName && existingUser.lastName !== adminConfig.lastName) {
          updates.lastName = adminConfig.lastName;
          hasUpdates = true;
        }

        if (hasUpdates) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: updates,
          });
          const updateMessages = [];
          if (updates.role) updateMessages.push(`role to ${updates.role}`);
          if (updates.passwordHash) updateMessages.push('password');
          if (updates.firstName || updates.lastName) updateMessages.push('name');
          console.log(
            `✅ Updated user ${adminConfig.email}: ${updateMessages.join(', ')}`,
          );
        } else {
          console.log(
            `ℹ️  User ${adminConfig.email} already exists with role ${adminConfig.role}`,
          );
        }
        continue;
      }

      // Create new admin user
      const passwordHash = await hashPassword(adminConfig.password);

      const user = await prisma.user.create({
        data: {
          email: adminConfig.email,
          passwordHash,
          firstName: adminConfig.firstName,
          lastName: adminConfig.lastName,
          role: adminConfig.role,
          emailVerified: true, // Admins are pre-verified
        },
      });

      console.log(
        `✅ Created ${adminConfig.role} user: ${adminConfig.email} (ID: ${user.id})`,
      );
    }

    console.log('✅ Admin users initialization completed');
  } catch (error) {
    console.error('❌ Failed to initialize admin users:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initAdmins()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}
