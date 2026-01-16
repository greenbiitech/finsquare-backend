-- AlterTable
ALTER TABLE "users" ADD COLUMN     "photo" TEXT,
ADD COLUMN     "proofOfAddressUrl" TEXT,
ADD COLUMN     "skippedProofOfAddress" BOOLEAN NOT NULL DEFAULT false;
