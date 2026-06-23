ALTER TABLE "gpt_assistant_settings"
ADD COLUMN "ragEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ragEmbeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-large';
