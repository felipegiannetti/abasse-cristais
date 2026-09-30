-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sms" TEXT NOT NULL DEFAULT '';
