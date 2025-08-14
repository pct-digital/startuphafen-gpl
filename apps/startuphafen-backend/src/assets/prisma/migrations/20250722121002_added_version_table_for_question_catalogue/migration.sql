/*
  Warnings:

  - Added the required column `versionId` to the `ShProject` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShProject" ADD COLUMN     "versionId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "ShCatalogueVersions" (
    "id" SERIAL NOT NULL,
    "catalogueJSON" TEXT NOT NULL,
    "catalogueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShCatalogueVersions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShProject" ADD CONSTRAINT "ShProject_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ShCatalogueVersions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
