-- AlterTable
ALTER TABLE "HwkMailLog" ADD COLUMN "mailBody" TEXT;
ALTER TABLE "HwkMailLog" ADD COLUMN "mailFrom" TEXT;
ALTER TABLE "HwkMailLog" ADD COLUMN "mailContentType" TEXT;
ALTER TABLE "HwkMailLog" ADD COLUMN "pdfData" BYTEA;
ALTER TABLE "HwkMailLog" ADD COLUMN "pdfFilename" TEXT;
ALTER TABLE "HwkMailLog" ADD COLUMN "pdfMimeType" TEXT;
ALTER TABLE "HwkMailLog" ADD COLUMN "pdfCreatedAt" TIMESTAMP(3);
