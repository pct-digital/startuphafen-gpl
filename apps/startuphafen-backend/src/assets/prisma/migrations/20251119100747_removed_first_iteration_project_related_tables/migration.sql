/*
  Warnings:

  - You are about to drop the `Answers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FlagTracking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionTracking` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Answers" DROP CONSTRAINT "Answers_projectId_fkey";

-- DropForeignKey
ALTER TABLE "FlagTracking" DROP CONSTRAINT "FlagTracking_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_userId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionTracking" DROP CONSTRAINT "QuestionTracking_projectId_fkey";

-- DropTable
DROP TABLE "Answers";

-- DropTable
DROP TABLE "FlagTracking";

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "QuestionTracking";
