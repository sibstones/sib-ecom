-- CreateTable
CREATE TABLE "blog_authors" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "bio" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "blog_authors_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN "blogAuthorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "blog_authors_slug_key" ON "blog_authors"("slug");
CREATE INDEX "blog_authors_slug_idx" ON "blog_authors"("slug");
CREATE INDEX "blog_posts_blogAuthorId_idx" ON "blog_posts"("blogAuthorId");

-- AddForeignKey
ALTER TABLE "blog_posts"
ADD CONSTRAINT "blog_posts_blogAuthorId_fkey"
FOREIGN KEY ("blogAuthorId") REFERENCES "blog_authors"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
