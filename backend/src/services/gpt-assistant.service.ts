import prisma from '../config/database';
import { config } from '../config/env';
import { gptApiService, resolveGptClientConfig } from './gpt-api.service';
import { intentRecognitionService } from './intent-recognition.service';
import {
  AssistantResponse,
  Intent,
  IntentType,
  UserType,
  ChatMessage,
  ASSISTANT_UNAVAILABLE_MESSAGE,
} from '../types/gpt-assistant';
import { actionExecutorService } from './action-executor.service';
import { responseGeneratorService } from './response-generator.service';
import { permissionCheckerService } from './permission-checker.service';
import { gptCacheService } from './gpt-cache.service';
import { decryptGptAssistantSecrets } from '../utils/crypto';
import { ragService } from './rag.service';
import { aiConversationService } from './ai-conversation.service';

export class GPTAssistantService {
  /**
   * Process request from user (admin or customer)
   */
  async processRequest(
    userId: string | null,
    userType: UserType,
    message: string,
    context?: {
      previousMessages?: ChatMessage[];
      currentPage?: string;
      sessionId?: string;
    }
  ): Promise<AssistantResponse> {
    const startTime = Date.now();
    const responseLanguage = this.detectResponseLanguage(message);

    try {
      // Load settings
      const settings = await this.getSettings();
      const normalizedUserType = userType === 'guest' ? 'customer' : userType;
      const finalize = async (
        assistantResponse: AssistantResponse,
        intentForLog: Intent,
        isError: boolean = false
      ): Promise<AssistantResponse> => {
        if (settings.logAllRequests) {
          await this.logAction(
            userId,
            normalizedUserType,
            message,
            assistantResponse,
            intentForLog,
            assistantResponse.executionTime,
            context?.sessionId,
            context?.currentPage,
            isError
          );
        }

        return assistantResponse;
      };
      
      // Check if assistant is enabled for this user type
      if (!this.isEnabledForUserType(settings, userType)) {
        throw new Error(`GPT Assistant is not enabled for ${userType}`);
      }

      const routingMode = await ragService.getRoutingMode(userType);
      if (routingMode !== 'action_only') {
        console.log(`[RAG] Routing mode selected for ${userType}: ${routingMode}`);
      }

      // Check cache for frequent queries (if enabled)
      if (settings.enableCache && settings.cacheFrequentQueries) {
        const cacheKey = {
          message,
          userType,
          currentPage: context?.currentPage,
        };
        const cachedResponse = gptCacheService.get(message, userType === 'guest' ? 'customer' : userType, cacheKey);
        if (cachedResponse) {
          return finalize({
            ...cachedResponse,
            executionTime: Date.now() - startTime,
            cached: true,
          } as AssistantResponse & { cached: boolean }, {
            type: (cachedResponse.intent as IntentType) || IntentType.HELP,
            confidence: 1,
            params: {},
          });
        }
      }

      const gptCfg = resolveGptClientConfig(settings);
      if (gptCfg) {
        gptApiService.ensureClient(gptCfg);
      }

      const quickIntent = this.getQuickIntentOverride(message, normalizedUserType, context?.previousMessages);
      if (quickIntent) {
        const result = await actionExecutorService.execute(quickIntent, userType, userId, context);
        const response = await responseGeneratorService.generateResponse(
          result,
          quickIntent,
          normalizedUserType,
          settings,
          context?.previousMessages,
          responseLanguage
        );
        return finalize({
          response: response.response,
          intent: quickIntent.type,
          data: result,
          suggestions: response.suggestions,
          executionTime: Date.now() - startTime,
        }, quickIntent);
      }

      const quickResponse = this.getQuickResponse(
        message,
        normalizedUserType,
        context?.previousMessages
      );
      if (quickResponse) {
        const executionTime = Date.now() - startTime;
        return finalize({
          response: this.localizeQuickResponse(quickResponse.response, responseLanguage),
          intent: quickResponse.intent,
          suggestions: quickResponse.suggestions,
          executionTime,
        }, {
          type: quickResponse.intent,
          confidence: 1,
          params: {},
        });
      }

      // Recognize intent using GPT
      const intent = await intentRecognitionService.recognizeIntent(message, normalizedUserType, {
        previousMessages: context?.previousMessages,
        currentPage: context?.currentPage,
      });

      // When intent is UNKNOWN (e.g. model unavailable or could not determine intent), return friendly message without calling execute
      if (intent.type === IntentType.UNKNOWN) {
        return finalize({
          response: this.getUnsupportedTaskMessage(responseLanguage, normalizedUserType),
          intent: IntentType.UNKNOWN,
          suggestions: this.getUnsupportedTaskSuggestions(responseLanguage, normalizedUserType),
          executionTime: Date.now() - startTime,
        }, intent, true);
      }

      // Check permissions (for admins)
      if (userType === 'admin' && userId) {
        const hasPermission = await permissionCheckerService.checkPermission(userId, intent.type);
        if (!hasPermission) {
          const errorMessage = permissionCheckerService.getMissingPermissionMessage(intent.type, responseLanguage);
          return finalize({
            response: errorMessage || 'You do not have permission to perform this action.',
            intent: IntentType.UNKNOWN,
            executionTime: Date.now() - startTime,
          }, intent, true);
        }
      }

      // Execute action
      const result = await actionExecutorService.execute(intent, userType, userId, context);

      // Generate response using GPT
      const response = await responseGeneratorService.generateResponse(
        result,
        intent,
        userType === 'guest' ? 'customer' : userType,
        settings,
        context?.previousMessages,
        responseLanguage
      );

      const executionTime = Date.now() - startTime;

      const assistantResponse: AssistantResponse = {
        response: response.response,
        intent: intent.type,
        data: result,
        suggestions: response.suggestions,
        executionTime,
      };

      // Cache response for frequent queries (if enabled)
      if (settings.enableCache && settings.cacheFrequentQueries) {
        const cacheKey = {
          message,
          userType,
          currentPage: context?.currentPage,
        };
        // Cache only read-only operations (searches, views)
        const isReadOnly = this.isReadOnlyIntent(intent.type);
        if (isReadOnly) {
          const cacheTTL = (settings.cacheTTL || 300) * 1000; // Convert seconds to milliseconds
          gptCacheService.set(message, userType === 'guest' ? 'customer' : userType, assistantResponse, cacheTTL, cacheKey);
        }
      }

      return finalize(assistantResponse, intent);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const normalizedUserType = userType === 'guest' ? 'customer' : userType;
      console.error('GPT Assistant error:', error);
      const rawMessage = error instanceof Error ? error.message : 'An error occurred while processing the request.';
      // Replace technical "Action not implemented for intent: UNKNOWN" with user-friendly message
      const response =
        rawMessage.includes('Action not implemented for intent: UNKNOWN') ||
        rawMessage === ASSISTANT_UNAVAILABLE_MESSAGE
          ? this.getUnsupportedTaskMessage(responseLanguage, normalizedUserType)
          : rawMessage;
      return {
        response,
        intent: IntentType.UNKNOWN,
        suggestions: this.getUnsupportedTaskSuggestions(responseLanguage, normalizedUserType),
        executionTime,
      };
    }
  }

