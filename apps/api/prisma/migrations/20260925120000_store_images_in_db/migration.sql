-- Images move from external storage (a URL) to raw bytes stored in the database itself.
-- Existing rows cannot be converted (their files live elsewhere), so they are removed;
-- re-upload the photos through the admin panel.
DELETE FROM "ProductImage";

ALTER TABLE "ProductImage" DROP COLUMN "url",
ADD COLUMN "data" BYTEA NOT NULL,
ADD COLUMN "mimeType" TEXT NOT NULL,
ADD COLUMN "size" INTEGER NOT NULL;

-- JPEG/PNG/WebP are already compressed: skip Postgres' pglz compression attempt (saves CPU on reads/writes).
ALTER TABLE "ProductImage" ALTER COLUMN "data" SET STORAGE EXTERNAL;
