-- CreateTable
CREATE TABLE "ShUser" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "roles" TEXT[],

    CONSTRAINT "ShUser_pkey" PRIMARY KEY ("id")
);
