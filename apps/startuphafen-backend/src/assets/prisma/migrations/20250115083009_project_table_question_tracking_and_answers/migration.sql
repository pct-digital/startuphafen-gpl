-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTracking" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "strapiQId" TEXT NOT NULL,
    "strapiAId" TEXT NOT NULL,
    "posIndex" INTEGER NOT NULL,

    CONSTRAINT "QuestionTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answers" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTracking_projectId_key" ON "QuestionTracking"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Answers_projectId_key" ON "Answers"("projectId");

-- AddForeignKey
ALTER TABLE "QuestionTracking" ADD CONSTRAINT "QuestionTracking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answers" ADD CONSTRAINT "Answers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
