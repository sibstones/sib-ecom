-- CreateTable
CREATE TABLE "blog_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories"("name");
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");
CREATE INDEX "blog_categories_slug_idx" ON "blog_categories"("slug");
CREATE INDEX "blog_posts_categoryId_idx" ON "blog_posts"("categoryId");

-- AddForeignKey
ALTER TABLE "blog_posts"
ADD CONSTRAINT "blog_posts_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
