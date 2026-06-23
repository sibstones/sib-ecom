-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "rateLimit" SET DEFAULT 10000;

-- AlterTable
ALTER TABLE "gpt_assistant_settings" ALTER COLUMN "rateLimitAdmin" SET DEFAULT 1000,
ALTER COLUMN "rateLimitCustomer" SET DEFAULT 500,
ALTER COLUMN "rateLimitGuest" SET DEFAULT 200;
