-- CreateTable
CREATE TABLE "public"."SmsOutbox" (
    "id" BIGSERIAL NOT NULL,
    "jobId" INTEGER,
    "toPhone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "retries" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedbackToken" (
    "id" BIGSERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceFeedback" (
    "id" BIGSERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsOutbox_status_scheduledFor_idx" ON "public"."SmsOutbox"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackToken_token_key" ON "public"."FeedbackToken"("token");

-- CreateIndex
CREATE INDEX "ServiceFeedback_jobId_idx" ON "public"."ServiceFeedback"("jobId");

-- AddForeignKey
ALTER TABLE "public"."SmsOutbox" ADD CONSTRAINT "SmsOutbox_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackToken" ADD CONSTRAINT "FeedbackToken_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceFeedback" ADD CONSTRAINT "ServiceFeedback_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
