-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bvnData" JSONB,
ADD COLUMN     "transactionPin" TEXT,
ADD COLUMN     "walletSetupData" JSONB,
ADD COLUMN     "walletSetupStep" TEXT;
