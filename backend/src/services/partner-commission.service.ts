import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export class PartnerCommissionService {
  // Create commission when order is paid
  async createCommission(
    partnerId: string,
    orderId: string,
    promoCodeId: string,
    orderTotal: number,
    commissionRate: number
  ) {
    const commissionAmount = (orderTotal * commissionRate) / 100;

    // Check if commission already exists for this order
    const existing = await prisma.partnerCommission.findFirst({
      where: {
        orderId,
        partnerId,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.partnerCommission.create({
      data: {
        partnerId,
        orderId,
        promoCodeId,
        orderTotal: new Prisma.Decimal(orderTotal),
        commissionRate: new Prisma.Decimal(commissionRate),
        commissionAmount: new Prisma.Decimal(commissionAmount),
        status: 'PENDING',
      },
    });
  }

  // Get partner commissions
  async getPartnerCommissions(
    partnerId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.PartnerCommissionWhereInput = {
      partnerId,
      ...(status && { status }),
    };

    const [commissions, total] = await Promise.all([
      prisma.partnerCommission.findMany({
        where,
        skip,
        take: limit,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              createdAt: true,
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          promoCode: {
            select: {
              id: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.partnerCommission.count({ where }),
    ]);

    return {
      commissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get commission statistics for partner
  async getCommissionStats(partnerId: string) {
    const commissions = await prisma.partnerCommission.findMany({
      where: { partnerId },
      select: {
        commissionAmount: true,
        status: true,
      },
    });

    const stats = commissions.reduce(
      (acc, commission) => {
        const status = commission.status;
        const amount = Number(commission.commissionAmount);

        if (!acc[status]) {
          acc[status] = { count: 0, amount: 0 };
        }
        acc[status].count++;
        acc[status].amount += amount;
        return acc;
      },
      {} as Record<string, { count: number; amount: number }>
    );

    const total = commissions.reduce(
      (sum, commission) => sum + Number(commission.commissionAmount),
      0
    );

    return {
      stats,
      total,
      totalCount: commissions.length,
    };
  }

  // Get available commissions for payout (PENDING and not in any payout)
  async getAvailableCommissions(partnerId: string) {
    return prisma.partnerCommission.findMany({
      where: {
        partnerId,
        status: 'PENDING',
        payoutId: null,
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            total: true,
            createdAt: true,
          },
        },
        promoCode: {
          select: {
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Update commission status
  async updateCommissionStatus(commissionId: string, status: 'PENDING' | 'PAID' | 'CANCELLED') {
    return prisma.partnerCommission.update({
      where: { id: commissionId },
      data: { status },
    });
  }

  // Link commissions to payout
  async linkCommissionsToPayout(commissionIds: string[], payoutId: string) {
    return prisma.partnerCommission.updateMany({
      where: {
        id: { in: commissionIds },
        status: 'PENDING',
        payoutId: null,
      },
      data: {
        payoutId,
      },
    });
  }

  // Mark commissions as paid when payout is paid
  async markCommissionsAsPaid(payoutId: string) {
    return prisma.partnerCommission.updateMany({
      where: {
        payoutId,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
      },
    });
  }

  // Cancel commission (e.g., when order is refunded)
  async cancelCommission(commissionId: string) {
    return prisma.partnerCommission.update({
      where: { id: commissionId },
      data: { status: 'CANCELLED' },
    });
  }
}

export const partnerCommissionService = new PartnerCommissionService();
