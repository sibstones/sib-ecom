import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Use test database if specified
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

beforeAll(async () => {
  // Ensure Prisma client is ready
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up data before each test
  // Delete in reverse order of dependencies
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.loyaltyPoints.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.paymentRequest.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productReview.deleteMany();
  await prisma.productTranslation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.categoryTranslation.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.session.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.messengerContact.deleteMany();
  await prisma.supportTicket.deleteMany();
  // Note: ReturnRequest might not exist in all Prisma schemas
  try {
    await (prisma as any).returnRequestItem?.deleteMany();
    await (prisma as any).returnRequest?.deleteMany();
  } catch (e) {
    // Ignore if model doesn't exist
  }
  await prisma.adminActivityLog.deleteMany();
  await prisma.adminPermissions.deleteMany();
  await prisma.user.deleteMany();
});
