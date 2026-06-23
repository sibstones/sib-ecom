import prisma from '../config/database';
import { Intent, UserType } from '../types/gpt-assistant';
import { TicketStatus } from '@prisma/client';

type ConversationChannel = 'ADMIN' | 'CUSTOMER';
type ConversationStatus =
  | 'OPEN'
  | 'WAITING_FOR_USER'
  | 'WAITING_FOR_ADMIN'
  | 'RESOLVED'
  | 'FAILED'
  | 'ESCALATED';
type MessageRole = 'USER' | 'ASSISTANT';
type ExecutionStatus = 'EXECUTED' | 'FAILED' | 'NOOP';

type RecordInteractionInput = {
  userId: string | null;
  userType: UserType;
  sessionId?: string;
  message: string;
  response: string;
  intent: Intent;
  executionTime: number;
  data?: any;
  currentPage?: string;
  isError?: boolean;
};

type ListConversationFilters = {
  channel?: 'admin' | 'customer';
  status?: string;
  limit?: number;
  offset?: number;
  search?: string;
};

class AIConversationService {
  private readonly reuseWindowMs = 30 * 60 * 1000;

  private get prismaAny(): any {
    return prisma as any;
  }

  isAvailable(): boolean {
    return Boolean(this.prismaAny.aiConversation && this.prismaAny.aiConversationMessage);
  }

  async recordInteraction(input: RecordInteractionInput): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const channel = this.getChannel(input.userType);
    const now = new Date();
    const language = this.detectLanguage(input.message);
    const recentConversation = await this.findRecentConversation(channel, input.userId, input.sessionId, now);

    const conversation =
      recentConversation ??
      (await this.prismaAny.aiConversation.create({
        data: {
          channel,
          status: this.deriveConversationStatus(input),
          adminId: channel === 'ADMIN' ? input.userId : null,
          userId: channel === 'CUSTOMER' ? input.userId : null,
          guestSessionId: channel === 'CUSTOMER' && !input.userId ? input.sessionId ?? null : null,
          title: this.buildTitle(input.message),
          language,
          topicLabel: this.toTopicLabel(input.intent.type),
          summary: null,
          lastIntent: input.intent.type,
          lastMessageAt: now,
        },
      }));

