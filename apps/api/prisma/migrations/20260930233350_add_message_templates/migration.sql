-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "messageTemplates" JSONB NOT NULL DEFAULT '{}';
