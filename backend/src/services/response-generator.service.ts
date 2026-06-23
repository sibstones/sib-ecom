import { gptApiService } from './gpt-api.service';
import { Intent, IntentType, UserType, ChatMessage } from '../types/gpt-assistant';
import prisma from '../config/database';

export class ResponseGeneratorService {
  /**
   * Generate natural language response using GPT
   */
  async generateResponse(
    result: any,
    intent: Intent,
    userType: UserType,
    settings: any,
    previousMessages?: ChatMessage[],
    languageHint?: string
  ): Promise<{
    response: string;
    suggestions?: string[];
    quickActions?: any[];
  }> {
    try {
      if (intent.type === IntentType.HELP && typeof result?.message === 'string' && result.message.trim()) {
        return {
          response: this.localizePlainMessage(result.message, languageHint),
          suggestions: await this.generateSuggestions(intent, userType, settings),
        };
      }
      if (intent.type === IntentType.EMAIL_SERVICE_CONFIGURE) {
        return {
          response: this.buildEmailConfigureResponse(result, languageHint),
          suggestions: ['Show email settings', 'Check email', 'Configure SMTP'],
        };
      }
      if (intent.type === IntentType.EMAIL_SERVICE_VIEW) {
        return {
          response: this.buildEmailViewResponse(result, languageHint),
          suggestions: ['Configure SMTP', 'Check email', 'Enable email'],
        };
      }
      if (intent.type === IntentType.ORDER_UPDATE_STATUS) {
        return {
          response: this.buildOrderStatusUpdateResponse(result, languageHint),
          suggestions: ['Show order', 'Show orders', 'Change order status'],
        };
      }
      if (intent.type === IntentType.PRODUCT_UPDATE) {
        return {
          response: this.buildProductUpdateResponse(result, languageHint),
          suggestions: ['Find product', 'Change product price', 'Show products'],
        };
      }
      if (intent.type === IntentType.CUSTOMER_NOTE_ADD) {
        return {
          response: this.buildCustomerNoteAddResponse(result, languageHint),
          suggestions: ['Show customer', 'Show customer notes', 'Find customer'],
        };
      }
      if (intent.type === IntentType.TICKET_RESPOND) {
        return {
          response: this.buildTicketRespondResponse(result, languageHint),
          suggestions: ['Show tickets', 'Close ticket', 'Respond in ticket'],
        };
      }
      if (intent.type === IntentType.TICKET_UPDATE_STATUS) {
        return {
          response: this.buildTicketStatusUpdateResponse(result, languageHint),
          suggestions: ['Show tickets', 'Open ticket', 'Respond in ticket'],
        };
      }
      if (intent.type === IntentType.CUSTOMER_ORDER_TRACK) {
        return {
          response: this.buildCustomerOrderTrackingResponse(result, languageHint),
          suggestions:
            languageHint === 'ru'
              ? ['Покажи мои заказы', 'Связаться с поддержкой']
              : ['Show my orders', 'Contact support'],
        };
      }
      if (intent.type === IntentType.MARKETING_ADVICE) {
        return {
          response: this.buildMarketingAdviceResponse(result, languageHint),
          suggestions:
            languageHint === 'ru'
              ? ['Создай промокод', 'Предложи оффер для главной', 'Сегментируй клиентов для рассылки']
              : ['Create a promo code', 'Suggest a homepage offer', 'Segment customers for a campaign'],
        };
      }

      // Get system prompt
      const systemPrompt = await this.getSystemPrompt(userType, settings, languageHint);

      // Build messages
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
          timestamp: new Date(),
        },
      ];

      // Add previous messages for context
      if (previousMessages && previousMessages.length > 0) {
        messages.push(...previousMessages.slice(-5)); // Last 5 messages
      }

      // Add current context
      const contextMessage = this.buildContextMessage(intent, result, languageHint);
      messages.push({
        role: 'user',
        content: contextMessage,
        timestamp: new Date(),
      });

      // Generate response
      const response = await gptApiService.chatCompletion(messages, {
        model: settings.model || 'gpt-4',
        maxTokens: userType === 'admin' 
          ? settings.adminMaxResponseLength || 2000
          : settings.customerMaxResponseLength || 1500,
      });

      // Generate suggestions
      const suggestions = await this.generateSuggestions(intent, userType, settings);

