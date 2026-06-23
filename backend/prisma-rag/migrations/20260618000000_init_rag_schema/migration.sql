CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "KnowledgeDocumentAudience" AS ENUM ('admin_only', 'customer_only', 'public', 'internal');
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('draft', 'processing', 'indexed', 'failed', 'archived');
CREATE TYPE "KnowledgeDocumentSourceType" AS ENUM ('text', 'markdown', 'txt', 'pdf', 'url', 'manual');
CREATE TYPE "KnowledgeIngestionJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "title" TEXT NOT NULL,
  "slug" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'ru',
  "audience" "KnowledgeDocumentAudience" NOT NULL DEFAULT 'public',
  "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'draft',
  "sourceType" "KnowledgeDocumentSourceType" NOT NULL DEFAULT 'text',
  "sourcePath" TEXT,
  "mimeType" TEXT,
  "checksum" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "rawText" TEXT,
  "normalizedText" TEXT,
  "chunkCount" INTEGER NOT NULL DEFAULT 0,
  "embeddingModel" TEXT,
  "lastIndexedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "updatedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'ru',
  "audience" "KnowledgeDocumentAudience" NOT NULL,
  "content" TEXT NOT NULL,
  "contentNormalized" TEXT,
  "tokenCount" INTEGER,
  "embeddingModel" TEXT,
  "embedding" vector(3072),
  "searchVector" tsvector,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeIngestionJob" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "KnowledgeIngestionJobStatus" NOT NULL DEFAULT 'pending',
  "stage" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "payload" JSONB,
  "result" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeIngestionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeDocument_externalId_key" ON "KnowledgeDocument"("externalId");
CREATE UNIQUE INDEX "KnowledgeDocument_slug_key" ON "KnowledgeDocument"("slug");
CREATE INDEX "KnowledgeDocument_status_audience_idx" ON "KnowledgeDocument"("status", "audience");
CREATE INDEX "KnowledgeDocument_locale_audience_idx" ON "KnowledgeDocument"("locale", "audience");
CREATE INDEX "KnowledgeDocument_lastIndexedAt_idx" ON "KnowledgeDocument"("lastIndexedAt");

CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "KnowledgeChunk"("documentId", "chunkIndex");
CREATE INDEX "KnowledgeChunk_locale_audience_idx" ON "KnowledgeChunk"("locale", "audience");
CREATE INDEX "KnowledgeChunk_searchVector_idx" ON "KnowledgeChunk" USING GIN ("searchVector");
CREATE INDEX "KnowledgeChunk_contentNormalized_trgm_idx" ON "KnowledgeChunk" USING GIN ("contentNormalized" gin_trgm_ops);
CREATE INDEX "KnowledgeChunk_embedding_idx" ON "KnowledgeChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

CREATE INDEX "KnowledgeIngestionJob_status_createdAt_idx" ON "KnowledgeIngestionJob"("status", "createdAt");
CREATE INDEX "KnowledgeIngestionJob_documentId_status_idx" ON "KnowledgeIngestionJob"("documentId", "status");

ALTER TABLE "KnowledgeChunk"
  ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeIngestionJob"
  ADD CONSTRAINT "KnowledgeIngestionJob_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
