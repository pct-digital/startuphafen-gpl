/*
  Warnings:

  - You are about to drop the column `locked` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "locked",
ADD COLUMN     "gewASent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "steErSent" BOOLEAN NOT NULL DEFAULT false;
