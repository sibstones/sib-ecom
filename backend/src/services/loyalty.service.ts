import prisma from '../config/database';
import { settingsService } from './settings.service';
import { DEFAULT_SETTINGS } from '../types/settings';

export class LoyaltyService {
  async getRates(): Promise<{ earnPerUnit: number; spendPerUnit: number }> {
    const settings = await settingsService.getAllSettings();
    const earnPerUnit = Number(settings.loyaltyPointsEarnPerUnit ?? DEFAULT_SETTINGS.loyaltyPointsEarnPerUnit) || 1;
    const spendPerUnit = Number(settings.loyaltyPointsSpendPerUnit ?? DEFAULT_SETTINGS.loyaltyPointsSpendPerUnit) || 100;
    return { earnPerUnit, spendPerUnit };
  }

  async getPoints(userId: string) {
    let loyaltyPoints = await prisma.loyaltyPoints.findUnique({
      where: { userId },
      include: {
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!loyaltyPoints) {
      loyaltyPoints = await prisma.loyaltyPoints.create({
        data: {
          userId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
        },
        include: {
          transactions: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return loyaltyPoints;
  }

  async earnPoints(userId: string, orderId: string, orderTotal: number) {
    const { earnPerUnit } = await this.getRates();
    const pointsEarned = Math.floor(orderTotal * earnPerUnit);

    let loyaltyPoints = await prisma.loyaltyPoints.findUnique({
      where: { userId },
    });

    if (!loyaltyPoints) {
      loyaltyPoints = await prisma.loyaltyPoints.create({
        data: {
          userId,
          balance: pointsEarned,
          totalEarned: pointsEarned,
          totalSpent: 0,
        },
      });
    } else {
      loyaltyPoints = await prisma.loyaltyPoints.update({
        where: { userId },
        data: {
          balance: { increment: pointsEarned },
          totalEarned: { increment: pointsEarned },
        },
      });
    }

    // Create transaction record
    await prisma.loyaltyTransaction.create({
      data: {
        loyaltyPointsId: loyaltyPoints.id,
        orderId,
        points: pointsEarned,
        type: 'EARNED',
        description: `Earned ${pointsEarned} points from order`,
      },
    });

    return loyaltyPoints;
  }

  async spendPoints(userId: string, points: number, orderId?: string) {
    const loyaltyPoints = await prisma.loyaltyPoints.findUnique({
      where: { userId },
    });

    if (!loyaltyPoints || loyaltyPoints.balance < points) {
      throw new Error('Insufficient loyalty points');
    }

    const updated = await prisma.loyaltyPoints.update({
      where: { userId },
      data: {
        balance: { decrement: points },
        totalSpent: { increment: points },
      },
    });

    // Create transaction record
    await prisma.loyaltyTransaction.create({
      data: {
        loyaltyPointsId: loyaltyPoints.id,
        orderId,
        points: -points,
        type: 'SPENT',
        description: `Spent ${points} points`,
      },
    });

    return updated;
  }

  async pointsToDollars(points: number): Promise<number> {
    const { spendPerUnit } = await this.getRates();
    return points / spendPerUnit;
  }

  async dollarsToPoints(dollars: number): Promise<number> {
    const { spendPerUnit } = await this.getRates();
    return Math.floor(dollars * spendPerUnit);
  }
}

export const loyaltyService = new LoyaltyService();
