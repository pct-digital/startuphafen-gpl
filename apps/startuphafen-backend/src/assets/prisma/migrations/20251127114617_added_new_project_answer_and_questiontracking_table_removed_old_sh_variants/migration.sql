/*
  Warnings:

  - You are about to drop the `ShAnswers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShCatalogueVersions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShProject` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShQuestionTracking` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ShAnswers" DROP CONSTRAINT "ShAnswers_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ShProject" DROP CONSTRAINT "ShProject_userId_fkey";

-- DropForeignKey
ALTER TABLE "ShProject" DROP CONSTRAINT "ShProject_versionId_fkey";

-- DropForeignKey
ALTER TABLE "ShQuestionTracking" DROP CONSTRAINT "ShQuestionTracking_projectId_fkey";

-- DropTable
DROP TABLE "ShAnswers";

-- DropTable
DROP TABLE "ShCatalogueVersions";

-- DropTable
DROP TABLE "ShProject";

-- DropTable
DROP TABLE "ShQuestionTracking";

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stSent" BOOLEAN NOT NULL DEFAULT false,
    "gwSent" BOOLEAN NOT NULL DEFAULT false,
    "lastPosition" INTEGER NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTracking" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "answeredQuestions" TEXT[],

    CONSTRAINT "QuestionTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answers" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "stringValue" TEXT,
    "xmlKey" TEXT NOT NULL,
    "catalogueId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "Answers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTracking" ADD CONSTRAINT "QuestionTracking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answers" ADD CONSTRAINT "Answers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
