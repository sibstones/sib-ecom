import prisma from '../config/database';
import { config } from '../config/env';

async function initGPTAssistantSettings() {
  try {
    console.log('Initializing GPT Assistant settings...');

    // Check if settings already exist
    const existing = await prisma.gPTAssistantSettings.findFirst();
    
    if (existing) {
      console.log('GPT Assistant settings already exist. Skipping initialization.');
      return;
    }

    // Create default settings
    const settings = await prisma.gPTAssistantSettings.create({
      data: {
        enabledAdmin: true,
        enabledCustomer: true,
        enabledGuest: false,
        mode: 'production',
        logLevel: 'info',
        providerType: 'openai',
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.7,
        contextWindow: 10,
        timeout: 30000,
        adminMaxResponseLength: 2000,
        adminEnableSuggestions: true,
        adminEnableQuickActions: true,
        adminDetailLevel: 'detailed',
        customerMaxResponseLength: 1500,
        customerEnableSuggestions: true,
        customerEnableQuickActions: true,
        customerTone: 'friendly',
        customerEnableRecommendations: true,
        customerEnableContextHelp: true,
        rateLimitAdmin: config.rateLimit.defaultMax,
        rateLimitCustomer: config.rateLimit.defaultMax,
        rateLimitGuest: config.rateLimit.defaultMax,
        blockOnLimitExceeded: true,
        filterContent: true,
        checkPermissions: true,
        logAllRequests: true,
        anonymizeLogs: false,
        enableCache: true,
        cacheTTL: 3600,
        cacheFrequentQueries: true,
        maxCacheSize: 100,
      },
    });

    console.log('✅ GPT Assistant settings initialized successfully!');
    console.log('Settings ID:', settings.id);
    console.log('\n⚠️  Don\'t forget to:');
    console.log('1. Set OPENAI_API_KEY in .env file');
    console.log('2. Update settings.apiKey in database with your OpenAI API key');
    console.log('3. Run database migration: npm run prisma:migrate');
  } catch (error) {
    console.error('❌ Failed to initialize GPT Assistant settings:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initGPTAssistantSettings();
