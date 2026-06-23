-- DropForeignKey
ALTER TABLE "social_media_leads" DROP CONSTRAINT IF EXISTS "social_media_leads_convertedToCustomerId_fkey";
ALTER TABLE "social_media_leads" DROP CONSTRAINT IF EXISTS "social_media_leads_convertedToOrderId_fkey";
ALTER TABLE "social_media_leads" DROP CONSTRAINT IF EXISTS "social_media_leads_integrationId_fkey";
ALTER TABLE "social_media_messages" DROP CONSTRAINT IF EXISTS "social_media_messages_integrationId_fkey";
ALTER TABLE "social_media_comments" DROP CONSTRAINT IF EXISTS "social_media_comments_integrationId_fkey";
ALTER TABLE "social_media_posts" DROP CONSTRAINT IF EXISTS "social_media_posts_integrationId_fkey";
ALTER TABLE "social_media_posts" DROP CONSTRAINT IF EXISTS "social_media_posts_productId_fkey";

-- DropTable
DROP TABLE IF EXISTS "social_media_leads";
DROP TABLE IF EXISTS "social_media_messages";
DROP TABLE IF EXISTS "social_media_comments";
DROP TABLE IF EXISTS "social_media_posts";
DROP TABLE IF EXISTS "social_media_integrations";
