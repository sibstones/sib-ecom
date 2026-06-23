import { gptApiService } from './gpt-api.service';
import { Intent, IntentType, UserType, ChatMessage } from '../types/gpt-assistant';
import { gptCacheService } from './gpt-cache.service';
import prisma from '../config/database';

export class IntentRecognitionService {
  /**
   * Recognize intent from user message using GPT
   */
  async recognizeIntent(
    message: string,
    userType: UserType,
    context?: {
      previousMessages?: ChatMessage[];
      currentPage?: string;
    }
  ): Promise<Intent> {
    try {
      const deterministicIntent = this.deterministicIntentRecognition(message, userType);
      if (deterministicIntent) {
        return deterministicIntent;
      }

      // Check cache first (for simple queries without context)
      if (!context?.previousMessages || context.previousMessages.length === 0) {
        const cacheKey = `intent:${message}:${userType}`;
        const cacheUserType = userType === 'guest' ? 'customer' : userType;
        const cachedIntent = gptCacheService.get(cacheKey, cacheUserType);
        if (cachedIntent) {
          return cachedIntent;
        }
      }

      // Get system prompt for intent recognition
      const systemPrompt = await this.getIntentRecognitionPrompt(userType);

      // Build messages for GPT
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
          timestamp: new Date(),
        },
        {
          role: 'user',
          content: message,
          timestamp: new Date(),
        },
      ];

      // Add context if available
      if (context?.previousMessages && context.previousMessages.length > 0) {
        // Add last few messages for context
        const recentMessages = context.previousMessages.slice(-3);
        messages.splice(1, 0, ...recentMessages);
      }

      // Get settings for model configuration
      const settings = await prisma.gPTAssistantSettings.findFirst();
      const model = settings?.model || 'gpt-4';

      // Call GPT API
      const response = await gptApiService.chatCompletion(messages, {
        model,
        maxTokens: 500,
        temperature: 0.3, // Lower temperature for more consistent intent recognition
      });

      // Parse response to extract intent (fallback keywords must use user text, not model output)
      const intent = this.parseIntentResponse(response, message, userType);

      // Cache intent for simple queries (without context)
      if (!context?.previousMessages || context.previousMessages.length === 0) {
        const cacheKey = `intent:${message}:${userType}`;
        const cacheUserType = userType === 'guest' ? 'customer' : userType;
        gptCacheService.set(cacheKey, cacheUserType, intent, 10 * 60 * 1000); // Cache for 10 minutes
      }

