-- AlterTable
ALTER TABLE "Answers" ADD COLUMN     "answerText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "headerText" TEXT,
ADD COLUMN     "questionText" TEXT NOT NULL DEFAULT '';