import { loyaltyService } from '../../services/loyalty.service';
import { TestHelpers } from '../helpers/test-helpers';

describe('LoyaltyService', () => {
  let user: any;

  beforeEach(async () => {
    user = await TestHelpers.createUser({ email: 'loyalty@example.com' });
  });

  describe('getPoints', () => {
    it('should return zero points for new user', async () => {
      const points = await loyaltyService.getPoints(user.id);

      expect(points.balance).toBe(0);
      expect(points.totalEarned).toBe(0);
      expect(points.totalSpent).toBe(0);
    });

    it('should create loyalty points record if not exists', async () => {
      const points = await loyaltyService.getPoints(user.id);

      expect(points).toBeDefined();
      expect(points.userId).toBe(user.id);
    });
  });

  describe('earnPoints', () => {
    it('should earn points based on order total', async () => {
      const orderTotal = 100; // $100
      const orderId = 'order-123';

      const result = await loyaltyService.earnPoints(user.id, orderId, orderTotal);

      // 1 point per dollar, so 100 points
      expect(result.balance).toBe(100);
      expect(result.totalEarned).toBe(100);
      expect(result.totalSpent).toBe(0);
    });

    it('should accumulate points for multiple orders', async () => {
      await loyaltyService.earnPoints(user.id, 'order-1', 50);
      const result = await loyaltyService.earnPoints(user.id, 'order-2', 75);

      expect(result.balance).toBe(125); // 50 + 75
      expect(result.totalEarned).toBe(125);
    });

    it('should create transaction record', async () => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const points = await loyaltyService.earnPoints(user.id, 'order-123', 100);

      const transactions = await prisma.loyaltyTransaction.findMany({
        where: { loyaltyPointsId: points.id },
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0].points).toBe(100);
      expect(transactions[0].type).toBe('EARNED');
      expect(transactions[0].orderId).toBe('order-123');
    });

    it('should floor points for fractional amounts', async () => {
      const result = await loyaltyService.earnPoints(user.id, 'order-123', 99.99);

      // Should floor to 99 points
      expect(result.balance).toBe(99);
    });
  });

  describe('spendPoints', () => {
    beforeEach(async () => {
      // Setup: user has 200 points
      await loyaltyService.earnPoints(user.id, 'order-1', 200);
    });

    it('should spend points successfully', async () => {
      const result = await loyaltyService.spendPoints(user.id, 50, 'order-2');

      expect(result.balance).toBe(150); // 200 - 50
      expect(result.totalSpent).toBe(50);
    });

    it('should throw error if insufficient points', async () => {
      await expect(
        loyaltyService.spendPoints(user.id, 300, 'order-2')
      ).rejects.toThrow('Insufficient loyalty points');
    });

    it('should create transaction record for spent points', async () => {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const points = await loyaltyService.getPoints(user.id);
      await loyaltyService.spendPoints(user.id, 50, 'order-2');

      const transactions = await prisma.loyaltyTransaction.findMany({
        where: { loyaltyPointsId: points.id },
        orderBy: { createdAt: 'desc' },
      });

      const spentTransaction = transactions.find(t => t.type === 'SPENT');
      expect(spentTransaction).toBeDefined();
      expect(spentTransaction?.points).toBe(-50);
      expect(spentTransaction?.orderId).toBe('order-2');
    });

    it('should maintain correct totals after spending', async () => {
      await loyaltyService.spendPoints(user.id, 75, 'order-2');
      const points = await loyaltyService.getPoints(user.id);

      expect(points.balance).toBe(125); // 200 - 75
      expect(points.totalEarned).toBe(200);
      expect(points.totalSpent).toBe(75);
    });
  });

  describe('pointsToDollars', () => {
    it('should convert points to dollars correctly', async () => {
      // 100 points = $1 discount (default spendPerUnit)
      expect(await loyaltyService.pointsToDollars(100)).toBe(1);
      expect(await loyaltyService.pointsToDollars(200)).toBe(2);
      expect(await loyaltyService.pointsToDollars(50)).toBe(0.5);
    });
  });

  describe('dollarsToPoints', () => {
    it('should convert dollars to points correctly', async () => {
      // $1 = 100 points (default spendPerUnit)
      expect(await loyaltyService.dollarsToPoints(1)).toBe(100);
      expect(await loyaltyService.dollarsToPoints(2)).toBe(200);
      expect(await loyaltyService.dollarsToPoints(0.5)).toBe(50);
    });

    it('should floor fractional dollar amounts', async () => {
      expect(await loyaltyService.dollarsToPoints(1.99)).toBe(199);
      expect(await loyaltyService.dollarsToPoints(0.01)).toBe(1);
    });
  });
});
