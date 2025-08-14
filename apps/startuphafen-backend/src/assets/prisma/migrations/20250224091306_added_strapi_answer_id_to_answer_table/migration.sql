/*
  Warnings:

  - Added the required column `strapiAnswerId` to the `Answers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Answers" ADD COLUMN     "strapiAnswerId" INTEGER NOT NULL;
