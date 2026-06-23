import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';
import { UserType } from '../types/gpt-assistant';

export type RagRoutingMode = 'action_only' | 'rag_only' | 'hybrid';

export interface RagHealthStatus {
  enabled: boolean;
  configured: boolean;
  available: boolean;
  mode: RagRoutingMode;
  reason:
    | 'disabled'
    | 'missing_database_url'
    | 'disabled_for_user_type'
    | 'healthy'
    | 'database_unreachable';
  checkedAt: string | null;
  extensions: string[];
  error?: string;
}

class RagService {
  private readonly client: PrismaClient | null;
  private lastHealth: RagHealthStatus | null = null;
  private lastHealthCheckedAt = 0;
  private activeHealthCheck: Promise<RagHealthStatus> | null = null;

  constructor() {
    this.client = config.rag.databaseUrl
      ? new PrismaClient({
          datasources: {
            db: {
              url: config.rag.databaseUrl,
            },
          },
          log: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
        })
      : null;
  }

  isEnabledForUserType(userType: UserType): boolean {
    if (!config.rag.enabled) {
      return false;
    }

    switch (userType) {
      case 'admin':
        return config.rag.adminEnabled;
      case 'customer':
        return config.rag.customerEnabled;
      case 'guest':
        return config.rag.guestEnabled;
      default:
        return false;
    }
  }

  async getRoutingMode(userType: UserType): Promise<RagRoutingMode> {
    if (!this.isEnabledForUserType(userType)) {
      return 'action_only';
    }

    const health = await this.getHealth(userType);
    if (!health.available) {
      return 'action_only';
    }

    // Retrieval integration is not enabled yet; keep legacy assistant behavior even when infra is ready.
    return 'action_only';
  }

  async getHealth(userType?: UserType, force = false): Promise<RagHealthStatus> {
    if (!config.rag.enabled) {
      return this.buildStaticStatus('disabled');
    }

    if (userType && !this.isEnabledForUserType(userType)) {
      return this.buildStaticStatus('disabled_for_user_type');
    }

    if (!config.rag.databaseUrl || !this.client) {
      return this.buildStaticStatus('missing_database_url');
    }

    const cacheAge = Date.now() - this.lastHealthCheckedAt;
    if (!force && this.lastHealth && cacheAge < config.rag.healthCacheMs) {
      return this.lastHealth;
    }

    if (this.activeHealthCheck) {
      return this.activeHealthCheck;
    }

    this.activeHealthCheck = this.checkDatabaseHealth();

    try {
      const result = await this.activeHealthCheck;
      this.lastHealth = result;
      this.lastHealthCheckedAt = Date.now();
      return result;
    } finally {
      this.activeHealthCheck = null;
    }
  }

  private buildStaticStatus(
    reason: RagHealthStatus['reason'],
    overrides: Partial<RagHealthStatus> = {}
  ): RagHealthStatus {
    const configured = Boolean(config.rag.databaseUrl);
    return {
      enabled: config.rag.enabled,
      configured,
      available: false,
      mode: 'action_only',
      reason,
      checkedAt: null,
      extensions: [],
      ...overrides,
    };
  }

  private async checkDatabaseHealth(): Promise<RagHealthStatus> {
    if (!this.client) {
      return this.buildStaticStatus('missing_database_url');
    }

    try {
      await this.client.$connect();

      const extensionRows = await this.client.$queryRaw<Array<{ extname: string }>>`
        SELECT extname
        FROM pg_extension
        WHERE extname IN ('vector', 'pg_trgm')
        ORDER BY extname
      `;

      return {
        enabled: true,
        configured: true,
        available: true,
        mode: 'action_only',
        reason: 'healthy',
        checkedAt: new Date().toISOString(),
        extensions: extensionRows.map(row => row.extname),
      };
    } catch (error) {
      return {
        ...this.buildStaticStatus('database_unreachable'),
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const ragService = new RagService();