  private getQuickResponse(
    message: string,
    userType: Exclude<UserType, 'guest'> | UserType,
    _previousMessages?: ChatMessage[]
  ): { response: string; intent: IntentType; suggestions?: string[] } | null {
    const normalized = message.trim().toLowerCase();
    if (!normalized) return null;

    const isGreeting =
      normalized === 'hi' ||
      normalized === 'hello' ||
      normalized === 'hey' ||
      normalized === 'yo' ||
      normalized === 'ping' ||
      normalized === 'привет' ||
      normalized === 'здравствуйте' ||
      normalized === 'здарова' ||
      normalized === 'салют' ||
      normalized === 'добрый день' ||
      normalized === 'доброе утро' ||
      normalized === 'добрый вечер';

    if (!isGreeting) {
      const normalizedCompact = normalized.replace(/\s+/g, ' ');
      const wantsWarehouseCreate =
        normalizedCompact.includes('create warehouse') ||
        normalizedCompact.includes('create warehouse') ||
        normalizedCompact.includes('add warehouse') ||
        normalizedCompact.includes('add warehouse');

      if (userType === 'admin' && wantsWarehouseCreate) {
        return {
          response:
            'I can help create a warehouse, but I need more details. Write one phrase, for example: "create warehouse MILAN MAIN" or "create warehouse Main, city Moscow, type MAIN".',
          intent: IntentType.HELP,
          suggestions: ['create warehouse Main MAIN', 'create warehouse Moscow STORE', 'show warehouses'],
        };
      }

      return null;
    }

    if (userType === 'admin') {
      return {
        response: 'I am here. I can help with products, orders, customers, warehouse and settings.',
        intent: IntentType.HELP,
        suggestions: ['Show orders', 'Find a product', 'Open analytics'],
      };
    }

    return {
      response: 'I am here. I can help with products, delivery, payment and orders.',
      intent: IntentType.HELP,
      suggestions: ['Show catalog', 'Delivery', 'Where is my order'],
    };
  }

