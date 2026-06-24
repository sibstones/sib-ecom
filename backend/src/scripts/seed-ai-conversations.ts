import prisma from '../config/database';
import { UserRole } from '@prisma/client';

async function getAdminUser() {
  return prisma.user.findFirst({
    where: {
      role: {
        in: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
      },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
}

async function getCustomerByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

async function recreateConversation(title: string) {
  const existing = await (prisma as any).aiConversation.findMany({
    where: { title },
    select: { id: true },
  });

  if (existing.length > 0) {
    await (prisma as any).aiConversation.deleteMany({
      where: {
        id: {
          in: existing.map((item: { id: string }) => item.id),
        },
      },
    });
  }
}

async function seedAdminConversation(adminId: string) {
  const conversation = await (prisma as any).aiConversation.create({
    data: {
      channel: 'ADMIN',
      status: 'OPEN',
      adminId,
      title: 'Seeded AI Admin Chat: order triage',
      language: 'en',
      topicLabel: 'Operations',
      summary: 'Seeded admin conversation about pending orders and return requests.',
      lastIntent: 'ORDER_SEARCH',
      lastMessageAt: new Date('2026-06-24T08:15:00.000Z'),
      messages: {
        create: [
          {
            role: 'USER',
            actorUserId: adminId,
            content: 'Show me orders that need attention today and any open return requests.',
            intent: 'ORDER_SEARCH',
            createdAt: new Date('2026-06-24T08:12:00.000Z'),
          },
          {
            role: 'ASSISTANT',
            content:
              'I found one processing order awaiting payment and one return request for SHOWCASE-1001. I can open returns or payment requests next.',
            intent: 'ORDER_SEARCH',
            toolData: {
              orders: ['SHOWCASE-1002'],
              returnRequests: ['SHOWCASE-1001'],
            },
            createdAt: new Date('2026-06-24T08:12:03.000Z'),
          },
          {
            role: 'USER',
            actorUserId: adminId,
            content: 'Prepare a short summary for the support team.',
            intent: 'REPORT_GENERATE',
            createdAt: new Date('2026-06-24T08:14:30.000Z'),
          },
          {
            role: 'ASSISTANT',
            content:
              'Support summary: Marco Showcase has a payment-pending order SHOWCASE-1002, and Alice Showcase has an open return request on SHOWCASE-1001 awaiting processing.',
            intent: 'REPORT_GENERATE',
            createdAt: new Date('2026-06-24T08:15:00.000Z'),
          },
        ],
      },
      executions: {
        create: [
          {
            actionId: 'ORDER_SEARCH',
            status: 'EXECUTED',
            permissionChecked: true,
            confirmationRequired: false,
            arguments: {
              query: 'orders needing attention and open return requests',
            },
            resultData: {
              orders: 1,
              returns: 1,
            },
            createdAt: new Date('2026-06-24T08:12:03.000Z'),
          },
          {
            actionId: 'REPORT_GENERATE',
            status: 'NOOP',
            permissionChecked: true,
            confirmationRequired: false,
            arguments: {
              format: 'summary',
            },
            resultData: {
              delivered: true,
            },
            createdAt: new Date('2026-06-24T08:15:00.000Z'),
          },
        ],
      },
    },
  });

  console.log(`  ✅ ${conversation.title}`);
}

async function seedCustomerConversation(customerId: string) {
  const conversation = await (prisma as any).aiConversation.create({
    data: {
      channel: 'CUSTOMER',
      status: 'WAITING_FOR_ADMIN',
      userId: customerId,
      title: 'Seeded AI Customer Chat: shipping update',
      language: 'en',
      topicLabel: 'Order tracking',
      summary: 'Seeded customer conversation waiting for admin follow-up on a delayed shipment.',
      lastIntent: 'CUSTOMER_ORDER_TRACK',
      lastMessageAt: new Date('2026-06-24T09:05:00.000Z'),
      escalatedAt: new Date('2026-06-24T09:05:00.000Z'),
      messages: {
        create: [
          {
            role: 'USER',
            actorUserId: customerId,
            content: 'Where is my order SHOWCASE-1001? I have not seen any tracking updates since last week.',
            intent: 'CUSTOMER_ORDER_TRACK',
            createdAt: new Date('2026-06-24T09:00:00.000Z'),
          },
          {
            role: 'ASSISTANT',
            content:
              'Your order SHOWCASE-1001 is marked as shipped, but I could not confirm a fresh carrier scan. I am escalating this to the support team for a manual check.',
            intent: 'CUSTOMER_ORDER_TRACK',
            toolData: {
              orderNumber: 'SHOWCASE-1001',
              escalationSuggested: true,
            },
            createdAt: new Date('2026-06-24T09:00:04.000Z'),
          },
          {
            role: 'USER',
            actorUserId: customerId,
            content: 'Please ask them to email me once they confirm the delivery status.',
            intent: 'HELP',
            createdAt: new Date('2026-06-24T09:05:00.000Z'),
          },
        ],
      },
      executions: {
        create: [
          {
            actionId: 'CUSTOMER_ORDER_TRACK',
            status: 'FAILED',
            permissionChecked: false,
            confirmationRequired: false,
            arguments: {
              orderNumber: 'SHOWCASE-1001',
            },
            resultData: {
              fallback: 'manual_escalation',
            },
            errorCode: 'TRACKING_STALE',
            errorMessage: 'Carrier did not provide a recent scan.',
            createdAt: new Date('2026-06-24T09:00:04.000Z'),
          },
        ],
      },
    },
  });

  console.log(`  ✅ ${conversation.title}`);
}

async function seedGuestConversation() {
  const conversation = await (prisma as any).aiConversation.create({
    data: {
      channel: 'CUSTOMER',
      status: 'RESOLVED',
      guestSessionId: 'seeded-guest-session-fashion',
      title: 'Seeded AI Guest Chat: size recommendation',
      language: 'en',
      topicLabel: 'Product advice',
      summary: 'Seeded guest conversation resolved with a size recommendation.',
      lastIntent: 'CUSTOMER_PRODUCT_INFO',
      lastMessageAt: new Date('2026-06-24T10:20:00.000Z'),
      resolvedAt: new Date('2026-06-24T10:20:00.000Z'),
      messages: {
        create: [
          {
            role: 'USER',
            content: 'Is the Showcase Trench Coat better in size S or M if I want room for layering?',
            intent: 'CUSTOMER_PRODUCT_INFO',
            createdAt: new Date('2026-06-24T10:19:00.000Z'),
          },
          {
            role: 'ASSISTANT',
            content:
              'If you want extra room for layering, size M is the safer choice. If you prefer a closer fit, choose S.',
            intent: 'CUSTOMER_PRODUCT_INFO',
            toolData: {
              productSlug: 'showcase-trench-coat',
            },
            createdAt: new Date('2026-06-24T10:20:00.000Z'),
          },
        ],
      },
      executions: {
        create: [
          {
            actionId: 'CUSTOMER_PRODUCT_INFO',
            status: 'NOOP',
            permissionChecked: false,
            confirmationRequired: false,
            arguments: {
              productSlug: 'showcase-trench-coat',
              sizeQuestion: true,
            },
            resultData: {
              recommendation: 'M',
            },
            createdAt: new Date('2026-06-24T10:20:00.000Z'),
          },
        ],
      },
    },
  });

  console.log(`  ✅ ${conversation.title}`);
}

async function main() {
  if (!(prisma as any).aiConversation || !(prisma as any).aiConversationMessage) {
    throw new Error('AI conversation models are not available in Prisma client');
  }

  console.log('🤖 Seeding AI conversations...');

  const admin = await getAdminUser();
  if (!admin) {
    throw new Error('No admin user found. Run init-admins or start the backend first.');
  }

  const showcaseCustomer = await getCustomerByEmail('showcase.customer1@fashion.local');
  if (!showcaseCustomer) {
    throw new Error('Showcase customer not found. Run seed:dev-showcase first.');
  }

  const titles = [
    'Seeded AI Admin Chat: order triage',
    'Seeded AI Customer Chat: shipping update',
    'Seeded AI Guest Chat: size recommendation',
  ];

  for (const title of titles) {
    await recreateConversation(title);
  }

  await seedAdminConversation(admin.id);
  await seedCustomerConversation(showcaseCustomer.id);
  await seedGuestConversation();

  console.log('✅ AI conversation seed completed.');
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed AI conversations:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
