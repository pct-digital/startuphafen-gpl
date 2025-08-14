-- CreateTable
CREATE TABLE "ShProject" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "steErSent" BOOLEAN NOT NULL DEFAULT false,
    "gewASent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShQuestionTracking" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "strapiQuestionId" TEXT NOT NULL,
    "posIndex" INTEGER NOT NULL,

    CONSTRAINT "ShQuestionTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShAnswers" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "strapiAnswerId" TEXT NOT NULL,
    "xmlKey" TEXT NOT NULL,
    "catalogueId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ShAnswers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShProject" ADD CONSTRAINT "ShProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShQuestionTracking" ADD CONSTRAINT "ShQuestionTracking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ShProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShAnswers" ADD CONSTRAINT "ShAnswers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ShProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
