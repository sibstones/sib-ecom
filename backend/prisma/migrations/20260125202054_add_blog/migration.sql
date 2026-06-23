-- CreateEnum
CREATE TYPE "BlogPostType" AS ENUM ('ARTICLE', 'VIDEO', 'MIXED');

-- CreateEnum
CREATE TYPE "BlogLayoutStyle" AS ENUM ('MAGAZINE', 'INSTAGRAM', 'TIKTOK');

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "type" "BlogPostType" NOT NULL DEFAULT 'ARTICLE',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_translations" (
    "id" TEXT NOT NULL,
    "blogPostId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT,
    "excerpt" TEXT,
    "content" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_post_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_settings" (
    "id" TEXT NOT NULL,
    "layoutStyle" "BlogLayoutStyle" NOT NULL DEFAULT 'MAGAZINE',
    "gridColumns" TEXT NOT NULL DEFAULT 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    "gap" TEXT NOT NULL DEFAULT 'gap-4',
    "itemsPerPage" INTEGER NOT NULL DEFAULT 12,
    "showExcerpt" BOOLEAN NOT NULL DEFAULT true,
    "showAuthor" BOOLEAN NOT NULL DEFAULT true,
    "showDate" BOOLEAN NOT NULL DEFAULT true,
    "showViews" BOOLEAN NOT NULL DEFAULT false,
    "showTags" BOOLEAN NOT NULL DEFAULT true,
    "headerTitle" TEXT,
    "headerSubtitle" TEXT,
    "headerImageUrl" TEXT,
    "headerVideoUrl" TEXT,
    "titleFontSize" TEXT NOT NULL DEFAULT 'text-2xl',
    "excerptFontSize" TEXT NOT NULL DEFAULT 'text-base',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "accentColor" TEXT NOT NULL DEFAULT '#000000',
    "paddingTop" TEXT NOT NULL DEFAULT 'py-8',
    "paddingBottom" TEXT NOT NULL DEFAULT 'py-8',
    "cardBorderRadius" TEXT NOT NULL DEFAULT 'rounded-lg',
    "cardShadow" BOOLEAN NOT NULL DEFAULT true,
    "cardHoverEffect" BOOLEAN NOT NULL DEFAULT true,
    "featuredPostId" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT 'aspect-square',
    "videoAutoplay" BOOLEAN NOT NULL DEFAULT true,
    "videoLoop" BOOLEAN NOT NULL DEFAULT true,
    "videoMuted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "blog_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_settings_translations" (
    "id" TEXT NOT NULL,
    "blogSettingsId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "headerTitle" TEXT,
    "headerSubtitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_settings_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_type_idx" ON "blog_posts"("type");

-- CreateIndex
CREATE INDEX "blog_posts_isPublished_idx" ON "blog_posts"("isPublished");

-- CreateIndex
CREATE INDEX "blog_posts_publishedAt_idx" ON "blog_posts"("publishedAt");

-- CreateIndex
CREATE INDEX "blog_posts_authorId_idx" ON "blog_posts"("authorId");

-- CreateIndex
CREATE INDEX "blog_posts_createdAt_idx" ON "blog_posts"("createdAt");

-- CreateIndex
CREATE INDEX "blog_post_translations_blogPostId_idx" ON "blog_post_translations"("blogPostId");

-- CreateIndex
CREATE INDEX "blog_post_translations_languageCode_idx" ON "blog_post_translations"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_translations_blogPostId_languageCode_key" ON "blog_post_translations"("blogPostId", "languageCode");

-- CreateIndex
CREATE INDEX "blog_settings_translations_blogSettingsId_idx" ON "blog_settings_translations"("blogSettingsId");

-- CreateIndex
CREATE INDEX "blog_settings_translations_languageCode_idx" ON "blog_settings_translations"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "blog_settings_translations_blogSettingsId_languageCode_key" ON "blog_settings_translations"("blogSettingsId", "languageCode");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_translations" ADD CONSTRAINT "blog_post_translations_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_settings" ADD CONSTRAINT "blog_settings_featuredPostId_fkey" FOREIGN KEY ("featuredPostId") REFERENCES "blog_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_settings_translations" ADD CONSTRAINT "blog_settings_translations_blogSettingsId_fkey" FOREIGN KEY ("blogSettingsId") REFERENCES "blog_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
