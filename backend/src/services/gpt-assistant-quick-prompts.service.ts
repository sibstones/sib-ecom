import prisma from '../config/database';

/** Canonical Try asking suggestions; keep in sync with `gptAssistant.quickPrompts.*` in frontend i18n. */
const DEFAULT_ADMIN_QUICK_PROMPTS = [
  'What are our new orders and what needs to be done?',
  'Show problematic orders: overdue, returns, disputes',
  'Payment stats and payment requests for the past week',
  'Return requests: list and statuses',
  "What's selling? Which items are low in stock?",
  'Popular social posts this month',
];

const DEFAULT_CUSTOMER_QUICK_PROMPTS = [
  'Help me choose the right size for a product',
  'How do I care for this item?',
  'What goes with this? Help me put together an outfit',
];

async function seedQuickPromptsForType(type: 'quick_admin' | 'quick_customer', texts: string[]): Promise<void> {
  await Promise.all(
    texts.map(async (prompt, index) => {
      const version = `default_${index + 1}`;
      const existing = await prisma.gPTAssistantPrompt.findFirst({
        where: { type, version },
      });
      if (existing) return;

      await prisma.gPTAssistantPrompt.create({
        data: {
          type,
          prompt,
          version,
          isActive: true,
          isDefault: true,
          sortOrder: index,
          comment: 'Default Try asking suggestion',
        },
      });
    })
  );
}

/** Ensure built-in Try asking suggestions exist as editable prompt rows without overwriting edits. */
export async function ensureDefaultQuickPrompts(): Promise<void> {
  await seedQuickPromptsForType('quick_admin', DEFAULT_ADMIN_QUICK_PROMPTS);
  await seedQuickPromptsForType('quick_customer', DEFAULT_CUSTOMER_QUICK_PROMPTS);
}
