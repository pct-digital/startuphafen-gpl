-- CreateTable
CREATE TABLE "HwkMailLog" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "cc" TEXT,
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "lastError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HwkMailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HwkMailLog_projectId_key" ON "HwkMailLog"("projectId");

-- CreateIndex
CREATE INDEX "HwkMailLog_nextAttemptAt_idx" ON "HwkMailLog"("nextAttemptAt");

-- AddForeignKey
ALTER TABLE "HwkMailLog" ADD CONSTRAINT "HwkMailLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
