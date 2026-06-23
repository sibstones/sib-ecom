/**
 * Database seed — default data for first-time setup.
 * Run after: prisma migrate reset (or: migrate deploy + db seed).
 * Admins are created on server start from env (init-admins).
 */
import path from 'path';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { DEFAULT_SETTINGS, defaultLanguages, defaultCountries } from './seed-data';

// Load .env from backend root (when running via tsx prisma/seed.ts)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

function getCategoryForKey(key: string): string {
  if (key.includes('payment') || key.includes('stripe') || key.includes('paypal')) return 'PAYMENT';
  if (key.includes('loyalty')) return 'LOYALTY';
  if (key.includes('filter') || key.includes('search') || key.includes('brand')) return 'UI';
  if (key.includes('font') || key.includes('Font') || key.includes('textTransform') || key.includes('fontSize')) return 'UI';
  if (key.includes('color') || key.includes('Color')) return 'UI';
  if (key.includes('registration') || key.includes('login') || key.includes('password') || key.includes('lockout') || key.includes('RateLimit') || key.includes('verification') || key.includes('captcha') || key.includes('Captcha')) return 'SECURITY';
  if (key.includes('yandexDelivery') || key.includes('deliveryTracking') || key.includes('geocoder')) return 'DELIVERY';
  if (key.includes('deliveryTracking') || key.includes('DeliveryTracking')) return 'DELIVERY';
  if (key.includes('review')) return 'FEATURES';
  if (key.includes('pinterest') || key.includes('Pinterest') || key.includes('frontendBaseUrl')) return 'MARKETING';
  if (key.includes('email') || key.includes('Email')) return 'MARKETING';
  return 'FEATURES';
}

const DEFAULT_HEADER = {
  isActive: true,
  logoType: 'TEXT' as const,
  logoText: 'LOGO',
  logoPosition: 'CENTER' as const,
  logoSize: 'text-2xl',
  logoColor: '#000000',
  logoLink: '/',
  backgroundColor: '#ffffff',
  backgroundOpacity: 92,
  backdropBlur: 12,
  dropdownBackgroundOpacity: 96,
  dropdownBackdropBlur: 16,
  textColor: '#000000',
  borderColor: '#e5e7eb',
  shadowEnabled: true,
  stickyEnabled: true,
  height: 'h-12',
  categoryLinksEnabled: true,
  categoryLinksPosition: 'LEFT' as const,
  categoryLinksColor: '#4b5563',
  categoryLinksHoverColor: '#000000',
  categoryLinksActiveColor: '#000000',
  categoryLinksFontSize: 'text-sm',
  categoryLinksFontWeight: 'font-medium',
  headerMenuDropdown: false,
  iconsEnabled: true,
  iconsPosition: 'RIGHT' as const,
  iconsColor: '#4b5563',
  iconsHoverColor: '#000000',
  iconsSize: 'w-5 h-5',
  quickLinks: [
    { label: 'My Account', link: '/account/profile', visible: true },
    { label: 'Orders', link: '/account/orders', visible: true },
    { label: 'Shipping', link: '/account/orders', visible: true },
    { label: 'Returns', link: '/account/returns', visible: true },
  ],
};

const DEFAULT_FOOTER = {
  brandName: 'LOGO',
  tagline: 'Style that defines you',
  columns: [
    { title: 'footer.shop', links: [{ text: 'footer.allProducts', url: '/shop' }] },
    { title: 'footer.company', links: [{ text: 'footer.about', url: '/about' }, { text: 'footer.contact', url: '/contact' }] },
    { title: 'footer.customer', links: [{ text: 'footer.myAccount', url: '/account' }, { text: 'footer.orders', url: '/account/orders' }, { text: 'footer.shipping', url: '/shipping' }, { text: 'footer.returns', url: '/returns' }] },
  ],
  copyright: '© {year} LOGO. All rights reserved.',
  links: [
    { text: 'footer.privacy', url: '/privacy' },
    { text: 'footer.terms', url: '/terms' },
  ],
  isActive: true,
};

const DEFAULT_LOGIN_PAGE_CONTENT = JSON.stringify({
  content: '',
  config: {
    imageUrl: '/login-showcase.png',
    videoUrl: '',
    buttonText: '',
    buttonLink: '',
    description:
      'Left panel is ready for a branded image, campaign visual, or showroom-style artwork while the form stays focused on the right.',
    backgroundColor: '#fcfaf7',
    textColor: '#ffffff',
    buttonColor: '#000000',
    buttonTextColor: '#ffffff',
    titleSize: '',
    subtitleSize: '',
    paddingTop: '',
    paddingBottom: '',
    textAlign: 'left',
    imageOpacity: '100',
    sectionHeight: '',
    overlayColor: '#000000',
    overlayOpacity: '35',
    mediaAspectRatio: 'auto',
    gridColumns: '1',
    gridGap: '4',
    gridLayout: 'default',
    badge: 'Content Management',
    eyebrow: 'Admin access',
    sideTitle: 'Visual workspace for your shop operations.',
  },
});

