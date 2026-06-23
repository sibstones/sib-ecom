import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { partnerCommissionService } from './partner-commission.service';

export class PartnerPayoutService {
  // Create payout request
  async createPayoutRequest(partnerId: string, amount: number, commissionIds: string[]) {
    // Verify that commissions belong to partner and are available
    const commissions = await prisma.partnerCommission.findMany({
      where: {
        id: { in: commissionIds },
        partnerId,
        status: 'PENDING',
        payoutId: null,
      },
    });

    if (commissions.length !== commissionIds.length) {
      throw new Error('Some commissions are not available for payout');
    }

    const totalAmount = commissions.reduce(
      (sum, commission) => sum + Number(commission.commissionAmount),
      0
    );

    if (Math.abs(totalAmount - amount) > 0.01) {
      throw new Error('Payout amount does not match commission amounts');
    }

    // Create payout
    const payout = await prisma.partnerPayout.create({
      data: {
        partnerId,
        amount: new Prisma.Decimal(amount),
        status: 'PENDING',
        commissions: {
          connect: commissionIds.map((id) => ({ id })),
        },
      },
      include: {
        commissions: {
          include: {
            order: {
              select: {
                orderNumber: true,
                total: true,
              },
            },
            promoCode: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    return payout;
  }

  // Get partner payouts
  async getPartnerPayouts(partnerId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      prisma.partnerPayout.findMany({
        where: { partnerId },
        skip,
        take: limit,
        include: {
          commissions: {
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
          },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      prisma.partnerPayout.count({ where: { partnerId } }),
    ]);

    return {
      payouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get all payouts (admin)
  async getAllPayouts(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;

    const where: Prisma.PartnerPayoutWhereInput = {
      ...(status && { status }),
    };

    const [payouts, total] = await Promise.all([
      prisma.partnerPayout.findMany({
        where,
        skip,
        take: limit,
        include: {
          partner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          commissions: {
            include: {
              order: {
                select: {
                  orderNumber: true,
                  total: true,
                },
              },
              promoCode: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      prisma.partnerPayout.count({ where }),
    ]);

    return {
      payouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get payout by ID
  async getPayoutById(payoutId: string) {
    const payout = await prisma.partnerPayout.findUnique({
      where: { id: payoutId },
      include: {
        partner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        commissions: {
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
        },
      },
    });

    if (!payout) {
      throw new Error('Payout not found');
    }

    return payout;
  }

  // Approve payout (admin)
  async approvePayout(payoutId: string, adminNotes?: string) {
    const payout = await prisma.partnerPayout.update({
      where: { id: payoutId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        adminNotes,
      },
      include: {
        commissions: true,
      },
    });

    return payout;
  }

  // Reject payout (admin)
  async rejectPayout(payoutId: string, rejectionReason: string) {
    const payout = await prisma.partnerPayout.update({
      where: { id: payoutId },
      data: {
        status: 'REJECTED',
        rejectionReason,
      },
    });

    // Unlink commissions from payout
    await prisma.partnerCommission.updateMany({
      where: { payoutId },
      data: { payoutId: null },
    });

    return payout;
  }

  // Mark payout as paid (admin)
  async markPayoutAsPaid(payoutId: string) {
    const payout = await prisma.partnerPayout.update({
      where: { id: payoutId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    // Mark commissions as paid
    await partnerCommissionService.markCommissionsAsPaid(payoutId);

    return payout;
  }
}

export const partnerPayoutService = new PartnerPayoutService();
