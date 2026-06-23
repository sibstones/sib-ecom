-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "linkedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