      return intent;
    } catch (error) {
      console.error('Intent recognition error:', error);
      // Fallback to keyword-based recognition
      return this.fallbackIntentRecognition(message, userType);
    }
  }

  /**
   * Parse GPT response to extract intent
   */
  private parseIntentResponse(
    response: string,
    userMessage: string,
    userType: UserType
  ): Intent {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const rawIntent = parsed.intent as string | undefined;
        const intentType =
          rawIntent && Object.values(IntentType).includes(rawIntent as IntentType)
            ? (rawIntent as IntentType)
            : IntentType.UNKNOWN;
        if (intentType !== IntentType.UNKNOWN) {
          return {
            type: intentType,
            confidence: parsed.confidence || 0.8,
            params: parsed.params || {},
          };
        }
        return this.fallbackIntentRecognition(userMessage, userType);
      }

      // Try to extract intent from text
      const intentMatch = response.match(/intent[:\s]+([A-Z_]+)/i);
      if (intentMatch) {
        const intentType = intentMatch[1] as IntentType;
        if (Object.values(IntentType).includes(intentType)) {
          return {
            type: intentType,
            confidence: 0.7,
            params: this.extractParamsFromText(response),
          };
        }
      }

      return this.fallbackIntentRecognition(userMessage, userType);
    } catch (error) {
      console.error('Parse intent response error:', error);
      return this.fallbackIntentRecognition(userMessage, userType);
    }
  }

  /**
   * Extract parameters from text response
   */
  private extractParamsFromText(text: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract common parameters
    const skuMatch = text.match(/sku[:\s]+([A-Z0-9-]+)/i);
    if (skuMatch) params.sku = skuMatch[1];

    const orderMatch = text.match(/order[#:\s]+([A-Z0-9-]+)/i);
    if (orderMatch) params.orderNumber = orderMatch[1];

    const emailMatch = text.match(/email[:\s]+([\w.-]+@[\w.-]+\.\w+)/i);
    if (emailMatch) params.email = emailMatch[1];

    const priceMatch = text.match(/price[:\s]+(\d+)/i);
    if (priceMatch) params.price = parseFloat(priceMatch[1]);

    const quantityMatch = text.match(/quantity[:\s]+(\d+)/i);
    if (quantityMatch) params.quantity = parseInt(quantityMatch[1]);

    return params;
  }

  /**
   * Fallback keyword-based intent recognition
   */
  private fallbackIntentRecognition(message: string, userType: UserType): Intent {
    const lowerMessage = message.toLowerCase();

    const deterministicIntent = this.deterministicIntentRecognition(message, userType);
    if (deterministicIntent) {
      return deterministicIntent;
    }

    // Small talk / ping — local models often return UNKNOWN here; HELP is implemented in action executor
    if (this.looksLikeGreetingOrConnectionCheck(lowerMessage)) {
      return { type: IntentType.HELP, confidence: 0.9, params: { topic: 'ping' } };
    }

    if (userType === 'admin') {
      // Admin intents
      if ((lowerMessage.includes('product') || lowerMessage.includes('product')) && 
          (lowerMessage.includes('show') || lowerMessage.includes('find'))) {
        return { type: IntentType.PRODUCT_SEARCH, confidence: 0.7, params: {} };
      }
      if ((lowerMessage.includes('product') || lowerMessage.includes('product')) &&
          (lowerMessage.includes('show') || lowerMessage.includes('find') || lowerMessage.includes('search'))) {
        return { type: IntentType.PRODUCT_SEARCH, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('create') && lowerMessage.includes('product')) {
        return { type: IntentType.PRODUCT_CREATE, confidence: 0.7, params: {} };
      }
      if ((lowerMessage.includes('create') || lowerMessage.includes('add')) &&
          (lowerMessage.includes('product') || lowerMessage.includes('product'))) {
        return { type: IntentType.PRODUCT_CREATE, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('update') && lowerMessage.includes('product')) {
        return { type: IntentType.PRODUCT_UPDATE, confidence: 0.7, params: {} };
      }
      if ((lowerMessage.includes('update') || lowerMessage.includes('change')) &&
          (lowerMessage.includes('product') || lowerMessage.includes('product'))) {
        return { type: IntentType.PRODUCT_UPDATE, confidence: 0.7, params: {} };
      }
      if ((lowerMessage.includes('order') || lowerMessage.includes('order')) && 
          (lowerMessage.includes('show') || lowerMessage.includes('find'))) {
        return { type: IntentType.ORDER_SEARCH, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('order') &&
          (lowerMessage.includes('show') || lowerMessage.includes('find') || lowerMessage.includes('how many'))) {
        return { type: IntentType.ORDER_SEARCH, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('customer') && (lowerMessage.includes('show') || lowerMessage.includes('find'))) {
        return { type: IntentType.CUSTOMER_SEARCH, confidence: 0.7, params: {} };
      }
      if ((lowerMessage.includes('customer') || lowerMessage.includes('customer')) &&
          (lowerMessage.includes('show') || lowerMessage.includes('find'))) {
        return { type: IntentType.CUSTOMER_SEARCH, confidence: 0.7, params: {} };
      }
      const warehouseCreateParams = this.parseWarehouseCreateParams(lowerMessage, message);
      if (warehouseCreateParams) {
        return { type: IntentType.WAREHOUSE_CREATE, confidence: 0.85, params: warehouseCreateParams };
      }
      if (lowerMessage.includes('warehouse') || lowerMessage.includes('stock')) {
        return { type: IntentType.INVENTORY_VIEW, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('warehouse') || lowerMessage.includes('stock') || lowerMessage.includes('available')) {
        return { type: IntentType.INVENTORY_VIEW, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('add') && (lowerMessage.includes('warehouse') || lowerMessage.includes('product'))) {
        return { type: IntentType.INVENTORY_ADD, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('analytics') || lowerMessage.includes('statistics') || lowerMessage.includes('report')) {
        return { type: IntentType.ANALYTICS_VIEW, confidence: 0.7, params: {} };
      }
      if (
        lowerMessage.includes('marketing') ||
        lowerMessage.includes('sales') ||
        lowerMessage.includes('promotion') ||
        lowerMessage.includes('email') ||
        lowerMessage.includes('promotion') ||
        lowerMessage.includes('marketing') ||
        lowerMessage.includes('increase sales') ||
        lowerMessage.includes('conversion')
      ) {
        return {
          type: IntentType.MARKETING_ADVICE,
          confidence: 0.75,
          params: { originalRequest: message },
        };
      }
    } else {
      // Customer intents
      if (lowerMessage.includes('product') || lowerMessage.includes('buy') || lowerMessage.includes('product')) {
        return { type: IntentType.CUSTOMER_PRODUCT_SEARCH, confidence: 0.7, params: {} };
      }
      const customerOrderNumber = this.extractOrderNumber(message);
      if (
        (lowerMessage.includes('заказ') &&
          (lowerMessage.includes('достав') ||
            lowerMessage.includes('трек') ||
            lowerMessage.includes('отслед') ||
            lowerMessage.includes('статус'))) ||
        lowerMessage.includes('где мой заказ') ||
        lowerMessage.includes('не понимаю статус доставки') ||
        ((lowerMessage.includes('order') || lowerMessage.includes('my order')) &&
          (lowerMessage.includes('delivery') ||
            lowerMessage.includes('track') ||
            lowerMessage.includes('tracking') ||
            lowerMessage.includes('status')))
      ) {
        return {
          type: IntentType.CUSTOMER_ORDER_TRACK,
          confidence: 0.82,
          params: customerOrderNumber ? { orderNumber: customerOrderNumber } : {},
        };
      }
      if ((lowerMessage.includes('order') || lowerMessage.includes('order')) && 
          (lowerMessage.includes('status') || lowerMessage.includes('where') || lowerMessage.includes('status'))) {
        return {
          type: IntentType.CUSTOMER_ORDER_TRACK,
          confidence: 0.7,
          params: customerOrderNumber ? { orderNumber: customerOrderNumber } : {},
        };
      }
      if (lowerMessage.includes('order') && (lowerMessage.includes('show') || lowerMessage.includes('history'))) {
        return { type: IntentType.CUSTOMER_ORDER_HISTORY, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('cart') && (lowerMessage.includes('show') || lowerMessage.includes('history'))) {
        return { type: IntentType.CUSTOMER_CART_VIEW, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('wishlist') && (lowerMessage.includes('show') || lowerMessage.includes('history'))) {
        return { type: IntentType.CUSTOMER_WISHLIST_VIEW, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('delivery') || lowerMessage.includes('delivery')) {
        return { type: IntentType.CUSTOMER_DELIVERY_INFO, confidence: 0.7, params: {} };
      }
      if (lowerMessage.includes('payment') || lowerMessage.includes('payment')) {
        return { type: IntentType.CUSTOMER_PAYMENT_INFO, confidence: 0.7, params: {} };
      }
    }

    // Help intent
    if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('what you can do') ||
      lowerMessage.includes('помоги') ||
      lowerMessage.includes('что ты умеешь') ||
      lowerMessage.includes('что умеешь')
    ) {
      return { type: IntentType.HELP, confidence: 0.8, params: {} };
    }

    return { type: IntentType.HELP, confidence: 0.2, params: {} };
  }

  private deterministicIntentRecognition(message: string, userType: UserType): Intent | null {
    if (userType !== 'admin') {
      return null;
    }

    const trimmed = message.trim();
    const lowerMessage = trimmed.toLowerCase();

    const productPriceUpdate = this.parseProductPriceUpdate(trimmed, lowerMessage);
    if (productPriceUpdate) {
      return productPriceUpdate;
    }

    const orderStatusUpdate = this.parseOrderStatusUpdate(trimmed, lowerMessage);
    if (orderStatusUpdate) {
      return orderStatusUpdate;
    }

    const orderView = this.parseOrderView(trimmed, lowerMessage);
    if (orderView) {
      return orderView;
    }

    const customerNote = this.parseCustomerNoteAdd(trimmed, lowerMessage);
    if (customerNote) {
      return customerNote;
    }

    const customerView = this.parseCustomerView(trimmed, lowerMessage);
    if (customerView) {
      return customerView;
    }

    const ticketRespond = this.parseTicketRespond(trimmed, lowerMessage);
    if (ticketRespond) {
      return ticketRespond;
    }

    const ticketStatus = this.parseTicketStatusUpdate(trimmed, lowerMessage);
    if (ticketStatus) {
      return ticketStatus;
    }

    const ticketView = this.parseTicketView(trimmed, lowerMessage);
    if (ticketView) {
      return ticketView;
    }

    const marketingAdvice = this.parseMarketingAdvice(trimmed, lowerMessage);
    if (marketingAdvice) {
      return marketingAdvice;
    }

    return null;
  }

  private parseMarketingAdvice(message: string, lowerMessage: string): Intent | null {
    const marketingKeywords = [
      'маркетинг',
      'продаж',
      'продава',
      'продвиг',
      'конверси',
      'акци',
      'реклам',
      'рассыл',
      'promotion',
      'promote',
      'marketing',
      'increase sales',
      'sales growth',
      'conversion',
      'campaign',
      'offer',
      'retention',
      'upsell',
      'cross-sell',
      'sell more',
    ];

    if (!marketingKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return null;
    }

    const topic =
      lowerMessage.includes('главн') || lowerMessage.includes('homepage') || lowerMessage.includes('home page')
        ? 'homepage'
        : lowerMessage.includes('контент') || lowerMessage.includes('content')
          ? 'content'
          : lowerMessage.includes('рассыл') || lowerMessage.includes('email') || lowerMessage.includes('sms')
            ? 'retention'
            : lowerMessage.includes('цен') || lowerMessage.includes('price') || lowerMessage.includes('скид')
              ? 'offer'
              : 'sales';

    return {
      type: IntentType.MARKETING_ADVICE,
      confidence: 0.9,
      params: {
        topic,
        originalRequest: message,
      },
    };
  }

  private parseProductPriceUpdate(message: string, lowerMessage: string): Intent | null {
    const priceAction =
      lowerMessage.includes('цен') ||
      lowerMessage.includes('price') ||
      lowerMessage.includes('стоим');
    const updateAction =
      lowerMessage.includes('обнов') ||
      lowerMessage.includes('измени') ||
      lowerMessage.includes('поставь') ||
      lowerMessage.includes('set ') ||
      lowerMessage.includes('update ') ||
      lowerMessage.includes('change ');

    if (!priceAction || !updateAction) {
      return null;
    }

    const skuMatch =
      message.match(/\bsku\s*[:#-]?\s*([A-Za-z0-9_-]+)/i) ||
      message.match(/\bарт(?:икул)?\s*[:#-]?\s*([A-Za-z0-9_-]+)/i);
    const priceMatch =
      message.match(/(?:до|to|на|=|price\s*[:=]?)\s*(\d+(?:[.,]\d{1,2})?)/i) ||
      message.match(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:₽|rub|usd|eur)?\b/i);

    if (!skuMatch || !priceMatch) {
      return null;
    }

    return {
      type: IntentType.PRODUCT_UPDATE,
      confidence: 0.95,
      params: {
        sku: skuMatch[1],
        price: Number(priceMatch[1].replace(',', '.')),
      },
    };
  }

  private parseOrderStatusUpdate(message: string, lowerMessage: string): Intent | null {
    const orderNumber = this.extractOrderNumber(message);
    if (!orderNumber) {
      return null;
    }

    const status = this.extractOrderStatus(lowerMessage);
    const updateAction =
      lowerMessage.includes('статус') ||
      lowerMessage.includes('status') ||
      lowerMessage.includes('переведи') ||
      lowerMessage.includes('пометь') ||
      lowerMessage.includes('mark') ||
      lowerMessage.includes('set');

    if (!status || !updateAction) {
      return null;
    }

    return {
      type: IntentType.ORDER_UPDATE_STATUS,
      confidence: 0.95,
      params: {
        orderNumber,
        status,
      },
    };
  }

  private parseOrderView(message: string, lowerMessage: string): Intent | null {
    const orderNumber = this.extractOrderNumber(message);
    if (!orderNumber) {
      return null;
    }

    const wantsView =
      lowerMessage.includes('покажи') ||
      lowerMessage.includes('открой') ||
      lowerMessage.includes('найди') ||
      lowerMessage.includes('show') ||
      lowerMessage.includes('open') ||
      lowerMessage.includes('find');

    if (!wantsView) {
      return null;
    }

    return {
      type: IntentType.ORDER_VIEW,
      confidence: 0.9,
      params: { orderNumber },
    };
  }

  private parseCustomerNoteAdd(message: string, lowerMessage: string): Intent | null {
    const wantsNote =
      lowerMessage.includes('заметк') ||
      lowerMessage.includes('note') ||
      lowerMessage.includes('коммент');
    const addAction =
      lowerMessage.includes('добав') ||
      lowerMessage.includes('остав') ||
      lowerMessage.includes('add') ||
      lowerMessage.includes('create');
    const email = this.extractEmail(message);

    if (!wantsNote || !addAction || !email) {
      return null;
    }

    const content =
      message.match(/(?:заметка|note|комментарий)\s*[:-]\s*(.+)$/i)?.[1]?.trim() ||
      message.match(/(?:заметк[ауи]?|note|комментарий)\s*[:-]?\s*(.+)$/i)?.[1]?.trim() ||
      message.match(/(?:клиенту|customer)\s+.+?[,:-]\s*(.+)$/i)?.[1]?.trim();

    if (!content) {
      return null;
    }

    return {
      type: IntentType.CUSTOMER_NOTE_ADD,
      confidence: 0.94,
      params: {
        email,
        content,
      },
    };
  }

  private parseCustomerView(message: string, lowerMessage: string): Intent | null {
    const email = this.extractEmail(message);
    if (!email) {
      return null;
    }

    const wantsView =
      lowerMessage.includes('клиент') ||
      lowerMessage.includes('customer') ||
      lowerMessage.includes('покупател');
    const showAction =
      lowerMessage.includes('покажи') ||
      lowerMessage.includes('найди') ||
      lowerMessage.includes('открой') ||
      lowerMessage.includes('show') ||
      lowerMessage.includes('find') ||
      lowerMessage.includes('open');

    if (!wantsView || !showAction) {
      return null;
    }

    return {
      type: IntentType.CUSTOMER_VIEW,
      confidence: 0.92,
      params: { email },
    };
  }

  private parseTicketRespond(message: string, lowerMessage: string): Intent | null {
    const ticketId = this.extractTicketId(message);
    if (!ticketId) {
      return null;
    }

    const wantsRespond =
      lowerMessage.includes('ответ') ||
      lowerMessage.includes('reply') ||
      lowerMessage.includes('respond');

    if (!wantsRespond) {
      return null;
    }

    const responseText =
      message.match(/(?:ответь|ответ|reply|respond)\s+(?:в\s+)?тикет\s*[#:]?\s*[A-Za-z0-9-]+\s*(.+)$/i)?.[1]?.trim() ||
      message.match(/(?:reply|respond)\s+to\s+ticket\s*[#:]?\s*[A-Za-z0-9-]+\s*(.+)$/i)?.[1]?.trim();

    return {
      type: IntentType.TICKET_RESPOND,
      confidence: 0.93,
      params: {
        ticketId,
        ...(responseText ? { message: responseText } : { autoReply: true }),
      },
    };
  }

  private parseTicketStatusUpdate(message: string, lowerMessage: string): Intent | null {
    const ticketId = this.extractTicketId(message);
    if (!ticketId) {
      return null;
    }

    const status = this.extractTicketStatus(lowerMessage);
    if (!status) {
      return null;
    }

    return {
      type: IntentType.TICKET_UPDATE_STATUS,
      confidence: 0.94,
      params: {
        ticketId,
        status,
      },
    };
  }

  private parseTicketView(message: string, lowerMessage: string): Intent | null {
    const ticketId = this.extractTicketId(message);
    const wantsTickets =
      lowerMessage.includes('тикет') ||
      lowerMessage.includes('ticket') ||
      lowerMessage.includes('support');
    const showAction =
      lowerMessage.includes('покажи') ||
      lowerMessage.includes('открой') ||
      lowerMessage.includes('найди') ||
      lowerMessage.includes('show') ||
      lowerMessage.includes('open') ||
      lowerMessage.includes('find') ||
      lowerMessage.includes('list');

    if (!wantsTickets || !showAction) {
      return null;
    }

    return {
      type: IntentType.TICKET_VIEW,
      confidence: 0.88,
      params: ticketId ? { ticketId } : {},
    };
  }

  private extractEmail(message: string): string | null {
    return message.match(/[\w.+-]+@[\w.-]+\.\w+/i)?.[0] ?? null;
  }

  private extractOrderNumber(message: string): string | null {
    return (
      message.match(/(?:заказ|order)\s*[#:]?\s*([A-Za-z0-9_-]+)/i)?.[1] ??
      message.match(/\b([A-Z0-9]{6,})\b/)?.[1] ??
      null
    );
  }

  private extractTicketId(message: string): string | null {
    return message.match(/(?:тикет|ticket)\s*[#:]?\s*([A-Za-z0-9-]{6,})/i)?.[1] ?? null;
  }

  private extractOrderStatus(lowerMessage: string): string | null {
    const statuses: Array<{ match: RegExp; value: string }> = [
      { match: /\bpending\b|ожидает|в ожидании/, value: 'PENDING' },
      { match: /\bconfirmed\b|подтвержден/, value: 'CONFIRMED' },
      { match: /\bprocessing\b|в обработке|обрабаты/, value: 'PROCESSING' },
      { match: /\bshipped\b|отправлен|отгруж/, value: 'SHIPPED' },
      { match: /\bdelivered\b|доставлен|выдан/, value: 'DELIVERED' },
      { match: /\bcancelled\b|отмен/, value: 'CANCELLED' },
      { match: /\brefunded\b|возвращен|refund/, value: 'REFUNDED' },
      { match: /return requested|запрос возврата/, value: 'RETURN_REQUESTED' },
      { match: /\breturned\b|возврат завершен|returned/, value: 'RETURNED' },
    ];

    return statuses.find((status) => status.match.test(lowerMessage))?.value ?? null;
  }

  private extractTicketStatus(lowerMessage: string): string | null {
    const statuses: Array<{ match: RegExp; value: string }> = [
      { match: /\bopen\b|откры/, value: 'OPEN' },
      { match: /in progress|в работе|в обработке|processing/, value: 'IN_PROGRESS' },
      { match: /\bresolved\b|решен|закрыт как решенный/, value: 'RESOLVED' },
      { match: /\bclosed\b|закрой|закрыт/, value: 'CLOSED' },
    ];

    return statuses.find((status) => status.match.test(lowerMessage))?.value ?? null;
  }

  private parseWarehouseCreateParams(lowerMessage: string, originalMessage: string): Record<string, any> | null {
    const wantsCreateWarehouse =
      lowerMessage.includes('создай склад') ||
      lowerMessage.includes('создать склад') ||
      lowerMessage.includes('добавь склад') ||
      lowerMessage.includes('добавить склад') ||
      lowerMessage.includes('create warehouse') ||
      lowerMessage.includes('add warehouse');

    if (!wantsCreateWarehouse) {
      return null;
    }

    const params: Record<string, any> = {};
    const typeMatch = originalMessage.match(/\b(MAIN|STORE|MARKETPLACE)\b/i);
    if (typeMatch) {
      params.type = typeMatch[1].toUpperCase();
    }

    const priorityMatch = originalMessage.match(/(?:priority|приоритет)\s*[:=]?\s*(\d+)/i);
    if (priorityMatch) {
      params.priority = Number(priorityMatch[1]);
    }

    const cityMatch = originalMessage.match(/(?:город|city)\s*[:=]?\s*([A-Za-zА-Яа-я0-9 -]+)/i);
    if (cityMatch) {
      params.city = cityMatch[1].trim().replace(/[,.]+$/, '');
    }

    const addressMatch = originalMessage.match(/(?:адрес|address)\s*[:=]?\s*([^\n]+)/i);
    if (addressMatch) {
      params.address = addressMatch[1].trim().replace(/[,.]+$/, '');
    }

    const countryMatch = originalMessage.match(/(?:страна|country)\s*[:=]?\s*([A-Za-zА-Яа-я0-9 -]+)/i);
    if (countryMatch) {
      params.country = countryMatch[1].trim().replace(/[,.]+$/, '');
    }

    let remainder = originalMessage
      .replace(/(?:создай|создать|добавь|добавить|create|add)\s+склад\b/iu, '')
      .replace(/\b(MAIN|STORE|MARKETPLACE)\b/gi, '')
      .replace(/(?:город|city|адрес|address|страна|country|приоритет|priority)\s*[:=]?\s*[^,]+/gi, '')
      .replace(/[(),]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    remainder = remainder.replace(/^[-:]+/, '').trim();
    if (remainder) {
      params.name = remainder;
    }

    return params;
  }

  /** Greetings and “connection OK?” checks — should not surface as assistant unavailable */
  private looksLikeGreetingOrConnectionCheck(lower: string): boolean {
    if (
      lower.includes('hello') ||
      lower.includes('hi') ||
      lower === 'yo' ||
      lower.startsWith('yo ') ||
      lower.includes('good day') ||
      lower.includes('good evening') ||
      lower.includes('good morning') ||
      lower.includes('hello') ||
      lower.includes('hey') ||
      /\bhi\b/.test(lower)
    ) {
      return true;
    }
    return (
      lower.includes('connection test') ||
      lower.includes('connection check') ||
      lower.includes('connection test') ||
      lower.includes('are you there') ||
      lower === 'ping' ||
      lower.startsWith('ping ') ||
      lower.includes('connection test') ||
      lower.includes('are you working') ||
      (lower.includes('connection') && (lower.includes('check') || lower.includes('test')))
    );
  }

  /**
   * Get system prompt for intent recognition
   */
  private async getIntentRecognitionPrompt(userType: UserType): Promise<string> {
    // Try to get from database
    const promptType = userType === 'admin' ? 'admin_intent_recognition' : 'customer_intent_recognition';
    const prompt = await prisma.gPTAssistantPrompt.findFirst({
      where: {
        type: promptType,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (prompt) {
      return prompt.prompt;
    }

    // Return default prompt
    return this.getDefaultIntentRecognitionPrompt(userType);
  }

  /**
   * Get default intent recognition prompt
   */
  private getDefaultIntentRecognitionPrompt(userType: UserType): string {
    if (userType === 'admin') {
      return `You are an intent recognition system for an e-commerce admin panel.

Analyze the user's message and determine their intent. Respond ONLY with a valid JSON object:
{
  "intent": "INTENT_TYPE",
  "confidence": 0.0-1.0,
  "params": {
    "key": "value"
  }
}

CRITICAL: Your response must be ONLY valid JSON, no additional text before or after.

Available admin intents (use exact names):
- PRODUCT_SEARCH: Search/find products (keywords: show products, find products) - search for products by name, description, SKU, etc. (show products, find products)
- PRODUCT_CREATE: Create a new product (keywords: create product) - create a new product
- PRODUCT_UPDATE: Update/edit product (keywords: update product, edit product) - update/edit a product
- PRODUCT_DELETE: Delete product (keywords: delete product) - delete a product
- INVENTORY_VIEW: View inventory/warehouse (keywords: inventory, warehouse) - view inventory/warehouse
- WAREHOUSE_CREATE: Create a warehouse (keywords: create warehouse, add warehouse) - create a new warehouse
- INVENTORY_ADD: Add items to inventory (keywords: add to inventory) - add items to inventory
- INVENTORY_TRANSFER: Transfer inventory between warehouses (keywords: transfer) - transfer inventory between warehouses
- ORDER_SEARCH: Search for orders (keywords: orders, order, show orders, new orders) - search for orders by number, customer, status, etc.
- ORDER_VIEW: View order details (keywords: order details) - view order details
- ORDER_UPDATE_STATUS: Update order status (keywords: update status) - update order status
- ORDER_UPDATE_PAYMENT_STATUS: Update payment status (keywords: payment status) - update payment status
- PAYMENT_REQUEST_CREATE: Create payment request (keywords: create payment request) - create a payment request
- PAYMENT_REQUEST_VIEW: View payment requests (keywords: payment requests) - view payment requests
- RETURN_REQUEST_VIEW: View return requests (keywords: return requests) - view return requests
- RETURN_REQUEST_APPROVE: Approve return (keywords: approve return) - approve return
- RETURN_REQUEST_REJECT: Reject return (keywords: reject return) - reject return
- CUSTOMER_SEARCH: Search for customers (keywords: customer, find customer) - search for customers by name, email, phone, etc.
- CUSTOMER_VIEW: View customer details (keywords: customer profile) - view customer details
- CUSTOMER_UPDATE: Update customer information (keywords: update customer) - update customer information
- CUSTOMER_NOTE_ADD: Add note to customer (keywords: add note to customer) - add note to customer
- CUSTOMER_NOTE_VIEW: View customer notes (keywords: customer notes) - view customer notes
- LOOKBOOK_VIEW: View lookbooks (keywords: lookbook) - view lookbooks
- LOOKBOOK_CREATE: Create lookbook (keywords: create lookbook) - create lookbook
- LOOKBOOK_UPDATE: Update lookbook (keywords: update lookbook) - update lookbook
- PAGE_VIEW: View pages (keywords: pages) - view pages
- PAGE_CREATE: Create page (keywords: create page) - create page
- PAGE_UPDATE: Update page (keywords: update page) - update page
- BLOG_POST_VIEW: View blog posts (keywords: blog posts) - view blog posts
- BLOG_POST_CREATE: Create blog post (keywords: create blog post). Use linkedProductIds or productIds for product previews (preview products, buy link).
- BLOG_POST_UPDATE: Update blog post (keywords: update blog post). Use linkedProductIds or productIds for product previews.
- BLOG_POST_PUBLISH: Publish blog post (keywords: publish blog post) - publish blog post
- PROMO_CODE_VIEW: View promo codes (keywords: promo codes) - view promo codes
- PROMO_CODE_CREATE: Create promo code (keywords: create promo code) - create promo code
- PROMO_CODE_UPDATE: Update promo code (keywords: update promo code) - update promo code
- PROMO_CODE_STATS: Get promo code stats (keywords: promo code stats) - get promo code stats
- TICKET_VIEW: View support tickets (keywords: tickets) - view support tickets
- TICKET_CREATE: Create ticket (keywords: create ticket) - create ticket
- TICKET_RESPOND: Respond to ticket (keywords: respond to ticket). Use autoReply: true when user asks for automatic reply or reply in customer's language (automatically, in customer's language, in
- REPORT_GENERATE: Generate reports (keywords: report, generate report) - generate reports
- PAYMENT_GATEWAY_CONFIGURE: Configure payment gateway (keywords: configure payment gateway) - configure payment gateway
- PAYMENT_GATEWAY_VIEW: View payment gateways (keywords: payment gateways) - view payment gateways
- DELIVERY_SERVICE_CONFIGURE: Configure delivery service (keywords: configure delivery) - configure delivery service
- DELIVERY_SERVICE_VIEW: View delivery services (keywords: delivery services) - view delivery services
- EMAIL_SERVICE_CONFIGURE: Configure email service (keywords: configure email) - configure email service
- EMAIL_SERVICE_VIEW: View email service (keywords: email service) - view email service
- OAUTH_PROVIDER_CONFIGURE: Configure OAuth provider (keywords: configure OAuth) - configure OAuth provider
- OAUTH_PROVIDER_VIEW: View OAuth providers (keywords: OAuth providers) - view OAuth providers
- ANALYTICS_VIEW: View analytics/dashboard (keywords: analytics, statistics, dashboard) - view analytics/dashboard
- MARKETING_ADVICE: Give marketing and sales growth advice (keywords: marketing, increase sales, promotion, conversion) - analyze store metrics and suggest practical sales actions
- HELP: User needs help (keywords: help, what you can do) - user needs help
- UNKNOWN: Cannot determine intent (fallback) - cannot determine intent (fallback)

Parameter extraction rules:
- sku: Extract product SKU (alphanumeric, may contain dashes)
- productId: Extract product ID (UUID format)
- orderNumber: Extract order number (alphanumeric)
- orderId: Extract order ID (UUID format)
- customerId: Extract customer ID (UUID format)
- email: Extract email address
- price: Extract numeric price value
- quantity: Extract numeric quantity
- status: Extract status value (match to enum values)
- text: Extract text content for posts/comments
- hashtags: Extract hashtags as array
- imageUrls: Extract image URLs as array
- startDate, endDate: Extract dates in ISO format
- reportType: Extract report type (SALES, PRODUCTS, CUSTOMERS, INVENTORY, ACCOUNTING, ACCOUNTING_REPORT, accounting, accounting report)
- content, note: Extract note text for CUSTOMER_NOTE_ADD
- firstName, lastName, phone: For CUSTOMER_UPDATE
- linkedProductIds, productIds: Extract product IDs as array (for BLOG_POST_CREATE, BLOG_POST_UPDATE — products for preview in post, buy link)

Examples:
User: "Show all products by brand"
Response: {"intent": "PRODUCT_SEARCH", "confidence": 0.9, "params": {"brandName": "Name"}}

User: "Create promo code SPRING20 with 20% discount"
Response: {"intent": "PROMO_CODE_CREATE", "confidence": 0.95, "params": {"code": "SPRING20", "discountType": "PERCENTAGE", "discountValue": 20}}`;
    } else {
      return `You are an intent recognition system for an e-commerce customer assistant.

Analyze the user's message and determine their intent. Respond ONLY with a valid JSON object:
{
  "intent": "INTENT_TYPE",
  "confidence": 0.0-1.0,
  "params": {
    "key": "value"
  }
}

CRITICAL: Your response must be ONLY valid JSON, no additional text before or after.

Available customer intents (use exact names):
- CUSTOMER_PRODUCT_SEARCH: Search for products (keywords: products, find, buy, show products)
- CUSTOMER_PRODUCT_INFO: Get product information (keywords: product details, product description)
- CUSTOMER_PRODUCT_RECOMMENDATIONS: Get product recommendations (keywords: recommendations, similar products)
- CUSTOMER_ORDER_TRACK: Track order status (keywords: track order, order status)
- CUSTOMER_ORDER_VIEW: View order details (keywords: order details, show order)
- CUSTOMER_ORDER_HISTORY: View order history (keywords: order history, my orders)
- CUSTOMER_CART_VIEW: View shopping cart (keywords: cart, what in cart)
- CUSTOMER_CART_ADD: Add to cart (keywords: add to cart, buy)
- CUSTOMER_CART_REMOVE: Remove from cart (keywords: remove from cart)
- CUSTOMER_CART_UPDATE: Update cart item (keywords: update cart)
- CUSTOMER_WISHLIST_VIEW: View wishlist (keywords: wishlist, my wishlist)
- CUSTOMER_WISHLIST_ADD: Add to wishlist (keywords: add to wishlist)
- CUSTOMER_WISHLIST_REMOVE: Remove from wishlist (keywords: remove from wishlist)
- CUSTOMER_DELIVERY_INFO: Get delivery information (keywords: delivery, delivery times)
- CUSTOMER_PAYMENT_INFO: Get payment information (keywords: payment, payment methods)
- CUSTOMER_STORE_INFO: Get store information (keywords: store info)
- HELP: User needs help (keywords: help, what you can do)
- UNKNOWN: Cannot determine intent (fallback)

Parameter extraction rules:
- productId: Extract product ID (UUID format)
- productSlug: Extract product slug
- orderNumber: Extract order number (alphanumeric)
- size: Extract size (S, M, L, XL, or numeric)
- color: Extract color name
- quantity: Extract numeric quantity
- category: Extract category name
- brand: Extract brand name
- searchQuery: Extract search query text

Examples:
User: "Show black t-shirts size M"
Response: {"intent": "CUSTOMER_PRODUCT_SEARCH", "confidence": 0.95, "params": {"color": "black", "size": "M", "category": "t-shirts"}}

User: "Where is my order #12345?"
Response: {"intent": "CUSTOMER_ORDER_TRACK", "confidence": 0.95, "params": {"orderNumber": "12345"}}

User: "Add product with ID abc-123 to cart"
Response: {"intent": "CUSTOMER_CART_ADD", "confidence": 0.9, "params": {"productId": "abc-123"}}`;
    }
  }
}

export const intentRecognitionService = new IntentRecognitionService();
