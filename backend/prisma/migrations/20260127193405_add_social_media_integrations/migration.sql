-- CreateTable
CREATE TABLE "gpt_assistant_settings" (
    "id" TEXT NOT NULL,
    "enabledAdmin" BOOLEAN NOT NULL DEFAULT true,
    "enabledCustomer" BOOLEAN NOT NULL DEFAULT true,
    "enabledGuest" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'production',
    "logLevel" TEXT NOT NULL DEFAULT 'info',
    "providerType" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-4',
    "apiKey" TEXT,
    "testApiKey" TEXT,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    "contextWindow" INTEGER NOT NULL DEFAULT 10,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "adminMaxResponseLength" INTEGER NOT NULL DEFAULT 2000,
    "adminEnableSuggestions" BOOLEAN NOT NULL DEFAULT true,
    "adminEnableQuickActions" BOOLEAN NOT NULL DEFAULT true,
    "adminDetailLevel" TEXT NOT NULL DEFAULT 'detailed',
    "customerMaxResponseLength" INTEGER NOT NULL DEFAULT 1500,
    "customerEnableSuggestions" BOOLEAN NOT NULL DEFAULT true,
    "customerEnableQuickActions" BOOLEAN NOT NULL DEFAULT true,
    "customerTone" TEXT NOT NULL DEFAULT 'friendly',
    "customerEnableRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "customerEnableContextHelp" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitAdmin" INTEGER NOT NULL DEFAULT 100,
    "rateLimitCustomer" INTEGER NOT NULL DEFAULT 50,
    "rateLimitGuest" INTEGER NOT NULL DEFAULT 20,
    "blockOnLimitExceeded" BOOLEAN NOT NULL DEFAULT true,
    "filterContent" BOOLEAN NOT NULL DEFAULT true,
    "checkPermissions" BOOLEAN NOT NULL DEFAULT true,
    "logAllRequests" BOOLEAN NOT NULL DEFAULT true,
    "anonymizeLogs" BOOLEAN NOT NULL DEFAULT false,
    "enableCache" BOOLEAN NOT NULL DEFAULT true,
    "cacheTTL" INTEGER NOT NULL DEFAULT 3600,
    "cacheFrequentQueries" BOOLEAN NOT NULL DEFAULT true,
    "maxCacheSize" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "gpt_assistant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpt_assistant_prompts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "comment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "gpt_assistant_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_assistant_chat_history" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "data" JSONB,
    "executionTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_assistant_chat_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_assistant_chat_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "data" JSONB,
    "executionTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_assistant_chat_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_integrations" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "botToken" TEXT,
    "pageId" TEXT,
    "channelId" TEXT,
    "groupId" TEXT,
    "autoRespond" BOOLEAN NOT NULL DEFAULT false,
    "autoPost" BOOLEAN NOT NULL DEFAULT false,
    "collectLeads" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "webhookVerified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "social_media_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_posts" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformPostId" TEXT,
    "text" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "videoUrl" TEXT,
    "hashtags" TEXT[],
    "productId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "social_media_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_comments" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformCommentId" TEXT NOT NULL,
    "postId" TEXT,
    "authorId" TEXT,
    "authorUsername" TEXT,
    "authorName" TEXT,
    "text" TEXT NOT NULL,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "parentCommentId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResponded" BOOLEAN NOT NULL DEFAULT false,
    "responseText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "social_media_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_messages" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformMessageId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderUsername" TEXT,
    "senderName" TEXT,
    "recipientId" TEXT,
    "recipientUsername" TEXT,
    "text" TEXT NOT NULL,
    "isIncoming" BOOLEAN NOT NULL DEFAULT true,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResponded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_media_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_leads" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformLeadId" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "username" TEXT,
    "platformUserId" TEXT,
    "message" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "convertedToOrderId" TEXT,
    "convertedToCustomerId" TEXT,
    "notes" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_media_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gpt_assistant_prompts_type_idx" ON "gpt_assistant_prompts"("type");

-- CreateIndex
CREATE INDEX "gpt_assistant_prompts_isActive_idx" ON "gpt_assistant_prompts"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "gpt_assistant_prompts_type_version_key" ON "gpt_assistant_prompts"("type", "version");

-- CreateIndex
CREATE INDEX "admin_assistant_chat_history_adminId_idx" ON "admin_assistant_chat_history"("adminId");

-- CreateIndex
CREATE INDEX "admin_assistant_chat_history_intent_idx" ON "admin_assistant_chat_history"("intent");

-- CreateIndex
CREATE INDEX "admin_assistant_chat_history_createdAt_idx" ON "admin_assistant_chat_history"("createdAt");

-- CreateIndex
CREATE INDEX "customer_assistant_chat_history_userId_idx" ON "customer_assistant_chat_history"("userId");

-- CreateIndex
CREATE INDEX "customer_assistant_chat_history_sessionId_idx" ON "customer_assistant_chat_history"("sessionId");

-- CreateIndex
CREATE INDEX "customer_assistant_chat_history_intent_idx" ON "customer_assistant_chat_history"("intent");

-- CreateIndex
CREATE INDEX "customer_assistant_chat_history_createdAt_idx" ON "customer_assistant_chat_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_media_integrations_platform_key" ON "social_media_integrations"("platform");

-- CreateIndex
CREATE INDEX "social_media_integrations_platform_idx" ON "social_media_integrations"("platform");

-- CreateIndex
CREATE INDEX "social_media_integrations_isEnabled_idx" ON "social_media_integrations"("isEnabled");

-- CreateIndex
CREATE INDEX "social_media_posts_integrationId_idx" ON "social_media_posts"("integrationId");

-- CreateIndex
CREATE INDEX "social_media_posts_platform_idx" ON "social_media_posts"("platform");

-- CreateIndex
CREATE INDEX "social_media_posts_status_idx" ON "social_media_posts"("status");

-- CreateIndex
CREATE INDEX "social_media_posts_scheduledAt_idx" ON "social_media_posts"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_media_comments_platformCommentId_key" ON "social_media_comments"("platformCommentId");

-- CreateIndex
CREATE INDEX "social_media_comments_integrationId_idx" ON "social_media_comments"("integrationId");

-- CreateIndex
CREATE INDEX "social_media_comments_platform_idx" ON "social_media_comments"("platform");

-- CreateIndex
CREATE INDEX "social_media_comments_isRead_idx" ON "social_media_comments"("isRead");

-- CreateIndex
CREATE INDEX "social_media_comments_isResponded_idx" ON "social_media_comments"("isResponded");

-- CreateIndex
CREATE UNIQUE INDEX "social_media_messages_platformMessageId_key" ON "social_media_messages"("platformMessageId");

-- CreateIndex
CREATE INDEX "social_media_messages_integrationId_idx" ON "social_media_messages"("integrationId");

-- CreateIndex
CREATE INDEX "social_media_messages_platform_idx" ON "social_media_messages"("platform");

-- CreateIndex
CREATE INDEX "social_media_messages_senderId_idx" ON "social_media_messages"("senderId");

-- CreateIndex
CREATE INDEX "social_media_messages_isRead_idx" ON "social_media_messages"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "social_media_leads_convertedToOrderId_key" ON "social_media_leads"("convertedToOrderId");

-- CreateIndex
CREATE INDEX "social_media_leads_integrationId_idx" ON "social_media_leads"("integrationId");

-- CreateIndex
CREATE INDEX "social_media_leads_platform_idx" ON "social_media_leads"("platform");

-- CreateIndex
CREATE INDEX "social_media_leads_status_idx" ON "social_media_leads"("status");

-- CreateIndex
CREATE INDEX "social_media_leads_createdAt_idx" ON "social_media_leads"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_assistant_chat_history" ADD CONSTRAINT "admin_assistant_chat_history_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assistant_chat_history" ADD CONSTRAINT "customer_assistant_chat_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "social_media_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_comments" ADD CONSTRAINT "social_media_comments_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "social_media_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_messages" ADD CONSTRAINT "social_media_messages_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "social_media_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_leads" ADD CONSTRAINT "social_media_leads_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "social_media_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_leads" ADD CONSTRAINT "social_media_leads_convertedToOrderId_fkey" FOREIGN KEY ("convertedToOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_leads" ADD CONSTRAINT "social_media_leads_convertedToCustomerId_fkey" FOREIGN KEY ("convertedToCustomerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