      return {
        response,
        suggestions,
      };
    } catch (error) {
      console.error('Response generation error:', error);
      // Fallback to simple response
      return this.generateFallbackResponse(result, intent, userType, languageHint);
    }
  }

  /**
   * Build context message for GPT
   */
  private buildContextMessage(intent: Intent, result: any, languageHint?: string): string {
    const targetLanguage = this.toResponseLanguageInstruction(languageHint);
    return `Intent: ${intent.type}
Parameters: ${JSON.stringify(intent.params)}
Result: ${JSON.stringify(result)}

Generate a natural, helpful response in ${targetLanguage} based on the intent and result.
Use the same language as the user's latest message.`;
  }

  /**
   * Generate suggestions for next actions
   */
  private async generateSuggestions(
    intent: Intent,
    userType: UserType,
    _settings: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (userType === 'admin') {
      switch (intent.type) {
        case IntentType.PRODUCT_SEARCH:
          suggestions.push('Show product details', 'Change product price', 'Add product to stock');
          break;
        case IntentType.ORDER_SEARCH:
          suggestions.push('Show order details', 'Change order status', 'Create support ticket');
          break;
        case IntentType.WAREHOUSE_CREATE:
          suggestions.push('Show warehouses', 'Open warehouse details', 'Add inventory');
          break;
        case IntentType.EMAIL_SERVICE_VIEW:
        case IntentType.EMAIL_SERVICE_CONFIGURE:
          suggestions.push('Show email settings', 'Test email', 'Configure SMTP');
          break;
        case IntentType.CUSTOMER_SEARCH:
          suggestions.push('Show customer profile', 'Show customer orders', 'Add note');
          break;
        case IntentType.HELP:
          suggestions.push('Show today\'s orders', 'Find product by name', 'Open analytics');
          break;
        default:
          suggestions.push('Show statistics', 'Create report');
      }
    } else {
      switch (intent.type) {
        case IntentType.CUSTOMER_PRODUCT_SEARCH:
          suggestions.push('Show product details', 'Add to cart', 'Add to favorites');
          break;
        case IntentType.CUSTOMER_ORDER_TRACK:
          suggestions.push('Show all orders', 'Contact support');
          break;
        case IntentType.HELP:
          suggestions.push('Show catalog', 'Delivery conditions', 'How to make an order');
          break;
        default:
          suggestions.push('Show catalog', 'Show favorites');
      }
    }

    return suggestions;
  }

  /**
   * Get system prompt for response generation
   */
  private async getSystemPrompt(userType: UserType, settings: any, languageHint?: string): Promise<string> {
    const promptType = userType === 'admin' ? 'admin' : 'customer';
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
      return `${prompt.prompt}\n\nAlways answer in ${this.toResponseLanguageInstruction(languageHint)}.`;
    }

    return this.getDefaultSystemPrompt(userType, settings, languageHint);
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(userType: UserType, settings: any, languageHint?: string): string {
    const responseLanguage = this.toResponseLanguageInstruction(languageHint);
    if (userType === 'admin') {
      return `You are an AI assistant for an online store administrator.

Твоя задача:
1. Understand administrator requests in natural language
2. Recognize intentions and extract parameters
3. Perform actions through the API system
4. Provide clear answers

Доступные действия:
- Manage products (search, create, edit)
- Manage warehouse (stock, movements)
- Manage orders (view, change status)
- Manage customers (search, edit)
- Configure integrations (payments, delivery, email)
- Analytics and reports

Важно:
- Always check access permissions before performing actions
- Validate all data before saving
- Log all actions for audit
- Provide clear error messages
- Respond in ${responseLanguage}
- Always reply in the same language as the user's latest message`;
    } else {
      return `You are a friendly AI assistant for an online fashion store.

Твоя задача:
1. Help customers find products through natural language
2. Answer questions about products, delivery, payment
3. Help with orders and tracking
4. Provide personalized recommendations
5. Be friendly, helpful and polite

Доступные действия:
- Search products by description, features
- Answers to questions about products (sizes, materials, availability)
- Tracking orders
- Manage cart and favorites
- Information about delivery and payment
- Recommendations for products
- Work with promo codes and loyalty program

Важно:
- Always be friendly and polite
- Provide accurate information
- Offer useful actions (add to cart, view details)
- Help customers find what they need
- If you don't know the answer, direct to support
- Respond in ${responseLanguage}
- Always reply in the same language as the user's latest message`;
    }
  }

  /**
   * Generate fallback response when GPT fails
   */
  private generateFallbackResponse(
    result: any,
    intent: Intent,
    userType: UserType,
    languageHint?: string
  ): { response: string; suggestions?: string[] } {
    let response = '';
    const lang = languageHint || 'en';

    switch (intent.type) {
      case IntentType.PRODUCT_SEARCH:
      case IntentType.CUSTOMER_PRODUCT_SEARCH:
        if (result?.products && result.products.length > 0) {
          response = lang === 'ru' ? `Найдено товаров: ${result.products.length}.` : `Found ${result.products.length} products.`;
        } else {
          response = lang === 'ru' ? 'Товары не найдены.' : 'Products not found.';
        }
        break;
      
      case IntentType.ORDER_SEARCH:
      case IntentType.CUSTOMER_ORDER_HISTORY:
        if (result?.orders && result.orders.length > 0) {
          response = lang === 'ru' ? `Найдено заказов: ${result.orders.length}.` : `Found ${result.orders.length} orders.`;
        } else {
          response = lang === 'ru' ? 'Заказы не найдены.' : 'Orders not found.';
        }
        break;
      
      case IntentType.ORDER_VIEW:
        if (result) {
          response = lang === 'ru' ? `Статус заказа: ${result.status}.` : `Order status: ${result.status}.`;
        } else {
          response = lang === 'ru' ? 'Заказ не найден.' : 'Order not found.';
        }
        break;
      
      case IntentType.CUSTOMER_SEARCH:
        if (result?.customers && result.customers.length > 0) {
          response = lang === 'ru' ? `Найдено клиентов: ${result.customers.length}.` : `Found ${result.customers.length} customers.`;
        } else {
          response = lang === 'ru' ? 'Клиенты не найдены.' : 'Customers not found.';
        }
        break;

      case IntentType.CUSTOMER_UPDATE:
        response = result ? (lang === 'ru' ? 'Данные клиента обновлены.' : 'Customer data updated.') : (lang === 'ru' ? 'Не удалось обновить клиента.' : 'Failed to update customer.');
        break;

      case IntentType.CUSTOMER_NOTE_VIEW:
        if (result && Array.isArray(result) && result.length > 0) {
          response = `Found notes: ${result.length}.`;
        } else if (result && Array.isArray(result)) {
          response = 'No notes.';
        } else {
          response = 'Notes not found.';
        }
        break;

      case IntentType.WAREHOUSE_CREATE:
        if (result?.name) {
          response = lang === 'ru' ? `Склад "${result.name}" успешно создан.` : `Warehouse "${result.name}" created successfully.`;
        } else {
          response = lang === 'ru' ? 'Склад создан.' : 'Warehouse created.';
        }
        break;

      case IntentType.EMAIL_SERVICE_CONFIGURE:
        response = this.buildEmailConfigureResponse(result, languageHint);
        break;

      case IntentType.EMAIL_SERVICE_VIEW:
        response = this.buildEmailViewResponse(result, languageHint);
        break;

      case IntentType.ORDER_UPDATE_STATUS:
        response = this.buildOrderStatusUpdateResponse(result, languageHint);
        break;

      case IntentType.PRODUCT_UPDATE:
        response = this.buildProductUpdateResponse(result, languageHint);
        break;

      case IntentType.CUSTOMER_NOTE_ADD:
        response = this.buildCustomerNoteAddResponse(result, languageHint);
        break;

      case IntentType.TICKET_RESPOND:
        response = this.buildTicketRespondResponse(result, languageHint);
        break;

      case IntentType.TICKET_UPDATE_STATUS:
        response = this.buildTicketStatusUpdateResponse(result, languageHint);
        break;

      case IntentType.CUSTOMER_ORDER_TRACK:
        response = this.buildCustomerOrderTrackingResponse(result, languageHint);
        break;

      case IntentType.MARKETING_ADVICE:
        response = this.buildMarketingAdviceResponse(result, languageHint);
        break;

      case IntentType.HELP:
        response =
          typeof result?.message === 'string'
            ? this.localizePlainMessage(result.message, languageHint)
            : lang === 'ru'
              ? 'Я на связи. Опишите, с чем нужна помощь.'
              : 'I am here. Describe what you need help with.';
        break;

      default:
        response = lang === 'ru'
          ? 'Я понял запрос, но эта функция пока не реализована.'
          : 'I understood your request, but the function is not yet implemented.';
    }

    return { response };
  }

  private buildEmailConfigureResponse(result: any, languageHint?: string): string {
    const lang = languageHint || 'en';
    const changed = Array.isArray(result?.changedLabels) ? result.changedLabels : [];
    if (changed.length === 0) {
      return lang === 'ru' ? 'Почтовые настройки не изменены.' : 'Email settings were not changed.';
    }
    if (lang === 'ru') {
      const providerPart = result?.provider ? ` Провайдер: ${result.provider}.` : '';
      return `Обновил настройки почты:${providerPart} Изменены поля: ${changed.join(', ')}.`;
    }
    const providerPart = result?.provider ? ` Provider: ${result.provider}.` : '';
    return `Updated email settings.${providerPart} Changed fields: ${changed.join(', ')}.`;
  }

  private buildEmailViewResponse(result: any, languageHint?: string): string {
    const lang = languageHint || 'en';
    const provider = result?.provider || 'CONSOLE';
    const enabled = result?.enabled ? 'включена' : 'выключена';
    const fromEmail = result?.fromEmail || 'не задан';
    const fromName = result?.fromName || 'не задан';
    const smtpHost = result?.smtpHost || 'не задан';
    const smtpPort = result?.smtpPort || 'не задан';
    const smtpUser = result?.smtpUser || 'не задан';
    if (lang === 'ru') {
      return `Почта сейчас ${enabled}. Провайдер: ${provider}. From email: ${fromEmail}. From name: ${fromName}. SMTP host: ${smtpHost}. SMTP port: ${smtpPort}. SMTP user: ${smtpUser}.`;
    }
    const enabledText = result?.enabled ? 'enabled' : 'disabled';
    const fromEmailText = result?.fromEmail || 'not set';
    const fromNameText = result?.fromName || 'not set';
    const smtpHostText = result?.smtpHost || 'not set';
    const smtpPortText = result?.smtpPort || 'not set';
    const smtpUserText = result?.smtpUser || 'not set';
    return `Email is currently ${enabledText}. Provider: ${provider}. From email: ${fromEmailText}. From name: ${fromNameText}. SMTP host: ${smtpHostText}. SMTP port: ${smtpPortText}. SMTP user: ${smtpUserText}.`;
  }

  private buildOrderStatusUpdateResponse(result: any, languageHint?: string): string {
    const orderNumber = result?.orderNumber || result?.order?.orderNumber || result?.id || 'заказ';
    const status = result?.status || result?.order?.status || 'UNKNOWN';
    return languageHint === 'ru'
      ? `Статус заказа ${orderNumber} обновлен на ${status}.`
      : `Order ${orderNumber} status was updated to ${status}.`;
  }

  private buildProductUpdateResponse(result: any, languageHint?: string): string {
    const product = result?.product || result;
    if (!product) {
      return languageHint === 'ru' ? 'Товар обновлен.' : 'Product updated.';
    }
    const productName = product.name || product.sku || 'товар';
    const parts: string[] = [languageHint === 'ru' ? `Обновил товар "${productName}".` : `Updated product "${productName}".`];
    if (product.price !== undefined && product.price !== null) {
      parts.push(languageHint === 'ru' ? `Новая цена: ${product.price}.` : `New price: ${product.price}.`);
    }
    if (product.compareAtPrice !== undefined && product.compareAtPrice !== null) {
      parts.push(languageHint === 'ru' ? `Старая цена: ${product.compareAtPrice}.` : `Compare-at price: ${product.compareAtPrice}.`);
    }
    return parts.join(' ');
  }

  private buildCustomerNoteAddResponse(result: any, languageHint?: string): string {
    const note = result?.note || result;
    const customerEmail = note?.customer?.email || note?.user?.email;
    return customerEmail
      ? languageHint === 'ru'
        ? `Добавил заметку клиенту ${customerEmail}.`
        : `Added a note for customer ${customerEmail}.`
      : languageHint === 'ru'
        ? 'Заметка клиенту добавлена.'
        : 'Customer note added.';
  }

  private buildTicketRespondResponse(result: any, languageHint?: string): string {
    const ticketId = result?.ticket?.id || result?.ticketId || 'тикет';
    return languageHint === 'ru'
      ? `Ответ в тикет ${ticketId} добавлен.`
      : `Reply to ticket ${ticketId} was added.`;
  }

  private buildTicketStatusUpdateResponse(result: any, languageHint?: string): string {
    const ticketId = result?.ticket?.id || result?.ticketId || 'тикет';
    const status = result?.ticket?.status || result?.status || 'UNKNOWN';
    return languageHint === 'ru'
      ? `Статус тикета ${ticketId} обновлен на ${status}.`
      : `Ticket ${ticketId} status was updated to ${status}.`;
  }

  private buildCustomerOrderTrackingResponse(result: any, languageHint?: string): string {
    const lang = languageHint || 'en';
    if (!result) {
      return lang === 'ru' ? 'Заказ не найден.' : 'Order not found.';
    }

    const orderNumber = result.orderNumber || result.id || 'order';
    const status = result.status || 'UNKNOWN';
    const trackingNumber =
      result.trackingNumber ||
      result.paymentRequest?.logisticsInfo?.trackingNumber ||
      result.paymentRequest?.logisticsInfo?.trackNumber ||
      result.waybillNumber ||
      null;
    const explicitTrackingUrl =
      result.paymentRequest?.logisticsInfo?.trackingUrl ||
      result.paymentRequest?.logisticsInfo?.trackingURL ||
      result.paymentRequest?.logisticsInfo?.tracking_link ||
      null;
    const trackingUrl =
      explicitTrackingUrl ||
      this.buildTrackingUrlFromCarrier(
        trackingNumber,
        result.carrierName ||
          result.paymentRequest?.logisticsInfo?.carrier ||
          result.paymentRequest?.logisticsInfo?.carrierName ||
          result.deliveryMethod
      );
    const localizedStatus = this.localizeOrderStatus(status, lang);

    if (lang === 'ru') {
      const parts = [`Заказ ${orderNumber}: статус ${localizedStatus}.`];
      if (trackingNumber) {
        parts.push(`Трек-номер: ${trackingNumber}.`);
      } else {
        parts.push('Трек-номер еще не добавлен в заказ.');
      }
      if (trackingUrl) {
        parts.push(`Отследить доставку можно здесь: ${trackingUrl}`);
      }
      return parts.join(' ');
    }

    const parts = [`Order ${orderNumber}: status ${localizedStatus}.`];
    if (trackingNumber) {
      parts.push(`Tracking number: ${trackingNumber}.`);
    } else {
      parts.push('A tracking number has not been added to this order yet.');
    }
    if (trackingUrl) {
      parts.push(`You can track the shipment here: ${trackingUrl}`);
    }
    return parts.join(' ');
  }

  private localizeOrderStatus(status: string, language: string): string {
    const normalized = String(status || 'UNKNOWN').toUpperCase();

    if (language === 'ru') {
      const ruMap: Record<string, string> = {
        PENDING: 'ожидает подтверждения',
        CONFIRMED: 'подтвержден',
        PROCESSING: 'готовится к отправке',
        SHIPPED: 'отправлен',
        DELIVERED: 'доставлен',
        CANCELLED: 'отменен',
        REFUNDED: 'возвращен с возвратом оплаты',
        RETURN_REQUESTED: 'оформлен запрос на возврат',
        RETURNED: 'возвращен',
        UNKNOWN: 'статус уточняется',
      };

      return ruMap[normalized] || normalized;
    }

    return normalized;
  }

  private buildTrackingUrlFromCarrier(trackingNumber: string | null, carrierRaw?: string | null): string | null {
    if (!trackingNumber) {
      return null;
    }

    const carrier = String(carrierRaw || '').trim().toUpperCase();

    if (carrier.includes('CDEK') || carrier.includes('СДЭК')) {
      return `https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(trackingNumber)}`;
    }
    if (carrier.includes('BOXBERRY')) {
      return `https://boxberry.ru/tracking-page?id=${encodeURIComponent(trackingNumber)}`;
    }
    if (carrier.includes('DHL')) {
      return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(trackingNumber)}`;
    }
    if (carrier.includes('UPS')) {
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
    }
    if (carrier.includes('USPS')) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
    }
    if (carrier.includes('YANDEX')) {
      return `https://dostavka.yandex.ru/track/${encodeURIComponent(trackingNumber)}`;
    }
    if (
      carrier.includes('RUSSIAN_POST') ||
      carrier.includes('ПОЧТА') ||
      carrier.includes('RUSSIAN POST')
    ) {
      return `https://www.pochta.ru/tracking#${encodeURIComponent(trackingNumber)}`;
    }

    return null;
  }

  private buildMarketingAdviceResponse(result: any, languageHint?: string): string {
    const lang = languageHint || 'en';
    const summary = result?.summary || {};
    const recommendations = Array.isArray(result?.recommendations)
      ? result.recommendations.slice(0, 3)
      : [];

    if (lang === 'ru') {
      const lines = [
        `Сейчас по магазину: заказов за последние 14 дней ${summary.createdOrdersLast14 ?? 0}, активных промокодов ${summary.activePromos ?? 0}, товаров ${summary.totalProducts ?? 0}, клиентов ${summary.totalCustomers ?? 0}.`,
      ];

      if (typeof summary.revenueDelta === 'number') {
        const direction = summary.revenueDelta >= 0 ? 'выросла' : 'снизилась';
        lines.push(`Выручка за 14 дней ${direction} на ${Math.abs(summary.revenueDelta).toFixed(1)}% относительно предыдущего периода.`);
      }

      if (recommendations.length > 0) {
        lines.push('Что сделать дальше:');
        recommendations.forEach((item: any, index: number) => {
          lines.push(`${index + 1}. ${this.localizeMarketingAction(item.action, 'ru')}`);
        });
      }

      return lines.join(' ');
    }

    const lines = [
      `Current store snapshot: ${summary.createdOrdersLast14 ?? 0} orders in the last 14 days, ${summary.activePromos ?? 0} active promo codes, ${summary.totalProducts ?? 0} products, ${summary.totalCustomers ?? 0} customers.`,
    ];

    if (typeof summary.revenueDelta === 'number') {
      const direction = summary.revenueDelta >= 0 ? 'up' : 'down';
      lines.push(`Revenue over the last 14 days is ${direction} ${Math.abs(summary.revenueDelta).toFixed(1)}% versus the previous period.`);
    }

    if (recommendations.length > 0) {
      lines.push('Next best actions:');
      recommendations.forEach((item: any, index: number) => {
        lines.push(`${index + 1}. ${item.action}`);
      });
    }

    return lines.join(' ');
  }

  private localizeMarketingAction(action: string, language: string): string {
    if (language !== 'ru') {
      return action;
    }

    const dictionary: Record<string, string> = {
      'Launch a homepage offer, refresh hero content, and send a win-back message to old customers.': 'Запусти оффер на главной, обнови первый экран и отправь реактивационное сообщение старым клиентам.',
      'Create a limited promo code for first or repeat orders and place it on the homepage and in messages.': 'Создай ограниченный промокод для первой или повторной покупки и вынеси его на главную и в сообщения.',
      'Revenue is down versus the previous 14 days. Run a short campaign with urgency: bestseller bundle, deadline, and reminder message.': 'Выручка просела относительно прошлых 14 дней. Запусти короткую кампанию с дедлайном: бестселлер, бандл и сообщение-напоминание.',
      'There are many pending orders. Speed up payment and delivery communication so demand is not lost after checkout.': 'Незавершенных заказов много. Усиль коммуникацию по оплате и доставке, чтобы не терять спрос после оформления.',
      'Assortment is still small. Focus on a narrow bestseller offer, bundles, and stronger content instead of broad campaigns.': 'Ассортимент пока небольшой. Делай упор на узкий оффер вокруг бестселлеров, наборы и сильный контент вместо широких кампаний.',
      'Prepare three content blocks for the homepage: bestseller proof, clear offer, and social proof or FAQ to reduce hesitation.': 'Подготовь для главной три блока: доказательство спроса на бестселлер, понятный оффер и social proof или FAQ для снятия сомнений.',
      'Segment recent customers, abandoned carts, and inactive buyers into separate messages instead of one generic mailing.': 'Раздели недавних покупателей, брошенные корзины и спящих клиентов на отдельные рассылки вместо одной общей.',
    };

    return dictionary[action] || action;
  }

  private toResponseLanguageInstruction(languageHint?: string): string {
    if (languageHint === 'ru') return 'Russian';
    if (languageHint === 'zh') return 'Chinese';
    return 'English';
  }

  private localizePlainMessage(message: string, languageHint?: string): string {
    if (languageHint === 'ru') {
      if (message === 'Connection to the assistant is working. Ready to help with the admin panel.') {
        return 'Соединение с ассистентом работает. Готов помочь с админкой.';
      }
      if (message === 'I can help with products, orders, customers, warehouse, content and settings. Formulate your task in one phrase.') {
        return 'Могу помочь с товарами, заказами, клиентами, складом, контентом и настройками. Сформулируйте задачу одной фразой.';
      }
    }
    return message;
  }
}

export const responseGeneratorService = new ResponseGeneratorService();
