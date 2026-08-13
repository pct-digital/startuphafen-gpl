/*
  Warnings:

  - You are about to drop the column `projectId` on the `ProfileInfo` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `ProfileInfo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `ProfileInfo` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ProfileInfo_projectId_key";

-- AlterTable
ALTER TABLE "ProfileInfo" DROP COLUMN "projectId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProfileInfo_userId_key" ON "ProfileInfo"("userId");

-- CreateIndex
CREATE INDEX "ProfileInfo_userId_idx" ON "ProfileInfo"("userId");

-- AddForeignKey
ALTER TABLE "ProfileInfo" ADD CONSTRAINT "ProfileInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
