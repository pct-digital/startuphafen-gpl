-- CreateTable
CREATE TABLE "OzgInfo" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "plz" TEXT NOT NULL,
    "kreis" TEXT NOT NULL,
    "gemeinde" TEXT NOT NULL,
    "amt" TEXT NOT NULL,
    "amtCode" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OzgInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OzgInfo_projectId_idx" ON "OzgInfo"("projectId");

-- AddForeignKey
ALTER TABLE "OzgInfo" ADD CONSTRAINT "OzgInfo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