  private detectResponseLanguage(message: string): 'ru' | 'en' | 'zh' {
    if (/[\u4E00-\u9FFF]/.test(message)) {
      return 'zh';
    }
    if (/[А-Яа-яЁё]/.test(message)) {
      return 'ru';
    }
    return 'en';
  }

  private getAssistantUnavailableMessage(language: 'ru' | 'en' | 'zh'): string {
    if (language === 'ru') {
      return 'The assistant is not available at the moment. Please try again later.';
    }
    if (language === 'zh') {
      return 'The assistant is not available at the moment. Please try again later.';
    }
    return ASSISTANT_UNAVAILABLE_MESSAGE;
  }

  private getUnsupportedTaskMessage(
    language: 'ru' | 'en' | 'zh',
    userType: Exclude<UserType, 'guest'> | UserType
  ): string {
    if (userType === 'admin') {
      if (language === 'ru') {
        return 'С этой задачей пока не помогу, но ассистент работает. Я могу помочь с товарами, заказами, клиентами, складом, контентом, промокодами и настройками.';
      }
      if (language === 'zh') {
        return 'I cannot help with this task yet, but the assistant is working. I can help with products, orders, customers, warehouse, content, promo codes, and settings.';
      }
      return 'I cannot help with this task yet, but the assistant is working. I can help with products, orders, customers, warehouse, content, promo codes, and settings.';
    }

    if (language === 'ru') {
      return 'С этой задачей пока не помогу, но ассистент работает. Я могу помочь с товарами, доставкой, оплатой и заказами.';
    }
    if (language === 'zh') {
      return 'I cannot help with this task yet, but the assistant is working. I can help with products, delivery, payment, and orders.';
    }
    return 'I cannot help with this task yet, but the assistant is working. I can help with products, delivery, payment, and orders.';
  }

  private getUnsupportedTaskSuggestions(
    language: 'ru' | 'en' | 'zh',
    userType: Exclude<UserType, 'guest'> | UserType
  ): string[] {
    if (userType === 'admin') {
      if (language === 'ru') {
        return ['Покажи заказы', 'Найди товар', 'Создай промокод'];
      }
      return ['Show orders', 'Find a product', 'Create a promo code'];
    }

    if (language === 'ru') {
      return ['Показать каталог', 'Доставка', 'Где мой заказ'];
    }
    return ['Show catalog', 'Delivery', 'Where is my order'];
  }

  private localizeQuickResponse(message: string, language: 'ru' | 'en' | 'zh'): string {
    if (language === 'en') {
      if (message === 'На связи. Могу помочь с товарами, заказами, клиентами, складом и настройками.') {
        return 'I am here. I can help with products, orders, customers, warehouse, and settings.';
      }
      if (message === 'На связи. Могу помочь с товарами, доставкой, оплатой и заказами.') {
        return 'I am here. I can help with products, delivery, payment, and orders.';
      }
      if (message.startsWith('Могу помочь создать склад')) {
        return 'I can help create a warehouse, but I still need more details. Send one phrase, for example: "create warehouse Moscow MAIN" or "create warehouse Main, city Moscow, type MAIN".';
      }
    }
    return message;
  }

  private getQuickIntentOverride(
    message: string,
    userType: Exclude<UserType, 'guest'> | UserType,
    previousMessages?: ChatMessage[]
  ): Intent | null {
    if (userType !== 'admin') {
      return null;
    }

    const normalized = message.trim().toLowerCase().replace(/\s+/g, ' ');
    const recentThread = (previousMessages || []).map(m => m.content.toLowerCase()).join(' \n ');
    const isEmailFollowup =
      (normalized.includes('что обнов') ||
        normalized.includes('что измен') ||
        normalized.includes('что настро') ||
        normalized.includes('покажи настройки почты')) &&
      (recentThread.includes('почт') || recentThread.includes('email'));

    if (isEmailFollowup) {
      return {
        type: IntentType.EMAIL_SERVICE_VIEW,
        confidence: 0.95,
        params: {},
      };
    }

    return null;
  }





