-- CreateEnum
CREATE TYPE "BlogMediaFormat" AS ENUM ('AUTO', 'LANDSCAPE', 'PORTRAIT', 'SQUARE');

-- AlterEnum
ALTER TYPE "BlogLayoutStyle" ADD VALUE IF NOT EXISTS 'MIXED';

-- AlterTable
ALTER TABLE "blog_posts"
ADD COLUMN "displayFormat" "BlogMediaFormat" NOT NULL DEFAULT 'AUTO';

-- AlterTable
ALTER TABLE "blog_settings"
ADD COLUMN "heroFullscreen" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "blog_posts_displayFormat_idx" ON "blog_posts"("displayFormat");
