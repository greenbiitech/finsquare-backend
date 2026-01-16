-- AlterTable
ALTER TABLE "communities" ADD COLUMN     "addressVerification" TEXT,
ADD COLUMN     "cacDocument" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proofOfAddress" TEXT;
