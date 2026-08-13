/*
  Warnings:

  - You are about to drop the column `email` on the `ProfileInfo` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `ProfileInfo` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `ProfileInfo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProfileInfo" DROP COLUMN "email",
DROP COLUMN "firstName",
DROP COLUMN "lastName";
