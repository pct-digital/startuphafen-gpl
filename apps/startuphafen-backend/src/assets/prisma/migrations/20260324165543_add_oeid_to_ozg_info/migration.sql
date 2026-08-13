/*
  Warnings:

  - Added the required column `oeid` to the `OzgInfo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OzgInfo" ADD COLUMN     "oeid" TEXT NOT NULL;
