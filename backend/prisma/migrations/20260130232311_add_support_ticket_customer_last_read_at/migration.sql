-- AlterTable
ALTER TABLE "footers" ALTER COLUMN "brandName" SET DEFAULT 'LOGO',
ALTER COLUMN "copyright" SET DEFAULT '© {year} LOGO. All rights reserved.';

-- AlterTable
ALTER TABLE "header_settings" ALTER COLUMN "logoText" SET DEFAULT 'LOGO';

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "customerLastReadAt" TIMESTAMP(3);
