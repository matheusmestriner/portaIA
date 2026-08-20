-- CreateEnum
CREATE TYPE "VisitorAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'USED');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'COLLECTED', 'RETURNED');
CREATE TYPE "KeyRecordStatus" AS ENUM ('WITH_GATEHOUSE', 'CHECKED_OUT');
CREATE TYPE "OccurrenceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "OccurrenceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateTable
CREATE TABLE "visitors" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_authorizations" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "status" "VisitorAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pickup_code" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "photo_url" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_records" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "KeyRecordStatus" NOT NULL DEFAULT 'WITH_GATEHOUSE',
    "checked_out_to" TEXT,
    "checked_out_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrences" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "OccurrenceSeverity" NOT NULL DEFAULT 'LOW',
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'OPEN',
    "reported_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panic_alerts" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "triggered_by" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panic_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_list_entries" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "name" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visitors_resale_id_idx" ON "visitors"("resale_id");
CREATE INDEX "visitors_client_id_idx" ON "visitors"("client_id");
CREATE INDEX "visitors_condominium_id_idx" ON "visitors"("condominium_id");
CREATE INDEX "visitors_unit_id_idx" ON "visitors"("unit_id");

CREATE INDEX "visitor_authorizations_resale_id_idx" ON "visitor_authorizations"("resale_id");
CREATE INDEX "visitor_authorizations_client_id_idx" ON "visitor_authorizations"("client_id");
CREATE INDEX "visitor_authorizations_condominium_id_idx" ON "visitor_authorizations"("condominium_id");
CREATE INDEX "visitor_authorizations_visitor_id_idx" ON "visitor_authorizations"("visitor_id");

CREATE INDEX "deliveries_resale_id_idx" ON "deliveries"("resale_id");
CREATE INDEX "deliveries_client_id_idx" ON "deliveries"("client_id");
CREATE INDEX "deliveries_condominium_id_idx" ON "deliveries"("condominium_id");
CREATE INDEX "deliveries_unit_id_idx" ON "deliveries"("unit_id");
CREATE UNIQUE INDEX "deliveries_condominium_id_pickup_code_key" ON "deliveries"("condominium_id", "pickup_code");

CREATE INDEX "key_records_resale_id_idx" ON "key_records"("resale_id");
CREATE INDEX "key_records_client_id_idx" ON "key_records"("client_id");
CREATE INDEX "key_records_condominium_id_idx" ON "key_records"("condominium_id");
CREATE INDEX "key_records_unit_id_idx" ON "key_records"("unit_id");

CREATE INDEX "occurrences_resale_id_idx" ON "occurrences"("resale_id");
CREATE INDEX "occurrences_client_id_idx" ON "occurrences"("client_id");
CREATE INDEX "occurrences_condominium_id_idx" ON "occurrences"("condominium_id");

CREATE INDEX "panic_alerts_resale_id_idx" ON "panic_alerts"("resale_id");
CREATE INDEX "panic_alerts_client_id_idx" ON "panic_alerts"("client_id");
CREATE INDEX "panic_alerts_condominium_id_idx" ON "panic_alerts"("condominium_id");

CREATE INDEX "block_list_entries_resale_id_idx" ON "block_list_entries"("resale_id");
CREATE INDEX "block_list_entries_client_id_idx" ON "block_list_entries"("client_id");
CREATE INDEX "block_list_entries_condominium_id_idx" ON "block_list_entries"("condominium_id");
CREATE UNIQUE INDEX "block_list_entries_condominium_id_document_key" ON "block_list_entries"("condominium_id", "document");

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visitor_authorizations" ADD CONSTRAINT "visitor_authorizations_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "key_records" ADD CONSTRAINT "key_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "panic_alerts" ADD CONSTRAINT "panic_alerts_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "block_list_entries" ADD CONSTRAINT "block_list_entries_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation hardening
-- ============================================================================

-- visitors, deliveries, key_records hang off a unit: reuse the same
-- consistency check used for residents/vehicles (defined in the
-- condominial_core migration).
CREATE TRIGGER trg_visitor_unit_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, unit_id ON "visitors"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_child_consistency();

CREATE TRIGGER trg_delivery_unit_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, unit_id ON "deliveries"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_child_consistency();

CREATE TRIGGER trg_key_record_unit_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, unit_id ON "key_records"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_child_consistency();

-- occurrences, panic_alerts, block_list_entries hang directly off a
-- condominium: reuse the units/providers consistency check.
CREATE TRIGGER trg_occurrence_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "occurrences"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

CREATE TRIGGER trg_panic_alert_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "panic_alerts"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

CREATE TRIGGER trg_block_list_entry_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "block_list_entries"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

-- panic_alerts.unit_id, when present, must belong to the same condominium.
CREATE OR REPLACE FUNCTION enforce_panic_alert_unit_consistency() RETURNS trigger AS $$
DECLARE
  expected_condominium_id TEXT;
BEGIN
  IF NEW.unit_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT condominium_id INTO expected_condominium_id FROM units WHERE id = NEW.unit_id;
  IF expected_condominium_id IS NULL OR expected_condominium_id <> NEW.condominium_id THEN
    RAISE EXCEPTION 'panic_alert.unit_id must belong to the same condominium';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_panic_alert_unit_consistency
  BEFORE INSERT OR UPDATE OF unit_id, condominium_id ON "panic_alerts"
  FOR EACH ROW EXECUTE FUNCTION enforce_panic_alert_unit_consistency();

-- visitor_authorizations.resale_id/client_id/condominium_id must match the
-- parent visitor's chain.
CREATE OR REPLACE FUNCTION enforce_visitor_authorization_consistency() RETURNS trigger AS $$
DECLARE
  expected_resale_id TEXT;
  expected_client_id TEXT;
  expected_condominium_id TEXT;
BEGIN
  SELECT resale_id, client_id, condominium_id
    INTO expected_resale_id, expected_client_id, expected_condominium_id
    FROM visitors WHERE id = NEW.visitor_id;
  IF expected_resale_id IS NULL
     OR expected_resale_id <> NEW.resale_id
     OR expected_client_id <> NEW.client_id
     OR expected_condominium_id <> NEW.condominium_id THEN
    RAISE EXCEPTION 'visitor_authorization tenant chain must match the parent visitor';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visitor_authorization_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, visitor_id ON "visitor_authorizations"
  FOR EACH ROW EXECUTE FUNCTION enforce_visitor_authorization_consistency();

-- Row-Level Security, same three-level pattern as the earlier migrations.
ALTER TABLE "visitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visitors" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "visitors"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "visitor_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visitor_authorizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "visitor_authorizations"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deliveries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "deliveries"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "key_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "key_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "key_records"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "occurrences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "occurrences" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "occurrences"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "panic_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "panic_alerts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "panic_alerts"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "block_list_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "block_list_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "block_list_entries"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

-- The restricted app role needs write access to these new tables too.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "visitors", "visitor_authorizations", "deliveries", "key_records",
      "occurrences", "panic_alerts", "block_list_entries"
      TO portalia_app;
  END IF;
END
$$;
