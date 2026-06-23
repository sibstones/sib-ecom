/**
 * Centralized database error handler utility
 * Provides consistent error handling across all services
 */

export interface DatabaseError {
  code?: string;
  message: string;
}

export class DatabaseErrorHandler {
  /**
   * Handles Prisma/database errors and returns appropriate error or fallback value
   * @param error - The error to handle
   * @param serviceName - Name of the service for logging
   * @param fallbackValue - Value to return for non-critical errors (e.g., empty array)
   * @returns The fallback value for non-critical errors, or throws an error for critical ones
   */
  static handleError<T>(
    error: unknown,
    serviceName: string,
    fallbackValue: T
  ): T {
    console.error(`Error in ${serviceName}:`, error);

    if (!(error instanceof Error)) {
      throw error;
    }

    const errorMessage = error.message;
    const errorCode = (error as any)?.code;

    // Table doesn't exist (P2021, P2022, or specific error messages)
    if (
      errorCode === 'P2021' ||
      errorCode === 'P2022' ||
      errorMessage.includes('does not exist') ||
      errorMessage.includes('Unknown table') ||
      errorMessage.includes('relation') ||
      (errorMessage.includes('table') && errorMessage.includes('not found'))
    ) {
      console.warn(
        `⚠️  Table may not exist in ${serviceName}. Run migrations: npm run prisma:migrate`
      );
      return fallbackValue;
    }

    // Database connection error (P1001, P1002, P1003)
    if (
      errorCode === 'P1001' ||
      errorCode === 'P1002' ||
      errorCode === 'P1003' ||
      errorMessage.includes("Can't reach database") ||
      errorMessage.includes('Connection') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('timeout')
    ) {
      console.error('❌ Database connection error. Check DATABASE_URL in .env');
      throw new Error(
        'Database connection failed. Please check your database configuration.'
      );
    }

    // Read-only file system error (PostgreSQL file system issue)
    if (
      errorMessage.includes('Read-only file system') ||
      errorMessage.includes('read-only') ||
      errorMessage.includes('could not open file') ||
      errorCode === '42501'
    ) {
      console.error('❌ Database file system is read-only. This may indicate:');
      console.error('   1. Database volume is mounted as read-only');
      console.error('   2. Database container lacks write permissions');
      console.error('   3. Database filesystem is corrupted');
      console.error('   4. Disk space issues');
      console.error(
        '   Solution: Check Docker volume permissions and restart the database container.'
      );
      throw new Error(
        'Database is in read-only mode. Please check database volume permissions and container configuration.'
      );
    }

    // Prisma client not generated
    if (
      errorMessage.includes('PrismaClient') ||
      errorMessage.includes('generated') ||
      errorMessage.includes('Cannot find module')
    ) {
      console.error('❌ Prisma Client not generated. Run: npm run prisma:generate');
      throw new Error(
        'Database client not initialized. Please run: npm run prisma:generate'
      );
    }

    // Authentication error
    if (errorCode === 'P1000' || errorMessage.includes('authentication')) {
      console.error(
        '❌ Database authentication failed. Check DATABASE_URL credentials.'
      );
      throw new Error(
        'Database authentication failed. Please check your database credentials.'
      );
    }

    // Re-throw other errors
    throw error;
  }

  /**
   * Wraps a database operation with error handling
   * @param operation - The database operation to execute
   * @param serviceName - Name of the service for logging
   * @param fallbackValue - Value to return for non-critical errors
   */
  static async wrapOperation<T>(
    operation: () => Promise<T>,
    serviceName: string,
    fallbackValue: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      return this.handleError(error, serviceName, fallbackValue);
    }
  }
}
