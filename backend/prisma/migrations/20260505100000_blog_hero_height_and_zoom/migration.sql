-- AlterTable
ALTER TABLE "blog_settings"
ADD COLUMN "heroHeight" TEXT NOT NULL DEFAULT '70vh',
ADD COLUMN "heroAutoZoom" BOOLEAN NOT NULL DEFAULT true;
