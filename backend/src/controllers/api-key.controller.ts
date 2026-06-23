import { Response } from 'express';
import { apiKeyService, CreateApiKeyInput } from '../services/api-key.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class ApiKeyController {
  /**
   * Create a new API key
   * POST /api/api-keys
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        name,
        description,
        allowedIPs,
        allowedDomains,
        scopes,
        rateLimit,
        quota,
        expiresAt,
      } = req.body;

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const input: CreateApiKeyInput = {
        name,
        description,
        userId,
        allowedIPs: Array.isArray(allowedIPs) ? allowedIPs : undefined,
        allowedDomains: Array.isArray(allowedDomains) ? allowedDomains : undefined,
        scopes: Array.isArray(scopes) ? scopes : undefined,
        rateLimit: typeof rateLimit === 'number' ? rateLimit : undefined,
        quota: typeof quota === 'number' ? quota : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      };

      const { apiKey, plainKey } = await apiKeyService.createApiKey(input);

      res.status(201).json({
        apiKey: {
          id: apiKey.id,
          keyPrefix: apiKey.keyPrefix,
          name: apiKey.name,
          description: apiKey.description,
          allowedIPs: apiKey.allowedIPs,
          allowedDomains: apiKey.allowedDomains,
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          quota: apiKey.quota,
          quotaUsed: apiKey.quotaUsed,
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          lastUsedIP: apiKey.lastUsedIP,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.updatedAt,
        },
        // Return plain key only once (for security)
        key: plainKey,
        message: 'API key created successfully. Store this key securely - it will not be shown again.',
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({
        error: 'Failed to create API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all API keys for current user
   * GET /api/api-keys
   */
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Admin can see all keys, regular users see only their own
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const apiKeys = isAdmin
        ? await apiKeyService.getAllApiKeys()
        : await apiKeyService.getUserApiKeys(userId);

      // Remove sensitive data (hashed keys)
      const sanitizedKeys = apiKeys.map((key) => ({
        id: key.id,
        keyPrefix: key.keyPrefix,
        name: key.name,
        description: key.description,
        allowedIPs: key.allowedIPs,
        allowedDomains: key.allowedDomains,
        scopes: key.scopes,
        rateLimit: key.rateLimit,
        quota: key.quota,
        quotaUsed: key.quotaUsed,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        lastUsedIP: key.lastUsedIP,
        isActive: key.isActive,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
        user: 'user' in key ? key.user : undefined,
      }));

      res.json({ apiKeys: sanitizedKeys });
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({
        error: 'Failed to fetch API keys',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get API key by ID
   * GET /api/api-keys/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

      const apiKey = await apiKeyService.getApiKeyById(id, isAdmin ? undefined : userId);

      if (!apiKey) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      // Remove sensitive data
      const sanitizedKey = {
        id: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        description: apiKey.description,
        allowedIPs: apiKey.allowedIPs,
        allowedDomains: apiKey.allowedDomains,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        quota: apiKey.quota,
        quotaUsed: apiKey.quotaUsed,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        lastUsedIP: apiKey.lastUsedIP,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
        user: apiKey.user,
        usageLogs: (apiKey as { usageLogs?: unknown[] }).usageLogs?.slice(0, 50),
      };

      res.json({ apiKey: sanitizedKey });
    } catch (error) {
      console.error('Error fetching API key:', error);
      res.status(500).json({
        error: 'Failed to fetch API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update API key
   * PUT /api/api-keys/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const {
        name,
        description,
        allowedIPs,
        allowedDomains,
        scopes,
        rateLimit,
        quota,
        expiresAt,
        isActive,
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (allowedIPs !== undefined) updateData.allowedIPs = allowedIPs;
      if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
      if (scopes !== undefined) updateData.scopes = scopes;
      if (rateLimit !== undefined) updateData.rateLimit = rateLimit;
      if (quota !== undefined) updateData.quota = quota;
      if (expiresAt !== undefined) {
        updateData.expiresAt = expiresAt === null ? null : new Date(expiresAt);
      }
      if (isActive !== undefined) updateData.isActive = isActive;

      const apiKey = await apiKeyService.updateApiKey(id, userId, updateData);

      res.json({
        apiKey: {
          id: apiKey.id,
          keyPrefix: apiKey.keyPrefix,
          name: apiKey.name,
          description: apiKey.description,
          allowedIPs: apiKey.allowedIPs,
          allowedDomains: apiKey.allowedDomains,
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          quota: apiKey.quota,
          quotaUsed: apiKey.quotaUsed,
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          lastUsedIP: apiKey.lastUsedIP,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.updatedAt,
        },
      });
    } catch (error) {
      console.error('Error updating API key:', error);
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }
      res.status(500).json({
        error: 'Failed to update API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete API key
   * DELETE /api/api-keys/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      await apiKeyService.deleteApiKey(id, userId);

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting API key:', error);
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }
      res.status(500).json({
        error: 'Failed to delete API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Rotate API key (create new, deactivate old)
   * POST /api/api-keys/:id/rotate
   */
  async rotate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const {
        name,
        description,
        allowedIPs,
        allowedDomains,
        scopes,
        rateLimit,
        quota,
        expiresAt,
      } = req.body;

      // Get existing key to preserve settings
      const existingKey = await apiKeyService.getApiKeyById(id, userId);
      if (!existingKey) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      const input: CreateApiKeyInput = {
        name: name || existingKey.name,
        description: description !== undefined ? description : existingKey.description || undefined,
        userId,
        allowedIPs: allowedIPs !== undefined ? allowedIPs : existingKey.allowedIPs,
        allowedDomains:
          allowedDomains !== undefined ? allowedDomains : existingKey.allowedDomains,
        scopes: scopes !== undefined ? scopes : existingKey.scopes,
        rateLimit: rateLimit !== undefined ? rateLimit : existingKey.rateLimit,
        quota: quota !== undefined ? quota : existingKey.quota || undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : existingKey.expiresAt || undefined,
      };

      const { apiKey, plainKey } = await apiKeyService.rotateApiKey(id, userId, input);

      res.status(201).json({
        apiKey: {
          id: apiKey.id,
          keyPrefix: apiKey.keyPrefix,
          name: apiKey.name,
          description: apiKey.description,
          allowedIPs: apiKey.allowedIPs,
          allowedDomains: apiKey.allowedDomains,
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          quota: apiKey.quota,
          quotaUsed: apiKey.quotaUsed,
          expiresAt: apiKey.expiresAt,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.updatedAt,
        },
        key: plainKey,
        message: 'API key rotated successfully. Old key has been deactivated.',
      });
    } catch (error) {
      console.error('Error rotating API key:', error);
      res.status(500).json({
        error: 'Failed to rotate API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get usage statistics for API key
   * GET /api/api-keys/:id/stats
   */
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const apiKey = await apiKeyService.getApiKeyById(id, isAdmin ? undefined : userId);

      if (!apiKey) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      const stats = await apiKeyService.getUsageStats(id, days);

      res.json({
        apiKeyId: id,
        period: `${days} days`,
        stats,
      });
    } catch (error) {
      console.error('Error fetching API key stats:', error);
      res.status(500).json({
        error: 'Failed to fetch API key statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get available API scopes
   * GET /api/api-keys/scopes
   */
  async getScopes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { getAllScopes, getScopesByResource } = await import('../utils/api-scopes');
      const scopes = getAllScopes();
      const grouped = getScopesByResource();

      res.json({
        scopes,
        grouped,
      });
    } catch (error) {
      console.error('Error fetching API scopes:', error);
      res.status(500).json({
        error: 'Failed to fetch API scopes',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const apiKeyController = new ApiKeyController();
