import { randomBytes, createHash } from 'crypto';
import prisma from '../config/database';
import { config } from '../config/env';
import type { Prisma } from '@prisma/client';

type ApiKey = Prisma.ApiKeyGetPayload<{
  include: {
    user?: {
      select: {
        id: true;
        email: true;
        role: true;
      };
    };
  };
}>;

export interface CreateApiKeyInput {
  name: string;
  description?: string;
  userId: string;
  allowedIPs?: string[];
  allowedDomains?: string[];
  scopes?: string[]; // API scopes (empty = full access)
  rateLimit?: number;
  quota?: number;
  expiresAt?: Date;
}

export interface ApiKeyWithUsage extends ApiKey {
  usageLogs?: {
    count: number;
    lastUsedAt: Date | null;
  };
}

export class ApiKeyService {
  /**
   * Generate a new API key
   * Format: sk_live_<random32chars> or sk_test_<random32chars>
   */
  private generateApiKey(prefix: string = 'sk_live_'): string {
    const randomPart = randomBytes(16).toString('hex');
    return `${prefix}${randomPart}`;
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Create a new API key
   */
  async createApiKey(input: CreateApiKeyInput): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const plainKey = this.generateApiKey();
    const hashedKey = this.hashApiKey(plainKey);
    const keyPrefix = plainKey.substring(0, 12); // First 12 chars for display

      const apiKey = await prisma.apiKey.create({
        data: {
          key: hashedKey,
          keyPrefix,
          name: input.name,
          description: input.description,
          userId: input.userId,
          allowedIPs: input.allowedIPs || [],
          allowedDomains: input.allowedDomains || [],
          scopes: input.scopes || [],
          rateLimit: input.rateLimit ?? config.rateLimit.defaultMax,
          quota: input.quota,
          expiresAt: input.expiresAt,
          isActive: true,
        },
      });

    return { apiKey: apiKey as ApiKey, plainKey };
  }

  /**
   * Validate API key and check permissions
   */
  async validateApiKey(
    key: string,
    ip?: string,
    origin?: string
  ): Promise<{ valid: boolean; apiKey?: ApiKey; error?: string }> {
    const hashedKey = this.hashApiKey(key);

    const apiKey = await prisma.apiKey.findUnique({
      where: { key: hashedKey },
      include: { user: true },
    });

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check if key is active
    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is inactive' };
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Check quota
    if (apiKey.quota !== null && apiKey.quotaUsed >= apiKey.quota) {
      return { valid: false, error: 'API key quota exceeded' };
    }

    // Check IP restrictions
    if (apiKey.allowedIPs.length > 0 && ip) {
      const ipAllowed = apiKey.allowedIPs.some((allowedIP: string) => {
        // Support CIDR notation or exact match
        if (allowedIP === ip) return true;
        // Simple CIDR check (can be improved)
        if (allowedIP.includes('/')) {
          // For now, just check if IP starts with the prefix
          const [prefix] = allowedIP.split('/');
          return ip.startsWith(prefix);
        }
        return false;
      });

      if (!ipAllowed) {
        return { valid: false, error: 'IP address not allowed' };
      }
    }

    // Check domain restrictions
    if (apiKey.allowedDomains.length > 0 && origin) {
      try {
        const originUrl = new URL(origin);
        const originHost = originUrl.hostname;

        const domainAllowed = apiKey.allowedDomains.some((allowedDomain: string) => {
          // Exact match or subdomain match
          return originHost === allowedDomain || originHost.endsWith(`.${allowedDomain}`);
        });

        if (!domainAllowed) {
          return { valid: false, error: 'Domain not allowed' };
        }
      } catch (e) {
        return { valid: false, error: 'Invalid origin' };
      }
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIP: ip,
      },
    });

    return { valid: true, apiKey: apiKey as ApiKey };
  }

  /**
   * Increment quota usage
   */
  async incrementQuotaUsage(apiKeyId: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        quotaUsed: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Log API key usage
   */
  async logUsage(
    apiKeyId: string,
    ip: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number
  ): Promise<void> {
    await Promise.all([
      prisma.apiKeyUsageLog.create({
        data: {
          apiKeyId,
          ip,
          endpoint,
          method,
          statusCode,
          responseTime,
        },
      }),
      this.incrementQuotaUsage(apiKeyId),
    ]);
  }

  /**
   * Get all API keys for a user
   */
  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ApiKey[]>;
  }

  /**
   * Get all API keys (admin)
   */
  async getAllApiKeys(): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ApiKey[]>;
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(id: string, userId?: string): Promise<ApiKey | null> {
    const where: Prisma.ApiKeyWhereInput = { id };
    if (userId) {
      where.userId = userId;
    }

    return prisma.apiKey.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        usageLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    }) as Promise<ApiKey | null>;
  }

  /**
   * Update API key
   */
  async updateApiKey(
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      allowedIPs?: string[];
      allowedDomains?: string[];
      scopes?: string[];
      rateLimit?: number;
      quota?: number;
      expiresAt?: Date | null;
      isActive?: boolean;
    }
  ): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: {
        id,
        userId, // Ensure user owns the key
      },
      data,
    }) as unknown as Promise<ApiKey>;
  }

  /**
   * Delete API key
   */
  async deleteApiKey(id: string, userId: string): Promise<void> {
    await prisma.apiKey.delete({
      where: {
        id,
        userId, // Ensure user owns the key
      },
    });
  }

  /**
   * Rotate API key (create new, deactivate old)
   */
  async rotateApiKey(
    id: string,
    userId: string,
    input: CreateApiKeyInput
  ): Promise<{ apiKey: ApiKey; plainKey: string }> {
    // Deactivate old key
    await prisma.apiKey.update({
      where: { id, userId },
      data: { isActive: false },
    });

    // Create new key
    return this.createApiKey(input);
  }

  /**
   * Get usage statistics for an API key
   */
  async getUsageStats(apiKeyId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalRequests, requestsByEndpoint, requestsByDay, recentRequests] = await Promise.all([
      // Total requests
      prisma.apiKeyUsageLog.count({
        where: {
          apiKeyId,
          createdAt: { gte: startDate },
        },
      }),

      // Requests by endpoint
      prisma.apiKeyUsageLog.groupBy({
        by: ['endpoint'],
        where: {
          apiKeyId,
          createdAt: { gte: startDate },
        },
        _count: true,
        orderBy: {
          _count: {
            endpoint: 'desc',
          },
        },
      }),

      // Requests by day
      prisma.$queryRaw<
        Array<{ date: Date; count: bigint }>
      >`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM api_key_usage_logs
        WHERE api_key_id = ${apiKeyId}
        AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,

      // Recent requests
      prisma.apiKeyUsageLog.findMany({
        where: {
          apiKeyId,
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      totalRequests,
      requestsByEndpoint: requestsByEndpoint.map((item: { endpoint: string; _count: number }) => ({
        endpoint: item.endpoint,
        count: item._count,
      })),
      requestsByDay: requestsByDay.map((item: { date: Date; count: bigint }) => ({
        date: item.date,
        count: Number(item.count),
      })),
      recentRequests,
    };
  }
}

export const apiKeyService = new ApiKeyService();
