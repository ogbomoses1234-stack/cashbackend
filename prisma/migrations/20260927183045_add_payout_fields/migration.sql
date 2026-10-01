-- AlterTable
ALTER TABLE "users_profile" ADD COLUMN     "payout_account_name" VARCHAR(120),
ADD COLUMN     "payout_account_number" VARCHAR(10),
ADD COLUMN     "payout_bank_code" VARCHAR(10);
