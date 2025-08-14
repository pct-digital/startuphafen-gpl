-- DropForeignKey
ALTER TABLE "Answers" DROP CONSTRAINT "Answers_projectId_fkey";

-- DropForeignKey
ALTER TABLE "FlagTracking" DROP CONSTRAINT "FlagTracking_projectId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionTracking" DROP CONSTRAINT "QuestionTracking_projectId_fkey";

-- AddForeignKey
ALTER TABLE "QuestionTracking" ADD CONSTRAINT "QuestionTracking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answers" ADD CONSTRAINT "Answers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlagTracking" ADD CONSTRAINT "FlagTracking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
