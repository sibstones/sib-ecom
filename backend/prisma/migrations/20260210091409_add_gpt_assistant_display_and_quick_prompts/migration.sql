-- AlterTable
ALTER TABLE "gpt_assistant_prompts" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "gpt_assistant_settings" ADD COLUMN     "displayTitle" TEXT,
ADD COLUMN     "fabIconUrl" TEXT;
