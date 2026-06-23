-- Create enums for AI conversation storage
CREATE TYPE "AiConversationChannel" AS ENUM ('ADMIN', 'CUSTOMER');
CREATE TYPE "AiConversationStatus" AS ENUM ('OPEN', 'WAITING_FOR_USER', 'WAITING_FOR_ADMIN', 'RESOLVED', 'FAILED', 'ESCALATED');
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'OPERATOR_NOTE');
CREATE TYPE "AiExecutionStatus" AS ENUM ('PARSED', 'PREVIEWED', 'CONFIRMED', 'EXECUTED', 'NOOP', 'FAILED', 'REJECTED');
CREATE TYPE "SupportTicketSource" AS ENUM ('MANUAL', 'AI_CUSTOMER', 'AI_ADMIN');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SupportTicketMessageSource" AS ENUM ('CUSTOMER', 'ADMIN', 'AI_DRAFT', 'AI_SENT');

-- Extend support tickets
ALTER TABLE "support_tickets"
ADD COLUMN "source" "SupportTicketSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "category" TEXT,
ADD COLUMN "resolutionSummary" TEXT;

ALTER TABLE "support_ticket_messages"
ADD COLUMN "source" "SupportTicketMessageSource" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN "aiConversationMessageId" TEXT,
ADD COLUMN "editedByAdminId" TEXT;

-- Create AI conversation tables
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "channel" "AiConversationChannel" NOT NULL,
    "status" "AiConversationStatus" NOT NULL DEFAULT 'OPEN',
    "adminId" TEXT,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "title" TEXT,
    "language" TEXT,
    "topicLabel" TEXT,
    "summary" TEXT,
    "lastIntent" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "assignedAdminId" TEXT,
    "supportTicketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "actorUserId" TEXT,
    "content" TEXT NOT NULL,
    "translatedContent" TEXT,
    "intent" TEXT,
    "toolData" JSONB,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_action_executions" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "actionId" TEXT NOT NULL,
    "status" "AiExecutionStatus" NOT NULL,
    "permissionChecked" BOOLEAN NOT NULL DEFAULT false,
    "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
    "arguments" JSONB NOT NULL,
    "previewData" JSONB,
    "resultData" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_executions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "support_tickets_source_status_updatedAt_idx" ON "support_tickets"("source", "status", "updatedAt");
CREATE INDEX "support_ticket_messages_source_idx" ON "support_ticket_messages"("source");
CREATE INDEX "ai_conversations_channel_status_lastMessageAt_idx" ON "ai_conversations"("channel", "status", "lastMessageAt");
CREATE INDEX "ai_conversations_userId_createdAt_idx" ON "ai_conversations"("userId", "createdAt");
CREATE INDEX "ai_conversations_adminId_createdAt_idx" ON "ai_conversations"("adminId", "createdAt");
CREATE INDEX "ai_conversations_topicLabel_createdAt_idx" ON "ai_conversations"("topicLabel", "createdAt");
CREATE INDEX "ai_conversations_supportTicketId_idx" ON "ai_conversations"("supportTicketId");
CREATE INDEX "ai_conversation_messages_conversationId_createdAt_idx" ON "ai_conversation_messages"("conversationId", "createdAt");
CREATE INDEX "ai_conversation_messages_intent_idx" ON "ai_conversation_messages"("intent");
CREATE INDEX "ai_action_executions_conversationId_createdAt_idx" ON "ai_action_executions"("conversationId", "createdAt");
CREATE INDEX "ai_action_executions_actionId_status_createdAt_idx" ON "ai_action_executions"("actionId", "status", "createdAt");

-- Foreign keys
ALTER TABLE "ai_conversations"
ADD CONSTRAINT "ai_conversations_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_conversations"
ADD CONSTRAINT "ai_conversations_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_conversation_messages"
ADD CONSTRAINT "ai_conversation_messages_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_action_executions"
ADD CONSTRAINT "ai_action_executions_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
