/*
  Warnings:

  - You are about to drop the column `photo_url` on the `deliveries` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OperationalPhotoCategory" AS ENUM ('DELIVERY_RECEIPT', 'DELIVERY_PICKUP', 'KEY_CHECKOUT', 'KEY_RETURN', 'PROVIDER_ACCESS', 'OCCURRENCE');

-- AlterTable
ALTER TABLE "deliveries" DROP COLUMN "photo_url",
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "courier_name" TEXT,
ADD COLUMN     "picked_up_by" TEXT,
ADD COLUMN     "pickup_code_hash" TEXT,
ADD COLUMN     "pickup_code_last4" TEXT,
ADD COLUMN     "pickup_credential_expires_at" TIMESTAMP(3),
ADD COLUMN     "pickup_credential_used_at" TIMESTAMP(3),
ADD COLUMN     "pickup_document" TEXT,
ADD COLUMN     "pickup_photo_id" TEXT,
ADD COLUMN     "pickup_qr_hash" TEXT,
ADD COLUMN     "receipt_photo_id" TEXT,
ADD COLUMN     "resident_id" TEXT,
ADD COLUMN     "tracking_code" TEXT,
ADD COLUMN     "volume_count" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "white_label_configs" ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "visual_config" JSONB;

-- CreateTable
CREATE TABLE "operational_photos" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "category" "OperationalPhotoCategory" NOT NULL,
    "source" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "original_name" TEXT,
    "captured_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operational_photos_object_key_key" ON "operational_photos"("object_key");

-- CreateIndex
CREATE INDEX "operational_photos_resale_id_idx" ON "operational_photos"("resale_id");

-- CreateIndex
CREATE INDEX "operational_photos_client_id_idx" ON "operational_photos"("client_id");

-- CreateIndex
CREATE INDEX "operational_photos_condominium_id_idx" ON "operational_photos"("condominium_id");

-- CreateIndex
CREATE INDEX "operational_photos_category_idx" ON "operational_photos"("category");

-- CreateIndex
CREATE INDEX "deliveries_pickup_code_hash_idx" ON "deliveries"("pickup_code_hash");

-- CreateIndex
CREATE INDEX "deliveries_pickup_qr_hash_idx" ON "deliveries"("pickup_qr_hash");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_receipt_photo_id_fkey" FOREIGN KEY ("receipt_photo_id") REFERENCES "operational_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_pickup_photo_id_fkey" FOREIGN KEY ("pickup_photo_id") REFERENCES "operational_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_photos" ADD CONSTRAINT "operational_photos_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Consistência de tenant e RLS (mesmo padrão das demais tabelas operacionais).
-- ---------------------------------------------------------------------------

-- operational_photos.resale_id/client_id devem bater com o condomínio real.
CREATE OR REPLACE FUNCTION enforce_operational_photo_consistency() RETURNS trigger AS $$
DECLARE
  expected_resale_id TEXT;
  expected_client_id TEXT;
BEGIN
  SELECT resale_id, client_id INTO expected_resale_id, expected_client_id
    FROM condominiums WHERE id = NEW.condominium_id;
  IF expected_resale_id IS NULL
     OR expected_resale_id <> NEW.resale_id
     OR expected_client_id <> NEW.client_id THEN
    RAISE EXCEPTION 'operational_photos tenant chain does not match its condominium';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_operational_photo_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "operational_photos"
  FOR EACH ROW EXECUTE FUNCTION enforce_operational_photo_consistency();

-- Uma foto anexada a uma entrega precisa ser do mesmo condomínio da entrega:
-- sem isso, uma evidência de outro condomínio poderia ser referenciada.
CREATE OR REPLACE FUNCTION enforce_delivery_photo_consistency() RETURNS trigger AS $$
DECLARE
  photo_condominium_id TEXT;
BEGIN
  IF NEW.receipt_photo_id IS NOT NULL THEN
    SELECT condominium_id INTO photo_condominium_id FROM operational_photos WHERE id = NEW.receipt_photo_id;
    IF photo_condominium_id IS NULL OR photo_condominium_id <> NEW.condominium_id THEN
      RAISE EXCEPTION 'receipt_photo_id belongs to a different condominium';
    END IF;
  END IF;
  IF NEW.pickup_photo_id IS NOT NULL THEN
    SELECT condominium_id INTO photo_condominium_id FROM operational_photos WHERE id = NEW.pickup_photo_id;
    IF photo_condominium_id IS NULL OR photo_condominium_id <> NEW.condominium_id THEN
      RAISE EXCEPTION 'pickup_photo_id belongs to a different condominium';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_delivery_photo_consistency
  BEFORE INSERT OR UPDATE OF condominium_id, receipt_photo_id, pickup_photo_id ON "deliveries"
  FOR EACH ROW EXECUTE FUNCTION enforce_delivery_photo_consistency();

ALTER TABLE "operational_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operational_photos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "operational_photos"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "operational_photos" TO portalia_app;
  END IF;
END
$$;
