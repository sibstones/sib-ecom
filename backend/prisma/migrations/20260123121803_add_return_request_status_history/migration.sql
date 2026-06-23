-- CreateTable
CREATE TABLE "return_request_status_history" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL,
    "notes" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_request_status_history_returnRequestId_idx" ON "return_request_status_history"("returnRequestId");

-- AddForeignKey
ALTER TABLE "return_request_status_history" ADD CONSTRAINT "return_request_status_history_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
