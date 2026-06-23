import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export class PartnerService {
  // Get all partners
  async getAllPartners(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;
    
    const where: Prisma.UserWhereInput = {
      isPartner: true,
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [partners, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isPartner: true,
          partnerStatus: true,
          createdAt: true,
          _count: {
            select: {
              partnerPromoCodes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      partners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get partner by ID
  async getPartnerById(partnerId: string) {
    const partner = await prisma.user.findUnique({
      where: {
        id: partnerId,
        isPartner: true,
      },
      include: {
        partnerPromoCodes: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
            usedCount: true,
            usageLimit: true,
            isActive: true,
            createdAt: true,
          },
        },
        partnerCommissions: {
          select: {
            id: true,
            orderId: true,
            orderTotal: true,
            commissionAmount: true,
            status: true,
            createdAt: true,
          },
        },
        partnerPayouts: {
          select: {
            id: true,
            amount: true,
            status: true,
            requestedAt: true,
            approvedAt: true,
            paidAt: true,
          },
          orderBy: { requestedAt: 'desc' },
        },
      },
    });

    if (!partner) {
      throw new Error('Partner not found');
    }

    return partner;
  }

  // Assign partner status to user
  async assignPartner(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' = 'ACTIVE') {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isPartner: true,
        partnerStatus: status,
      },
    });
  }

  // Remove partner status
  async removePartner(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isPartner: false,
        partnerStatus: null,
      },
    });
  }

  // Update partner status
  async updatePartnerStatus(partnerId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    return prisma.user.update({
      where: {
        id: partnerId,
        isPartner: true,
      },
      data: {
        partnerStatus: status,
      },
    });
  }

  // Get partner statistics
  async getPartnerStats(partnerId: string) {
    const partner = await prisma.user.findUnique({
      where: {
        id: partnerId,
        isPartner: true,
      },
      include: {
        partnerPromoCodes: {
          select: {
            id: true,
            code: true,
            usedCount: true,
          },
        },
        partnerCommissions: {
          select: {
            commissionAmount: true,
            status: true,
          },
        },
      },
    });

    if (!partner) {
      throw new Error('Partner not found');
    }

    // Get orders count and value separately
    const ordersData = await prisma.order.findMany({
      where: {
        promoCode: {
          isPartnerPromo: true,
          partnerId: partnerId,
        },
      },
      select: {
        id: true,
        total: true,
      },
    });

    const totalOrders = ordersData.length;
    const totalOrdersValue = ordersData.reduce(
      (sum: number, order: { total: any }) => sum + Number(order.total),
      0
    );

    const commissionsByStatus = partner.partnerCommissions.reduce(
      (acc, commission) => {
        const status = commission.status;
        if (!acc[status]) {
          acc[status] = { count: 0, amount: 0 };
        }
        acc[status].count++;
        acc[status].amount += Number(commission.commissionAmount);
        return acc;
      },
      {} as Record<string, { count: number; amount: number }>
    );

    const totalCommissions = partner.partnerCommissions.reduce(
      (sum, commission) => sum + Number(commission.commissionAmount),
      0
    );

    const availableForPayout = commissionsByStatus['PENDING']?.amount || 0;
    const paidCommissions = commissionsByStatus['PAID']?.amount || 0;

    return {
      partner: {
        id: partner.id,
        email: partner.email,
        firstName: partner.firstName,
        lastName: partner.lastName,
        partnerStatus: partner.partnerStatus,
      },
      stats: {
        totalPromoCodes: partner.partnerPromoCodes.length,
        totalOrders,
        totalOrdersValue,
        totalCommissions,
        availableForPayout,
        paidCommissions,
        commissionsByStatus,
      },
    };
  }

  // Get partner's own promo codes (for link builder: list active codes by code)
  async getOwnPromoCodes(partnerId: string) {
    const now = new Date();
    const list = await prisma.promoCode.findMany({
      where: {
        partnerId,
        isPartnerPromo: true,
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      select: {
        id: true,
        code: true,
        discountType: true,
        discountValue: true,
        usageLimit: true,
        usedCount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return list.filter(
      (p) => p.usageLimit == null || (p.usedCount ?? 0) < p.usageLimit
    );
  }

  // Get partner orders
  async getPartnerOrders(partnerId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      promoCode: {
        isPartnerPromo: true,
        partnerId: partnerId,
      },
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          promoCode: {
            select: {
              id: true,
              code: true,
            },
          },
          partnerCommissions: {
            where: {
              partnerId: partnerId,
            },
            select: {
              id: true,
              commissionAmount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const partnerService = new PartnerService();
