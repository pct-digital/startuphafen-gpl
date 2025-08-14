-- CreateTable
CREATE TABLE "FlagTracking" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "qId" TEXT NOT NULL,
    "flag" TEXT NOT NULL,

    CONSTRAINT "FlagTracking_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FlagTracking" ADD CONSTRAINT "FlagTracking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
