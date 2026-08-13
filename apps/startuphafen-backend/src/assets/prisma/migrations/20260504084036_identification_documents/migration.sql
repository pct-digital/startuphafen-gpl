-- CreateTable
CREATE TABLE "IdentificationDocument" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentificationDocument_userId_idx" ON "IdentificationDocument"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentificationDocument_userId_taxId_key" ON "IdentificationDocument"("userId", "taxId");

-- AddForeignKey
ALTER TABLE "IdentificationDocument" ADD CONSTRAINT "IdentificationDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