const DEFAULT_PAGES = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    content:
      '<h1>Privacy Policy</h1><p>Use this page to describe how customer data is collected, stored, and processed.</p>',
    metaTitle: 'Privacy Policy',
    metaDescription: 'Privacy policy and data processing information.',
    isActive: true,
  },
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    content:
      '<h1>Terms &amp; Conditions</h1><p>Use this page to describe the terms, conditions, and responsibilities for using your store.</p>',
    metaTitle: 'Terms & Conditions',
    metaDescription: 'Terms and conditions for using the store.',
    isActive: true,
  },
  {
    slug: 'login',
    title: 'Login Page',
    content: DEFAULT_LOGIN_PAGE_CONTENT,
    metaTitle: 'Login',
    metaDescription: 'Customize the login page hero image and copy.',
    isActive: true,
  },
] as const;

async function seed() {
  console.log('🌱 Seeding database (default settings)...\n');

  // 1. Feature settings
  console.log('📋 Feature settings...');
  await prisma.featureSettings.deleteMany({});
  const featureEntries = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
    key,
    value: value as object,
    category: getCategoryForKey(key),
  }));
  await prisma.featureSettings.createMany({ data: featureEntries });
  console.log(`   ✅ ${featureEntries.length} feature settings`);

  // 2. Header settings (single row, logo text: LOGO)
  console.log('📋 Header settings...');
  await prisma.headerSettings.deleteMany({});
  await prisma.headerSettings.create({ data: DEFAULT_HEADER as any });
  console.log('   ✅ Default header (logo: LOGO)');

  // 3. Footer (single row, brand: LOGO) + translations for all languages
  console.log('📋 Footer...');
  await prisma.footerTranslation.deleteMany({});
  await prisma.footer.deleteMany({});
  const footer = await prisma.footer.create({ data: DEFAULT_FOOTER as any });
  for (const lang of defaultLanguages) {
    await prisma.footerTranslation.create({
      data: {
        footerId: footer.id,
        languageCode: lang.code,
        brandName: DEFAULT_FOOTER.brandName,
        tagline: DEFAULT_FOOTER.tagline,
        columns: DEFAULT_FOOTER.columns as any,
        copyright: DEFAULT_FOOTER.copyright,
        links: DEFAULT_FOOTER.links as any,
      },
    });
  }
  console.log(`   ✅ Default footer (brand: LOGO) + ${defaultLanguages.length} language translations`);

  // 4. Languages (en = default, others inactive)
  console.log('📋 Languages...');
  await prisma.language.deleteMany({});
  let sortOrder = 0;
  for (const lang of defaultLanguages) {
    await prisma.language.create({
      data: {
        code: lang.code,
        name: lang.name,
        nameNative: lang.nameNative,
        flag: lang.flag,
        isActive: lang.code === 'en',
        isDefault: lang.code === 'en',
        sortOrder: sortOrder++,
      },
    });
  }
  console.log(`   ✅ ${defaultLanguages.length} languages (en = default)`);

  // 5. Countries (US = default, others inactive)
  console.log('📋 Countries...');
  await prisma.country.deleteMany({});
  sortOrder = 0;
  for (const c of defaultCountries) {
    await prisma.country.create({
      data: {
        code: c.code,
        name: c.name,
        nameNative: c.nameNative,
        currency: c.currency,
        language: c.language,
        taxRate: c.taxRate,
        shippingCost: c.shippingCost,
        freeShippingThreshold: c.freeShippingThreshold,
        isActive: c.code === 'US',
        isDefault: c.code === 'US',
        sortOrder: sortOrder++,
      },
    });
  }
  console.log(`   ✅ ${defaultCountries.length} countries (US = default)`);

  // 6. System pages used by footer and auth screens
  console.log('📋 System pages...');
  await prisma.page.deleteMany({
    where: {
      slug: {
        in: DEFAULT_PAGES.map((page) => page.slug),
      },
    },
  });
  for (const page of DEFAULT_PAGES) {
    await prisma.page.create({ data: page });
  }
  console.log(`   ✅ ${DEFAULT_PAGES.length} system pages (privacy, terms, login)`);

  console.log('\n✅ Seed completed. Start the server to create admin users from env (init:admins).');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
