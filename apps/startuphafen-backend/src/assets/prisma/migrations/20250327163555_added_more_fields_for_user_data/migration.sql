/*
  Warnings:

  - Added the required column `dateOfBirth` to the `ShUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `ShUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `ShUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShUser" ADD COLUMN     "academicTitle" TEXT,
ADD COLUMN     "dateOfBirth" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "title" TEXT;
