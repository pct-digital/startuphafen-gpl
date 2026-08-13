/*
  Warnings:

  - A unique constraint covering the columns `[taxId,projectId]` on the table `IdentificationDocument` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "IdentificationDocument_userId_taxId_key";

-- AlterTable
ALTER TABLE "IdentificationDocument" ADD COLUMN     "projectId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "IdentificationDocument_taxId_projectId_key" ON "IdentificationDocument"("taxId", "projectId");

-- AddForeignKey
ALTER TABLE "IdentificationDocument" ADD CONSTRAINT "IdentificationDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
