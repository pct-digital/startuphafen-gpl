-- CreateTable
CREATE TABLE "UserDocument" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDocument_userId_idx" ON "UserDocument"("userId");

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
