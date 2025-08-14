/*
  Warnings:

  - Added the required column `city` to the `ShUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `ShUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postalCode` to the `ShUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `ShUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShUser" ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "postalCode" TEXT NOT NULL,
ADD COLUMN     "street" TEXT NOT NULL;