    const userMessage = await this.prismaAny.aiConversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER' satisfies MessageRole,
        actorUserId: input.userId,
        content: input.message,
        intent: input.intent.type,
        toolData: input.currentPage ? { currentPage: input.currentPage } : undefined,
      },
    });

    const assistantMessage = await this.prismaAny.aiConversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT' satisfies MessageRole,
        actorUserId: null,
        content: input.response,
        intent: input.intent.type,
        toolData: input.data ?? undefined,
        isError: Boolean(input.isError),
      },
    });

    await this.prismaAny.aiActionExecution.create({
      data: {
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        actionId: input.intent.type,
        status: this.deriveExecutionStatus(input),
        permissionChecked: input.userType === 'admin',
        confirmationRequired: Boolean(input.data?.requiresConfirmation),
        arguments: {
          message: input.message,
          currentPage: input.currentPage ?? null,
        },
        resultData: {
          response: input.response,
          data: input.data ?? null,
          executionTime: input.executionTime,
        },
        errorCode: input.isError ? input.intent.type : null,
        errorMessage: input.isError ? input.response : null,
      },
    });

    await this.prismaAny.aiConversation.update({
      where: { id: conversation.id },
      data: {
        language: conversation.language || language,
        topicLabel: this.toTopicLabel(input.intent.type),
        lastIntent: input.intent.type,
        lastMessageAt: now,
        status: this.deriveConversationStatus(input),
      },
    });

    void userMessage;
  }

  async listConversations(filters: ListConversationFilters) {
    if (!this.isAvailable()) {
      return {
        conversations: [],
        total: 0,
        limit: filters.limit ?? 20,
        offset: filters.offset ?? 0,
      };
    }

    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const where: any = {};

    if (filters.channel) {
      where.channel = filters.channel === 'admin' ? 'ADMIN' : 'CUSTOMER';
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { topicLabel: { contains: filters.search, mode: 'insensitive' } },
        { summary: { contains: filters.search, mode: 'insensitive' } },
        { lastIntent: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      this.prismaAny.aiConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              messages: true,
              executions: true,
            },
          },
        },
      }),
      this.prismaAny.aiConversation.count({ where }),
    ]);

    return {
      conversations,
      total,
      limit,
      offset,
    };
  }

  async getConversationById(id: string) {
    if (!this.isAvailable()) {
      return null;
    }

    return this.prismaAny.aiConversation.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        executions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async markResolved(id: string) {
    if (!this.isAvailable()) {
      throw new Error('AI conversation storage is not available');
    }

    return this.prismaAny.aiConversation.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  }

  async markWaitingForUser(id: string, adminId?: string) {
    if (!this.isAvailable()) {
      throw new Error('AI conversation storage is not available');
    }

    return this.prismaAny.aiConversation.update({
      where: { id },
      data: {
        status: 'WAITING_FOR_USER',
        assignedAdminId: adminId ?? undefined,
      },
    });
  }

  async markEscalated(id: string, adminId: string) {
    if (!this.isAvailable()) {
      throw new Error('AI conversation storage is not available');
    }

    return this.prismaAny.aiConversation.update({
      where: { id },
      data: {
        status: 'ESCALATED',
        assignedAdminId: adminId,
        escalatedAt: new Date(),
      },
    });
  }

  async linkSupportTicket(id: string, ticketId: string, adminId: string) {
    if (!this.isAvailable()) {
      throw new Error('AI conversation storage is not available');
    }

    return this.prismaAny.aiConversation.update({
      where: { id },
      data: {
        supportTicketId: ticketId,
        assignedAdminId: adminId,
        status: 'WAITING_FOR_ADMIN',
      },
    });
  }

  buildDraftReply(conversation: any): { draft: string; summary: string } {
    const userMessages = (conversation.messages || []).filter((message: any) => message.role === 'USER');
    const lastUserMessage = userMessages[userMessages.length - 1]?.content?.trim() || '';
    const hasFailure = (conversation.executions || []).some(
      (execution: any) => execution.status === 'FAILED' || execution.errorMessage
    );
    const language = conversation.language || this.detectLanguage(lastUserMessage);
    const excerpt = this.truncate(lastUserMessage, 220);

    if (language === 'ru') {
      return {
        draft: [
          'Здравствуйте! Спасибо за обращение.',
          excerpt ? `Я изучил ваш запрос: "${excerpt}".` : 'Я изучил ваш текущий запрос.',
          hasFailure
            ? 'Вижу, что предыдущий автоматический ответ не решил вопрос, поэтому я передал диалог в ручную обработку.'
            : 'Я передал диалог в работу и сейчас проверяю детали.',
          'Если вопрос связан с заказом или товаром, можете дополнительно прислать номер заказа, артикул или нужный размер.',
        ].join('\n\n'),
        summary: hasFailure
          ? 'Customer AI conversation escalated after an unsuccessful automated resolution.'
          : 'Customer AI conversation prepared for human support follow-up.',
      };
    }

    return {
      draft: [
        'Hello, and thank you for your message.',
        excerpt ? `I reviewed your request: "${excerpt}".` : 'I reviewed your current request.',
        hasFailure
          ? 'I can see that the previous automated response did not fully resolve the issue, so I am taking this over manually.'
          : 'I am reviewing the conversation and checking the details for you now.',
        'If this is about an order or product, please feel free to share the order number, product name, or size as well.',
      ].join('\n\n'),
      summary: hasFailure
        ? 'Customer AI conversation escalated after an unsuccessful automated resolution.'
        : 'Customer AI conversation prepared for human support follow-up.',
    };
  }

  async syncLinkedTicketResolution(id: string) {
    if (!this.isAvailable()) {
      return null;
    }

    const conversation = await this.prismaAny.aiConversation.findUnique({
      where: { id },
      select: { supportTicketId: true },
    });

    if (!conversation?.supportTicketId || !prisma.supportTicket) {
      return null;
    }

    return prisma.supportTicket.update({
      where: { id: conversation.supportTicketId },
      data: {
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }

  private async findRecentConversation(
    channel: ConversationChannel,
    userId: string | null,
    sessionId: string | undefined,
    now: Date
  ) {
    const where: any = {
      channel,
      lastMessageAt: {
        gte: new Date(now.getTime() - this.reuseWindowMs),
      },
      status: {
        in: ['OPEN', 'WAITING_FOR_USER', 'WAITING_FOR_ADMIN'],
      },
    };

    if (channel === 'ADMIN' && userId) {
      where.adminId = userId;
    } else if (userId) {
      where.userId = userId;
    } else if (sessionId) {
      where.guestSessionId = sessionId;
    } else {
      return null;
    }

    return this.prismaAny.aiConversation.findFirst({
      where,
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  private getChannel(userType: UserType): ConversationChannel {
    return userType === 'admin' ? 'ADMIN' : 'CUSTOMER';
  }

  private deriveConversationStatus(input: RecordInteractionInput): ConversationStatus {
    if (input.isError || input.intent.type === 'UNKNOWN') {
      return 'FAILED';
    }

    if (input.data?.requiresConfirmation) {
      return 'WAITING_FOR_ADMIN';
    }

    return 'OPEN';
  }

  private deriveExecutionStatus(input: RecordInteractionInput): ExecutionStatus {
    if (input.isError || input.intent.type === 'UNKNOWN') {
      return 'FAILED';
    }

    if (input.data?.success === false || input.data?.changed === false) {
      return 'NOOP';
    }

    return 'EXECUTED';
  }

  private buildTitle(message: string): string {
    const compact = message.trim().replace(/\s+/g, ' ');
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
  }

  private detectLanguage(message: string): string {
    if (/[А-Яа-яЁё]/.test(message)) {
      return 'ru';
    }
    if (/[\u4E00-\u9FFF]/.test(message)) {
      return 'zh';
    }
    return 'en';
  }

  private toTopicLabel(intentType: string): string {
    return intentType.toLowerCase();
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }
}

export const aiConversationService = new AIConversationService();
