import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { config } from '../config/env';
import {
  gptApiService,
  resolveGptClientConfig,
  type GptAssistantSettingsLike,
} from '../services/gpt-api.service';
import { decryptGptAssistantSecrets, encryptGptAssistantSecrets } from '../utils/crypto';
import {
  ALLOWED_GPT_PROVIDER_TYPES,
  ALLOWED_STT_PROVIDER_TYPES,
  isAllowedGptProviderType,
  isAllowedSttProviderType,
  normalizeApiBaseUrlInput,
  validateGptProviderEndpointRules,
} from '../utils/gpt-assistant-provider.validation';
import { ensureDefaultQuickPrompts } from '../services/gpt-assistant-quick-prompts.service';

export class GPTAssistantSettingsController {
  /**
   * Get GPT Assistant visibility flags (public, no auth).
   * Used by frontend to show/hide the GPT button for admins, customers, guests.
   */
  async getVisibility(req: Request, res: Response): Promise<void> {
    try {
      const settings = await prisma.gPTAssistantSettings.findFirst();
      const mode = settings?.mode ?? 'production';
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json({
        enabledAdmin: Boolean(settings?.enabledAdmin ?? true),
        enabledCustomer: Boolean(settings?.enabledCustomer ?? true),
        enabledGuest: Boolean(settings?.enabledGuest ?? false),
        mode,
      });
    } catch (error) {
      console.error('Get GPT visibility error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get visibility',
      });
    }
  }

  /**
   * Get GPT Assistant display config (public, no auth).
   * Returns custom title, FAB icon URL, and quick prompts for chat UI.
   */
  async getDisplayConfig(req: Request, res: Response): Promise<void> {
    try {
      await ensureDefaultQuickPrompts();

      const settings = await prisma.gPTAssistantSettings.findFirst();
      const displayTitle = (settings as any)?.displayTitle ?? null;
      const fabIconUrl = (settings as any)?.fabIconUrl ?? null;

      const quickPrompts = await prisma.gPTAssistantPrompt.findMany({
        where: {
          type: { in: ['quick_admin', 'quick_customer'] },
          isActive: true,
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      const quickPromptsAdmin = quickPrompts
        .filter(p => p.type === 'quick_admin')
        .map(p => ({ id: p.id, text: p.prompt }));
      const quickPromptsCustomer = quickPrompts
        .filter(p => p.type === 'quick_customer')
        .map(p => ({ id: p.id, text: p.prompt }));

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      const sttProvider = String((settings as { sttProvider?: string })?.sttProvider ?? 'none').toLowerCase();
      const safeStt = isAllowedSttProviderType(sttProvider) ? sttProvider : 'none';

      res.json({
        displayTitle: displayTitle || null,
        fabIconUrl: fabIconUrl || null,
        quickPromptsAdmin,
        quickPromptsCustomer,
        sttProvider: safeStt,
        sttEnabled: safeStt !== 'none',
      });
    } catch (error) {
      console.error('Get GPT display config error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get display config',
      });
    }
  }

  /**
   * Get GPT Assistant settings
   */
  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      let settings = decryptGptAssistantSecrets(await prisma.gPTAssistantSettings.findFirst());

      if (!settings) {
        // Return default settings
        settings = {
          id: '',
          enabledAdmin: true,
          enabledCustomer: true,
          enabledGuest: false,
          mode: 'production',
          logLevel: 'info',
          displayTitle: null,
          fabIconUrl: null,
          providerType: 'openai',
          model: 'gpt-4',
          apiBaseUrl: null,
          apiKey: null,
          testApiKey: null,
          maxTokens: 2000,
          temperature: 0.7,
          contextWindow: 10,
          timeout: 30000,
          adminMaxResponseLength: 2000,
          adminEnableSuggestions: true,
          adminEnableQuickActions: true,
          adminDetailLevel: 'detailed',
          customerMaxResponseLength: 1500,
          customerEnableSuggestions: true,
          customerEnableQuickActions: true,
          customerTone: 'friendly',
          customerEnableRecommendations: true,
          customerEnableContextHelp: true,
          rateLimitAdmin: config.rateLimit.defaultMax,
          rateLimitCustomer: config.rateLimit.defaultMax,
          rateLimitGuest: config.rateLimit.defaultMax,
          blockOnLimitExceeded: true,
          filterContent: true,
          checkPermissions: true,
          logAllRequests: true,
          anonymizeLogs: false,
          enableCache: true,
          cacheTTL: 3600,
          cacheFrequentQueries: true,
          maxCacheSize: 100,
          ragEnabled: false,
          ragEmbeddingModel: config.rag.embeddingModel,
          sttProvider: 'none',
          updatedAt: new Date(),
          updatedBy: null,
        } as any;
      }

      // Don't send API keys in response (security)
      const { apiKey, testApiKey, ...safeSettings } = settings as any;
      res.json({
        ...safeSettings,
        apiKey: apiKey ? '***hidden***' : undefined,
        testApiKey: testApiKey ? '***hidden***' : undefined,
      });
    } catch (error) {
      console.error('Get GPT Assistant settings error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get settings',
      });
    }
  }

  /**
   * Update GPT Assistant settings
   */
  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const updateData = { ...req.body } as Record<string, unknown>;

      // Don't update API keys if they're hidden
      if (updateData.apiKey === '***hidden***') {
        delete updateData.apiKey;
      }
      if (updateData.testApiKey === '***hidden***') {
        delete updateData.testApiKey;
      }

      // Don't send id/updatedAt to Prisma update (id is key; updatedAt is auto)
      delete updateData.id;
      delete updateData.updatedAt;

      // Legacy tuning fields are persisted in schema for backward compatibility,
      // but are no longer user-configurable and should not affect runtime behavior.
      delete updateData.maxTokens;
      delete updateData.temperature;
      delete updateData.contextWindow;

      if (updateData.ragEnabled !== undefined) {
        updateData.ragEnabled = Boolean(updateData.ragEnabled);
      }

      if (updateData.ragEmbeddingModel !== undefined) {
        const ragEmbeddingModel = String(updateData.ragEmbeddingModel || '').trim();
        if (!ragEmbeddingModel) {
          res.status(400).json({ error: 'RAG embedding model is required when RAG settings are updated' });
          return;
        }
        updateData.ragEmbeddingModel = ragEmbeddingModel;
      }

      let settings = await prisma.gPTAssistantSettings.findFirst();
      const existingDecrypted = decryptGptAssistantSecrets(settings);

      if (updateData.providerType !== undefined) {
        if (!isAllowedGptProviderType(updateData.providerType)) {
          res.status(400).json({
            error: `Invalid provider type. Allowed: ${ALLOWED_GPT_PROVIDER_TYPES.join(', ')}`,
          });
          return;
        }
        updateData.providerType = String(updateData.providerType).toLowerCase();
      }

      if (updateData.sttProvider !== undefined) {
        if (!isAllowedSttProviderType(updateData.sttProvider)) {
          res.status(400).json({
            error: `Invalid STT provider. Allowed: ${ALLOWED_STT_PROVIDER_TYPES.join(', ')}`,
          });
          return;
        }
        updateData.sttProvider = String(updateData.sttProvider).toLowerCase();
      }

      if (updateData.apiBaseUrl !== undefined) {
        const norm = normalizeApiBaseUrlInput(updateData.apiBaseUrl);
        if (!norm.ok) {
          res.status(400).json({ error: norm.error });
          return;
        }
        updateData.apiBaseUrl = norm.value;
      }

      const nextProvider = String(
        updateData.providerType ?? existingDecrypted?.providerType ?? 'openai'
      ).toLowerCase();
      const nextBase =
        updateData.apiBaseUrl !== undefined
          ? (updateData.apiBaseUrl as string | null)
          : (existingDecrypted?.apiBaseUrl ?? null);

      const endpointRules = validateGptProviderEndpointRules(nextProvider, nextBase);
      if (!endpointRules.ok) {
        res.status(400).json({ error: endpointRules.error });
        return;
      }

      const prismaData = encryptGptAssistantSecrets({
        ...updateData,
        updatedBy: req.user.userId,
      } as Record<string, unknown>);
      // Visibility flags: use body when present so unchecking (false) is persisted
      if (typeof req.body.enabledAdmin === 'boolean') {
        prismaData.enabledAdmin = req.body.enabledAdmin;
      } else if (req.body.enabledAdmin !== undefined) {
        prismaData.enabledAdmin = Boolean(req.body.enabledAdmin);
      }
      if (typeof req.body.enabledCustomer === 'boolean') {
        prismaData.enabledCustomer = req.body.enabledCustomer;
      } else if (req.body.enabledCustomer !== undefined) {
        prismaData.enabledCustomer = Boolean(req.body.enabledCustomer);
      }
      if (typeof req.body.enabledGuest === 'boolean') {
        prismaData.enabledGuest = req.body.enabledGuest;
      } else if (req.body.enabledGuest !== undefined) {
        prismaData.enabledGuest = Boolean(req.body.enabledGuest);
      }
      if (!settings) {
        if (prismaData.enabledAdmin === undefined) prismaData.enabledAdmin = true;
        if (prismaData.enabledCustomer === undefined) prismaData.enabledCustomer = true;
        if (prismaData.enabledGuest === undefined) prismaData.enabledGuest = false;
        if (prismaData.ragEnabled === undefined) prismaData.ragEnabled = false;
        if (prismaData.ragEmbeddingModel === undefined) {
          prismaData.ragEmbeddingModel = config.rag.embeddingModel;
        }
      }

      if (settings) {
        settings = await prisma.gPTAssistantSettings.update({
          where: { id: settings.id },
          data: prismaData as any,
        });
      } else {
        settings = await prisma.gPTAssistantSettings.create({
          data: prismaData as any,
        });
      }

      const settingsDecrypted = decryptGptAssistantSecrets(settings);
      if (settingsDecrypted) {
        const cfg = resolveGptClientConfig(settingsDecrypted as GptAssistantSettingsLike);
        if (cfg) {
          gptApiService.ensureClient(cfg);
        }
      }

      const { apiKey, testApiKey, ...safeSettings } = settings as any;
      const visibility = {
        enabledAdmin: Boolean(safeSettings.enabledAdmin),
        enabledCustomer: Boolean(safeSettings.enabledCustomer),
        enabledGuest: Boolean(safeSettings.enabledGuest),
      };
      res.json({
        ...safeSettings,
        ...visibility,
        apiKey: apiKey ? '***hidden***' : undefined,
        testApiKey: testApiKey ? '***hidden***' : undefined,
      });
    } catch (error) {
      console.error('Update GPT Assistant settings error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update settings',
      });
    }
  }

  /**
   * Get prompts
   */
  async getPrompts(req: Request, res: Response): Promise<void> {
    try {
      await ensureDefaultQuickPrompts();

      const type = req.query.type as string | undefined;
      
      const where: any = {};
      if (type) {
        where.type = type;
      }

      const prompts = await prisma.gPTAssistantPrompt.findMany({
        where,
        orderBy: type === 'quick_admin' || type === 'quick_customer'
          ? [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
          : [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      res.json(prompts);
    } catch (error) {
      console.error('Get prompts error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get prompts',
      });
    }
  }

  /**
   * Get single prompt
   */
  async getPrompt(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const prompt = await prisma.gPTAssistantPrompt.findUnique({
        where: { id },
      });

      if (!prompt) {
        res.status(404).json({ error: 'Prompt not found' });
        return;
      }

      res.json(prompt);
    } catch (error) {
      console.error('Get prompt error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get prompt',
      });
    }
  }

  /**
   * Create prompt
   */
  async createPrompt(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { type, prompt, version, comment, sortOrder } = req.body;

      // For quick_admin/quick_customer ensure unique version (schema has @@unique([type, version]))
      const isQuick = type === 'quick_admin' || type === 'quick_customer';
      const resolvedVersion = isQuick ? (version || `v_${Date.now()}`) : (version || '1.0');

      const newPrompt = await prisma.gPTAssistantPrompt.create({
        data: {
          type,
          prompt,
          version: resolvedVersion,
          comment,
          sortOrder: sortOrder != null ? Number(sortOrder) : 0,
          createdBy: req.user.userId,
        },
      });

      res.json(newPrompt);
    } catch (error) {
      console.error('Create prompt error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create prompt',
      });
    }
  }

  /**
   * Update prompt
   */
  async updatePrompt(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { prompt, version, comment, isActive, sortOrder } = req.body;

      const updatedPrompt = await prisma.gPTAssistantPrompt.update({
        where: { id },
        data: {
          ...(prompt !== undefined && { prompt }),
          ...(version !== undefined && { version }),
          ...(comment !== undefined && { comment }),
          ...(isActive !== undefined && { isActive }),
          ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        },
      });

      res.json(updatedPrompt);
    } catch (error) {
      console.error('Update prompt error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update prompt',
      });
    }
  }

  async deletePrompt(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const existing = await prisma.gPTAssistantPrompt.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Prompt not found' });
        return;
      }

      await prisma.gPTAssistantPrompt.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      console.error('Delete prompt error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete prompt',
      });
    }
  }

  /**
   * Get analytics
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.start as string | undefined;
      const endDate = req.query.end as string | undefined;

      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Get stats from admin and customer chat history
      const [adminHistory, customerHistory] = await Promise.all([
        prisma.adminAssistantChatHistory.findMany({ where }),
        prisma.customerAssistantChatHistory.findMany({ where }),
      ]);

      const totalRequests = adminHistory.length + customerHistory.length;
      const successfulRequests = adminHistory.filter(h => h.intent !== 'UNKNOWN').length +
        customerHistory.filter(h => h.intent !== 'UNKNOWN').length;

      // Calculate average execution time
      const allExecutionTimes = [
        ...adminHistory.map(h => h.executionTime),
        ...customerHistory.map(h => h.executionTime),
      ];
      const avgExecutionTime = allExecutionTimes.length > 0
        ? Math.round(allExecutionTimes.reduce((a, b) => a + b, 0) / allExecutionTimes.length)
        : 0;

      // Group by intent
      const intentStats: Record<string, number> = {};
      [...adminHistory, ...customerHistory].forEach(h => {
        intentStats[h.intent] = (intentStats[h.intent] || 0) + 1;
      });

      res.json({
        totalRequests,
        successfulRequests,
        failedRequests: totalRequests - successfulRequests,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
        avgExecutionTime,
        adminRequests: adminHistory.length,
        customerRequests: customerHistory.length,
        guestRequests: customerHistory.filter(h => !h.userId).length,
        intentStats,
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get analytics',
      });
    }
  }

  /**
   * Get logs
   */
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const userType = req.query.userType as string | undefined;
      const intent = req.query.intent as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (intent) where.intent = intent;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      let logs: any[] = [];
      let total = 0;

      if (userType === 'admin' || !userType) {
        const adminLogs = await prisma.adminAssistantChatHistory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
        const adminTotal = await prisma.adminAssistantChatHistory.count({ where });
        logs = [...logs, ...adminLogs.map(l => ({ ...l, userType: 'admin' }))];
        total += adminTotal;
      }

      if (userType === 'customer' || !userType) {
        const customerWhere = { ...where };
        if (userType === 'customer') {
          customerWhere.userId = { not: null };
        }
        const customerLogs = await prisma.customerAssistantChatHistory.findMany({
          where: customerWhere,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
        const customerTotal = await prisma.customerAssistantChatHistory.count({ where: customerWhere });
        logs = [...logs, ...customerLogs.map(l => ({ ...l, userType: l.userId ? 'customer' : 'guest' }))];
        total += customerTotal;
      }

      // Sort by createdAt desc
      logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({
        logs: logs.slice(0, limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('Get logs error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get logs',
      });
    }
  }

  /**
   * List models from OpenAI-compatible GET /v1/models (saved key + optional body overrides for unsaved form).
   */
  async discoverModels(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = req.body as { apiBaseUrl?: string; providerType?: string };
      const saved = decryptGptAssistantSecrets(await prisma.gPTAssistantSettings.findFirst());

      let providerType = String(body.providerType ?? saved?.providerType ?? 'openai').toLowerCase();
      if (body.providerType !== undefined) {
        if (!isAllowedGptProviderType(body.providerType)) {
          res.status(400).json({
            error: `Invalid provider type. Allowed: ${ALLOWED_GPT_PROVIDER_TYPES.join(', ')}`,
          });
          return;
        }
        providerType = String(body.providerType).toLowerCase();
      }

      let apiBaseUrl: string | null;
      if (body.apiBaseUrl !== undefined) {
        const norm = normalizeApiBaseUrlInput(body.apiBaseUrl);
        if (!norm.ok) {
          res.status(400).json({ error: norm.error });
          return;
        }
        apiBaseUrl = norm.value;
      } else {
        apiBaseUrl = saved?.apiBaseUrl ?? null;
      }

      const merged: GptAssistantSettingsLike = {
        providerType,
        mode: (saved?.mode as string) || 'production',
        apiKey: saved?.apiKey ?? null,
        testApiKey: saved?.testApiKey ?? null,
        apiBaseUrl,
      };

      const rules = validateGptProviderEndpointRules(providerType, apiBaseUrl);
      if (!rules.ok) {
        res.status(400).json({ error: rules.error });
        return;
      }

      const cfg = resolveGptClientConfig(merged);
      if (!cfg) {
        res.status(400).json({
          error: 'API key not configured. For OpenAI/Anthropic save a key first, or choose LM Studio.',
        });
        return;
      }
      const models = await gptApiService.listModelIds(cfg);
      res.json({ models });
    } catch (error) {
      console.error('Discover models error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list models',
      });
    }
  }

  /**
   * Test connection to GPT API
   */
  async testConnection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const saved = decryptGptAssistantSecrets(await prisma.gPTAssistantSettings.findFirst());
      const body = req.body as Partial<GptAssistantSettingsLike> & { model?: string };

      let providerType = String(body.providerType ?? saved?.providerType ?? 'openai').toLowerCase();
      if (body.providerType !== undefined) {
        if (!isAllowedGptProviderType(body.providerType)) {
          res.status(400).json({
            error: `Invalid provider type. Allowed: ${ALLOWED_GPT_PROVIDER_TYPES.join(', ')}`,
          });
          return;
        }
        providerType = String(body.providerType).toLowerCase();
      }

      let apiBaseUrl: string | null;
      if (body.apiBaseUrl !== undefined) {
        const norm = normalizeApiBaseUrlInput(body.apiBaseUrl);
        if (!norm.ok) {
          res.status(400).json({ error: norm.error });
          return;
        }
        apiBaseUrl = norm.value;
      } else {
        apiBaseUrl = saved?.apiBaseUrl ?? null;
      }

      const mode = String(body.mode ?? saved?.mode ?? 'production');
      const merged: GptAssistantSettingsLike = {
        providerType,
        apiBaseUrl,
        mode,
        apiKey: body.apiKey !== undefined ? body.apiKey : (saved?.apiKey ?? null),
        testApiKey: body.testApiKey !== undefined ? body.testApiKey : (saved?.testApiKey ?? null),
      };

      const rules = validateGptProviderEndpointRules(providerType, apiBaseUrl);
      if (!rules.ok) {
        res.status(400).json({ error: rules.error });
        return;
      }

      const cfg = resolveGptClientConfig(merged);
      if (!cfg) {
        res.status(400).json({ error: 'API key not configured' });
        return;
      }

      gptApiService.ensureClient(cfg);
      const testModel = String(body.model ?? saved?.model ?? '').trim() || 'gpt-4o-mini';
      const testResponse = await gptApiService.chatCompletion(
        [
          {
            role: 'user',
            content: 'Reply with exactly: OK',
            timestamp: new Date(),
          },
        ],
        { model: testModel, maxTokens: 16 }
      );

      res.json({
        success: true,
        message: 'Connection successful',
        response: testResponse?.trim() || 'OK',
        testModel,
      });
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }

  /**
   * Test chat functionality
   */
  async testChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { message, userType } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Import GPT Assistant Service
      const { gptAssistantService } = await import('../services/gpt-assistant.service');

      const response = await gptAssistantService.processRequest(
        req.user?.userId || null,
        userType || 'admin',
        message,
        {}
      );

      res.json(response);
    } catch (error) {
      console.error('Test chat error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to test chat',
      });
    }
  }
}

export const gptAssistantSettingsController = new GPTAssistantSettingsController();
