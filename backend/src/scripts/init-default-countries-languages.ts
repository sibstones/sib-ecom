import prisma from '../config/database';

/**
 * Default languages data based on supported translations
 * All languages will be created with isActive: false (or overridden in seed)
 */
export const defaultLanguages = [
  { code: 'en', name: 'English', nameNative: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Russian', nameNative: 'Русский', flag: '🇷🇺' },
  { code: 'fr', name: 'French', nameNative: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nameNative: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', nameNative: 'Español', flag: '🇪🇸' },
  { code: 'ja', name: 'Japanese', nameNative: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', nameNative: '中文', flag: '🇨🇳' },
  { code: 'ko', name: 'Korean', nameNative: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nameNative: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nameNative: 'हिन्दी', flag: '🇮🇳' },
  { code: 'it', name: 'Italian', nameNative: 'Italiano', flag: '🇮🇹' },
];

/**
 * Default countries data based on supported languages
 * All countries will be created with isActive: false (or overridden in seed)
 */
export const defaultCountries = [
  // English-speaking countries
  { code: 'US', name: 'United States', nameNative: 'United States', currency: 'USD', language: 'en', taxRate: 0.08, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'GB', name: 'United Kingdom', nameNative: 'United Kingdom', currency: 'GBP', language: 'en', taxRate: 0.2, shippingCost: 8, freeShippingThreshold: 80 },
  { code: 'CA', name: 'Canada', nameNative: 'Canada', currency: 'CAD', language: 'en', taxRate: 0.13, shippingCost: 12, freeShippingThreshold: 100 },
  { code: 'AU', name: 'Australia', nameNative: 'Australia', currency: 'AUD', language: 'en', taxRate: 0.1, shippingCost: 15, freeShippingThreshold: 120 },
  { code: 'NZ', name: 'New Zealand', nameNative: 'New Zealand', currency: 'NZD', language: 'en', taxRate: 0.15, shippingCost: 15, freeShippingThreshold: 120 },
  { code: 'IE', name: 'Ireland', nameNative: 'Éire', currency: 'EUR', language: 'en', taxRate: 0.23, shippingCost: 10, freeShippingThreshold: 100 },
  
  // Russian-speaking countries
  { code: 'RU', name: 'Russia', nameNative: 'Россия', currency: 'RUB', language: 'ru', taxRate: 0.1, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'BY', name: 'Belarus', nameNative: 'Беларусь', currency: 'BYN', language: 'ru', taxRate: 0.2, shippingCost: 8, freeShippingThreshold: 80 },
  { code: 'KZ', name: 'Kazakhstan', nameNative: 'Қазақстан', currency: 'KZT', language: 'ru', taxRate: 0.12, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'UA', name: 'Ukraine', nameNative: 'Україна', currency: 'UAH', language: 'ru', taxRate: 0.2, shippingCost: 8, freeShippingThreshold: 80 },
  
  // French-speaking countries
  { code: 'FR', name: 'France', nameNative: 'France', currency: 'EUR', language: 'fr', taxRate: 0.2, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'BE', name: 'Belgium', nameNative: 'België', currency: 'EUR', language: 'fr', taxRate: 0.21, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'CH', name: 'Switzerland', nameNative: 'Schweiz', currency: 'CHF', language: 'fr', taxRate: 0.077, shippingCost: 12, freeShippingThreshold: 120 },
  { code: 'LU', name: 'Luxembourg', nameNative: 'Luxembourg', currency: 'EUR', language: 'fr', taxRate: 0.17, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'MC', name: 'Monaco', nameNative: 'Monaco', currency: 'EUR', language: 'fr', taxRate: 0.2, shippingCost: 10, freeShippingThreshold: 100 },
  
  // German-speaking countries
  { code: 'DE', name: 'Germany', nameNative: 'Deutschland', currency: 'EUR', language: 'de', taxRate: 0.19, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'AT', name: 'Austria', nameNative: 'Österreich', currency: 'EUR', language: 'de', taxRate: 0.2, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'LI', name: 'Liechtenstein', nameNative: 'Liechtenstein', currency: 'CHF', language: 'de', taxRate: 0.077, shippingCost: 10, freeShippingThreshold: 100 },
  
  // Spanish-speaking countries
  { code: 'ES', name: 'Spain', nameNative: 'España', currency: 'EUR', language: 'es', taxRate: 0.21, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'MX', name: 'Mexico', nameNative: 'México', currency: 'MXN', language: 'es', taxRate: 0.16, shippingCost: 12, freeShippingThreshold: 100 },
  { code: 'AR', name: 'Argentina', nameNative: 'Argentina', currency: 'ARS', language: 'es', taxRate: 0.21, shippingCost: 15, freeShippingThreshold: 120 },
  { code: 'CO', name: 'Colombia', nameNative: 'Colombia', currency: 'COP', language: 'es', taxRate: 0.19, shippingCost: 12, freeShippingThreshold: 100 },
  { code: 'CL', name: 'Chile', nameNative: 'Chile', currency: 'CLP', language: 'es', taxRate: 0.19, shippingCost: 12, freeShippingThreshold: 100 },
  { code: 'PE', name: 'Peru', nameNative: 'Perú', currency: 'PEN', language: 'es', taxRate: 0.18, shippingCost: 12, freeShippingThreshold: 100 },
  
  // Japanese-speaking countries
  { code: 'JP', name: 'Japan', nameNative: '日本', currency: 'JPY', language: 'ja', taxRate: 0.1, shippingCost: 10, freeShippingThreshold: 100 },
  
  // Chinese-speaking countries/regions
  { code: 'CN', name: 'China', nameNative: '中国', currency: 'CNY', language: 'zh', taxRate: 0.13, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'TW', name: 'Taiwan', nameNative: '台灣', currency: 'TWD', language: 'zh', taxRate: 0.05, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'HK', name: 'Hong Kong', nameNative: '香港', currency: 'HKD', language: 'zh', taxRate: 0, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'SG', name: 'Singapore', nameNative: 'Singapore', currency: 'SGD', language: 'zh', taxRate: 0.09, shippingCost: 8, freeShippingThreshold: 100 },
  
  // Korean-speaking countries
  { code: 'KR', name: 'South Korea', nameNative: '대한민국', currency: 'KRW', language: 'ko', taxRate: 0.1, shippingCost: 10, freeShippingThreshold: 100 },
  
  // Arabic-speaking countries
  { code: 'SA', name: 'Saudi Arabia', nameNative: 'السعودية', currency: 'SAR', language: 'ar', taxRate: 0.15, shippingCost: 12, freeShippingThreshold: 100 },
  { code: 'AE', name: 'United Arab Emirates', nameNative: 'الإمارات العربية المتحدة', currency: 'AED', language: 'ar', taxRate: 0.05, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'EG', name: 'Egypt', nameNative: 'مصر', currency: 'EGP', language: 'ar', taxRate: 0.14, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'JO', name: 'Jordan', nameNative: 'الأردن', currency: 'JOD', language: 'ar', taxRate: 0.16, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'KW', name: 'Kuwait', nameNative: 'الكويت', currency: 'KWD', language: 'ar', taxRate: 0, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'QA', name: 'Qatar', nameNative: 'قطر', currency: 'QAR', language: 'ar', taxRate: 0, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'BH', name: 'Bahrain', nameNative: 'البحرين', currency: 'BHD', language: 'ar', taxRate: 0.1, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'OM', name: 'Oman', nameNative: 'عُمان', currency: 'OMR', language: 'ar', taxRate: 0.05, shippingCost: 10, freeShippingThreshold: 100 },
  
  // Hindi-speaking countries
  { code: 'IN', name: 'India', nameNative: 'भारत', currency: 'INR', language: 'hi', taxRate: 0.18, shippingCost: 8, freeShippingThreshold: 100 },
  
  // Italian-speaking countries
  { code: 'IT', name: 'Italy', nameNative: 'Italia', currency: 'EUR', language: 'it', taxRate: 0.22, shippingCost: 8, freeShippingThreshold: 100 },
  { code: 'SM', name: 'San Marino', nameNative: 'San Marino', currency: 'EUR', language: 'it', taxRate: 0, shippingCost: 10, freeShippingThreshold: 100 },
  { code: 'VA', name: 'Vatican City', nameNative: 'Città del Vaticano', currency: 'EUR', language: 'it', taxRate: 0, shippingCost: 10, freeShippingThreshold: 100 },
];

/**
 * Initialize default languages and countries
 * Creates languages and countries that don't exist yet
 * All entries are created with isActive: false
 */
export async function initDefaultCountriesLanguages(): Promise<void> {
  try {
    console.log('🌍 Initializing default languages and countries...');

    // Initialize languages
    console.log('\n📝 Initializing languages...');
    let languagesCreated = 0;
    let languagesSkipped = 0;

    for (const langData of defaultLanguages) {
      const existing = await prisma.language.findUnique({
        where: { code: langData.code },
      });

      if (existing) {
        console.log(`  ℹ️  Language ${langData.code} (${langData.name}) already exists`);
        languagesSkipped++;
        continue;
      }

      await prisma.language.create({
        data: {
          code: langData.code,
          name: langData.name,
          nameNative: langData.nameNative,
          flag: langData.flag,
          isActive: false, // All languages are inactive by default
          isDefault: false,
          sortOrder: 0,
        },
      });

      console.log(`  ✅ Created language: ${langData.code} (${langData.name})`);
      languagesCreated++;
    }

    console.log(`\n📊 Languages: ${languagesCreated} created, ${languagesSkipped} already existed`);

    // Initialize countries
    console.log('\n🌎 Initializing countries...');
    let countriesCreated = 0;
    let countriesSkipped = 0;

    for (const countryData of defaultCountries) {
      const existing = await prisma.country.findUnique({
        where: { code: countryData.code },
      });

      if (existing) {
        console.log(`  ℹ️  Country ${countryData.code} (${countryData.name}) already exists`);
        countriesSkipped++;
        continue;
      }

      await prisma.country.create({
        data: {
          code: countryData.code,
          name: countryData.name,
          nameNative: countryData.nameNative,
          currency: countryData.currency,
          language: countryData.language,
          taxRate: countryData.taxRate,
          shippingCost: countryData.shippingCost,
          freeShippingThreshold: countryData.freeShippingThreshold,
          isActive: false, // All countries are inactive by default
          isDefault: false,
          sortOrder: 0,
        },
      });

      console.log(`  ✅ Created country: ${countryData.code} (${countryData.name})`);
      countriesCreated++;
    }

    console.log(`\n📊 Countries: ${countriesCreated} created, ${countriesSkipped} already existed`);
    console.log('\n✅ Default countries and languages initialization completed');
  } catch (error) {
    console.error('❌ Failed to initialize default countries and languages:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initDefaultCountriesLanguages()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}
