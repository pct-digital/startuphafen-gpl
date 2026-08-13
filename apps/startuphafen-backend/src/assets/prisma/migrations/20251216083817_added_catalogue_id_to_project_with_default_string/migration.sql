/*
  Warnings:

  - You are about to drop the column `catalogueId` on the `Answers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Answers" DROP COLUMN "catalogueId";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "catalogueId" TEXT NOT NULL DEFAULT 'none';
