-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'IN_APP');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox_entries" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "announcement_id" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_outbox_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_resale_id_idx" ON "announcements"("resale_id");
CREATE INDEX "announcements_client_id_idx" ON "announcements"("client_id");
CREATE INDEX "announcements_condominium_id_idx" ON "announcements"("condominium_id");

CREATE INDEX "notification_outbox_entries_resale_id_idx" ON "notification_outbox_entries"("resale_id");
CREATE INDEX "notification_outbox_entries_client_id_idx" ON "notification_outbox_entries"("client_id");
CREATE INDEX "notification_outbox_entries_condominium_id_idx" ON "notification_outbox_entries"("condominium_id");
CREATE INDEX "notification_outbox_entries_announcement_id_idx" ON "notification_outbox_entries"("announcement_id");
CREATE INDEX "notification_outbox_entries_status_idx" ON "notification_outbox_entries"("status");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_outbox_entries" ADD CONSTRAINT "notification_outbox_entries_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation hardening
-- ============================================================================

-- announcements hangs directly off a condominium: reuse the
-- units/providers/occurrences consistency check (defined in the
-- condominial_core migration).
CREATE TRIGGER trg_announcement_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "announcements"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

-- notification_outbox_entries.resale_id/client_id/condominium_id must match
-- the parent announcement's chain when it's tied to one (system-generated
-- notifications not tied to an announcement carry their own already-correct
-- chain and skip the check).
CREATE OR REPLACE FUNCTION enforce_outbox_entry_announcement_consistency() RETURNS trigger AS $$
DECLARE
  expected_resale_id TEXT;
  expected_client_id TEXT;
  expected_condominium_id TEXT;
BEGIN
  IF NEW.announcement_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT resale_id, client_id, condominium_id
    INTO expected_resale_id, expected_client_id, expected_condominium_id
    FROM announcements WHERE id = NEW.announcement_id;
  IF expected_resale_id IS NULL
     OR expected_resale_id <> NEW.resale_id
     OR expected_client_id <> NEW.client_id
     OR expected_condominium_id <> NEW.condominium_id THEN
    RAISE EXCEPTION 'notification_outbox_entry tenant chain must match the parent announcement';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbox_entry_announcement_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, announcement_id ON "notification_outbox_entries"
  FOR EACH ROW EXECUTE FUNCTION enforce_outbox_entry_announcement_consistency();

-- Row-Level Security, same three-level pattern as the earlier migrations.
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "announcements"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "notification_outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_outbox_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_outbox_entries"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "announcements", "notification_outbox_entries" TO portalia_app;
  END IF;
END
$$;
