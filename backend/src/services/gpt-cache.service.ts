import crypto from 'crypto';

interface CacheEntry {
  key: string;
  value: any;
  expiresAt: Date;
}

/**
 * Simple in-memory cache for GPT assistant requests
 * For production, consider using Redis or similar
 */
class GPTCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Maximum number of cached entries

  /**
   * Generate cache key from message and context
   */
  private generateCacheKey(
    message: string,
    userType: 'admin' | 'customer',
    context?: any
  ): string {
    const normalizedMessage = message.toLowerCase().trim();
    const contextStr = context ? JSON.stringify(context) : '';
    const data = `${userType}:${normalizedMessage}:${contextStr}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached response
   */
  get(
    message: string,
    userType: 'admin' | 'customer',
    context?: any
  ): any | null {
    const key = this.generateCacheKey(message, userType, context);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cached response
   */
  set(
    message: string,
    userType: 'admin' | 'customer',
    value: any,
    ttlMs?: number,
    context?: any
  ): void {
    // Clean up if cache is too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }

    const key = this.generateCacheKey(message, userType, context);
    const expiresAt = new Date(Date.now() + (ttlMs || this.DEFAULT_TTL_MS));

    this.cache.set(key, {
      key,
      value,
      expiresAt,
    });
  }

  /**
   * Clear expired entries
   */
  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    // If still too large, remove oldest entries
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].expiresAt.getTime() - b[1].expiresAt.getTime());
      
      const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific user type
   */
  clearByUserType(userType: 'admin' | 'customer'): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      // Extract user type from cached value if available
      if (entry.value?.userType === userType) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; expiresAt: Date }>;
  } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      entries: Array.from(this.cache.values()).map(entry => ({
        key: entry.key,
        expiresAt: entry.expiresAt,
      })),
    };
  }
}

export const gptCacheService = new GPTCacheService();

// Cleanup expired entries every minute
setInterval(() => {
  gptCacheService['cleanup']();
}, 60 * 1000);
