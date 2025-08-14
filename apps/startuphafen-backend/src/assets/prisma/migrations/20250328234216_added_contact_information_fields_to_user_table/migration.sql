/*
  Warnings:

  - Added the required column `cellPhoneNumber` to the `ShUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `ShUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phoneNumber` to the `ShUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShUser" ADD COLUMN     "cellPhoneNumber" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "phoneNumber" TEXT NOT NULL;
