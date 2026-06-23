import prisma from '../config/database';
import { TicketStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

export class TicketService {
  // Helper to check if supportTicket model is available
  private ensureSupportTicketModel() {
    if (!prisma.supportTicket) {
      throw new Error('SupportTicket model not available in Prisma client');
    }
  }

  // Create a new support ticket
  async createTicket(orderId: string, userId: string, subject: string, message: string) {
    this.ensureSupportTicketModel();
    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new Error('Order not found or access denied');
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        order: {
          connect: { id: orderId },
        },
        user: {
          connect: { id: userId },
        },
        subject,
        status: TicketStatus.OPEN,
        messages: {
          create: {
            userId,
            message,
            isAdmin: false,
          },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    return ticket;
  }

  // Admin: Create ticket for a customer (orderId optional — e.g. proactive support when customer has no orders)
  async createTicketForCustomer(
    orderId: string | null | undefined,
    userId: string,
    adminId: string,
    subject: string,
    message: string,
    options?: {
      source?: 'MANUAL' | 'AI_CUSTOMER' | 'AI_ADMIN';
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      category?: string | null;
      messageSource?: 'CUSTOMER' | 'ADMIN' | 'AI_DRAFT' | 'AI_SENT';
    }
  ) {
    this.ensureSupportTicketModel();
    const effectiveOrderId = orderId ?? null;

    if (effectiveOrderId) {
      const order = await prisma.order.findUnique({
        where: { id: effectiveOrderId },
      });
      if (!order) {
        throw new Error('Order not found');
      }
      if (order.userId !== userId) {
        throw new Error('Order does not belong to the specified user');
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        ...(effectiveOrderId ? { order: { connect: { id: effectiveOrderId } } } : {}),
        user: {
          connect: { id: userId },
        },
        subject,
        status: TicketStatus.OPEN,
        source: options?.source ?? 'MANUAL',
        priority: options?.priority ?? 'NORMAL',
        category: options?.category ?? null,
        adminId,
        messages: {
          create: {
            userId: adminId,
            message,
            isAdmin: true,
            source: options?.messageSource ?? 'ADMIN',
          },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    return ticket;
  }

  // Get tickets for a customer
  async getCustomerTickets(userId: string, page: number = 1, limit: number = 20) {
    try {
      this.ensureSupportTicketModel();
      const skip = (page - 1) * limit;

      const [tickets, total] = await Promise.all([
        prisma.supportTicket.findMany({
          where: { userId },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }).catch(() => []),
        prisma.supportTicket.count({ where: { userId } }).catch(() => 0),
      ]);

      return {
        tickets: tickets ?? [],
        pagination: {
          page,
          limit,
          total: total ?? 0,
          totalPages: Math.ceil((total ?? 0) / limit),
        },
      };
    } catch (error) {
      console.error('Error in getCustomerTickets:', error);
      return {
        tickets: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  // Get a single ticket for customer (optionally mark as read)
  async getCustomerTicket(ticketId: string, userId: string, markAsRead: boolean = false) {
    try {
      this.ensureSupportTicketModel();
      const ticket = await prisma.supportTicket.findFirst({
        where: {
          id: ticketId,
          userId,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              total: true,
              createdAt: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              ticket: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      }).catch(() => null);

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      if (markAsRead) {
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: { customerLastReadAt: new Date() },
        });
      }

      return ticket;
    } catch (error) {
      console.error('Error in getCustomerTicket:', error);
      throw error;
    }
  }

  /** Count tickets that have admin replies after customerLastReadAt (unread replies) */
  async getUnreadTicketsCount(userId: string): Promise<number> {
    try {
      this.ensureSupportTicketModel();
      const tickets = await prisma.supportTicket.findMany({
        where: { userId, status: { not: TicketStatus.CLOSED } },
        select: {
          id: true,
          createdAt: true,
          customerLastReadAt: true,
          messages: {
            where: { isAdmin: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });
      return tickets.filter((t) => {
        const lastRead = t.customerLastReadAt ?? t.createdAt;
        const lastAdminMsg = t.messages[0]?.createdAt;
        return lastAdminMsg ? lastAdminMsg > lastRead : false;
      }).length;
    } catch (error) {
      console.error('Error in getUnreadTicketsCount:', error);
      return 0;
    }
  }

  /** Mark ticket as read by customer (set customerLastReadAt to now) */
  async markTicketAsRead(ticketId: string, userId: string): Promise<void> {
    this.ensureSupportTicketModel();
    await prisma.supportTicket.updateMany({
      where: { id: ticketId, userId },
      data: { customerLastReadAt: new Date() },
    });
  }

  // Add message to ticket (customer)
  async addCustomerMessage(ticketId: string, userId: string, message: string) {
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId,
      },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status === TicketStatus.CLOSED) {
      throw new Error('Cannot add message to closed ticket');
    }

    // Update ticket status if it was resolved
    const updateData: Prisma.SupportTicketUpdateInput = {
      messages: {
        create: {
          userId,
          message,
          isAdmin: false,
        },
      },
    };

    if (ticket.status === TicketStatus.RESOLVED) {
      updateData.status = TicketStatus.IN_PROGRESS;
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return updatedTicket;
  }

  // Admin: Get all tickets
  async getAllTickets(page: number = 1, limit: number = 20, filters?: {
    status?: TicketStatus;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    try {
      this.ensureSupportTicketModel();
      const skip = (page - 1) * limit;

      const where: Prisma.SupportTicketWhereInput = {};
      if (filters?.status) where.status = filters.status;
      if (filters?.search) {
        where.OR = [
          { subject: { contains: filters.search, mode: 'insensitive' } },
          { order: { orderNumber: { contains: filters.search, mode: 'insensitive' } } },
          { user: { email: { contains: filters.search, mode: 'insensitive' } } },
        ];
      }
      if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) {
          const d = new Date(filters.dateTo);
          d.setHours(23, 59, 59, 999);
          where.createdAt.lte = d;
        }
      }

      const orderBy = { createdAt: (filters?.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc' };

      const [tickets, total] = await Promise.all([
        prisma.supportTicket.findMany({
          where,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy,
          skip,
          take: limit,
        }).catch(() => []),
        prisma.supportTicket.count({ where }).catch(() => 0),
      ]);

      return {
        tickets: tickets ?? [],
        pagination: {
          page,
          limit,
          total: total ?? 0,
          totalPages: Math.ceil((total ?? 0) / limit),
        },
      };
    } catch (error) {
      console.error('Error in getAllTickets:', error);
      return {
        tickets: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  // Admin: Get ticket details
  async getTicketDetails(ticketId: string) {
    try {
      this.ensureSupportTicketModel();
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
              total: true,
              createdAt: true,
              items: {
                take: 5,
                include: {
                  product: {
                    select: {
                      name: true,
                      images: { take: 1, orderBy: { order: 'asc' } },
                    },
                  },
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }).catch(() => null);

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      return ticket;
    } catch (error) {
      console.error('Error in getTicketDetails:', error);
      throw error;
    }
  }

  // Admin: Assign ticket
  async assignTicket(ticketId: string, adminId: string) {
    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        adminId,
        status: TicketStatus.IN_PROGRESS,
      },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return ticket;
  }

  // Admin: Add admin message
  async addAdminMessage(
    ticketId: string,
    adminId: string,
    message: string,
    options?: {
      source?: 'CUSTOMER' | 'ADMIN' | 'AI_DRAFT' | 'AI_SENT';
    }
  ) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Auto-assign if not assigned
    const updateData: Prisma.SupportTicketUpdateInput = {
      messages: {
        create: {
          userId: adminId,
          message,
          isAdmin: true,
          source: options?.source ?? 'ADMIN',
        },
      },
    };

    if (!ticket.adminId) {
      updateData.adminId = adminId;
    }

    if (ticket.status === TicketStatus.OPEN) {
      updateData.status = TicketStatus.IN_PROGRESS;
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return updatedTicket;
  }

  // Admin: Update ticket status
  async updateTicketStatus(ticketId: string, status: TicketStatus) {
    const updateData: Prisma.SupportTicketUpdateInput = {
      status,
    };

    if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
      updateData.resolvedAt = new Date();
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return ticket;
  }

  // Admin: Get ticket statistics
  async getTicketStats() {
    try {
      // Ensure prisma.supportTicket exists
      if (!prisma.supportTicket) {
        throw new Error('SupportTicket model not available in Prisma client');
      }

      const [
        total,
        open,
        inProgress,
        resolved,
        closed,
      ] = await Promise.all([
        prisma.supportTicket.count().catch(() => 0),
        prisma.supportTicket.count({ where: { status: TicketStatus.OPEN } }).catch(() => 0),
        prisma.supportTicket.count({ where: { status: TicketStatus.IN_PROGRESS } }).catch(() => 0),
        prisma.supportTicket.count({ where: { status: TicketStatus.RESOLVED } }).catch(() => 0),
        prisma.supportTicket.count({ where: { status: TicketStatus.CLOSED } }).catch(() => 0),
      ]);

      return {
        total: total ?? 0,
        open: open ?? 0,
        inProgress: inProgress ?? 0,
        resolved: resolved ?? 0,
        closed: closed ?? 0,
      };
    } catch (error) {
      // Log error for debugging but return default values
      console.error('Error fetching ticket stats:', error);
      return {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
      };
    }
  }
}

export const ticketService = new TicketService();
