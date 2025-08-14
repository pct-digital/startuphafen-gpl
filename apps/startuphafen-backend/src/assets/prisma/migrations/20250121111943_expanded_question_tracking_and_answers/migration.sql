/*
  Warnings:

  - You are about to drop the column `strapiAId` on the `QuestionTracking` table. All the data in the column will be lost.
  - You are about to drop the column `strapiQId` on the `QuestionTracking` table. All the data in the column will be lost.
  - Added the required column `flowId` to the `Answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `strapiQDictPosIndex` to the `QuestionTracking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `strapiQuestionFlowId` to the `QuestionTracking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Answers" ADD COLUMN     "flowId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "QuestionTracking" DROP COLUMN "strapiAId",
DROP COLUMN "strapiQId",
ADD COLUMN     "strapiQDictPosIndex" INTEGER NOT NULL,
ADD COLUMN     "strapiQuestionFlowId" TEXT NOT NULL;