  /**
   * Log action to database
   */
  private async logAction(
    userId: string | null,
    userType: UserType,
    message: string,
    response: Omit<AssistantResponse, 'executionTime'>,
    intent: Intent,
    executionTime: number,
    sessionId?: string,
    currentPage?: string,
    isError: boolean = false
  ): Promise<void> {
    try {
      if (userType === 'admin' && userId) {
        await prisma.adminAssistantChatHistory.create({
          data: {
            adminId: userId,
            message,
            response: response.response,
            intent: intent.type,
            data: response.data || {},
            executionTime,
          },
        });
      } else {
        await prisma.customerAssistantChatHistory.create({
          data: {
            userId: userId || null,
            sessionId: sessionId || null,
            message,
            response: response.response,
            intent: intent.type,
            data: response.data || {},
            executionTime,
          },
        });
      }

      await aiConversationService.recordInteraction({
        userId,
        userType,
        sessionId,
        message,
        response: response.response,
        intent,
        executionTime,
        data: response.data,
        currentPage,
        isError,
      });
    } catch (error) {
      console.error('Failed to log assistant action:', error);
    }
  }

  /**
   * Get settings from database
   */
  private async getSettings(): Promise<any> {
    const raw = await prisma.gPTAssistantSettings.findFirst();
    const settings = decryptGptAssistantSecrets(raw);

    if (!settings) {
      // Return default settings
      return {
        enabledAdmin: true,
        enabledCustomer: true,
        enabledGuest: false,
        mode: 'production',
        logLevel: 'info',
        providerType: 'openai',
        model: 'gpt-4',
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
      };
    }

    return settings;
  }

  /**
   * Check if assistant is enabled for user type
   */
  private isEnabledForUserType(settings: any, userType: UserType): boolean {
    switch (userType) {
      case 'admin':
        return settings.enabledAdmin;
      case 'customer':
        return settings.enabledCustomer;
      case 'guest':
        return settings.enabledGuest;
      default:
        return false;
    }
  }

  /**
   * Check if intent is read-only (safe to cache)
   */
  private isReadOnlyIntent(intentType: IntentType): boolean {
    const readOnlyIntents = [
      IntentType.PRODUCT_SEARCH,
      IntentType.ORDER_SEARCH,
      IntentType.ORDER_VIEW,
      IntentType.CUSTOMER_SEARCH,
      IntentType.CUSTOMER_VIEW,
      IntentType.CUSTOMER_NOTE_VIEW,
      IntentType.INVENTORY_VIEW,
      IntentType.ANALYTICS_VIEW,
      IntentType.REPORT_GENERATE,
      IntentType.MARKETING_ADVICE,
      IntentType.LOOKBOOK_VIEW,
      IntentType.PAGE_VIEW,
      IntentType.BLOG_POST_VIEW,
      IntentType.PROMO_CODE_VIEW,
      IntentType.PROMO_CODE_STATS,
      IntentType.RETURN_REQUEST_VIEW,
      IntentType.PAYMENT_GATEWAY_VIEW,
      IntentType.DELIVERY_SERVICE_VIEW,
      IntentType.EMAIL_SERVICE_VIEW,
      IntentType.OAUTH_PROVIDER_VIEW,
      IntentType.CUSTOMER_PRODUCT_SEARCH,
      IntentType.CUSTOMER_PRODUCT_INFO,
      IntentType.CUSTOMER_PRODUCT_RECOMMENDATIONS,
      IntentType.CUSTOMER_ORDER_TRACK,
      IntentType.CUSTOMER_ORDER_VIEW,
      IntentType.CUSTOMER_ORDER_HISTORY,
      IntentType.CUSTOMER_CART_VIEW,
      IntentType.CUSTOMER_WISHLIST_VIEW,
      IntentType.CUSTOMER_DELIVERY_INFO,
      IntentType.CUSTOMER_PAYMENT_INFO,
      IntentType.CUSTOMER_STORE_INFO,
      IntentType.HELP,
    ];

    return readOnlyIntents.includes(intentType);
  }
}

export const gptAssistantService = new GPTAssistantService();
