-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "block" TEXT,
    "floor" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residents" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "company" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "units_resale_id_idx" ON "units"("resale_id");
CREATE INDEX "units_client_id_idx" ON "units"("client_id");
CREATE INDEX "units_condominium_id_idx" ON "units"("condominium_id");
CREATE UNIQUE INDEX "units_condominium_id_identifier_key" ON "units"("condominium_id", "identifier");

CREATE INDEX "residents_resale_id_idx" ON "residents"("resale_id");
CREATE INDEX "residents_client_id_idx" ON "residents"("client_id");
CREATE INDEX "residents_condominium_id_idx" ON "residents"("condominium_id");
CREATE INDEX "residents_unit_id_idx" ON "residents"("unit_id");

CREATE INDEX "vehicles_resale_id_idx" ON "vehicles"("resale_id");
CREATE INDEX "vehicles_client_id_idx" ON "vehicles"("client_id");
CREATE INDEX "vehicles_condominium_id_idx" ON "vehicles"("condominium_id");
CREATE INDEX "vehicles_unit_id_idx" ON "vehicles"("unit_id");
CREATE UNIQUE INDEX "vehicles_condominium_id_plate_key" ON "vehicles"("condominium_id", "plate");

CREATE INDEX "providers_resale_id_idx" ON "providers"("resale_id");
CREATE INDEX "providers_client_id_idx" ON "providers"("client_id");
CREATE INDEX "providers_condominium_id_idx" ON "providers"("condominium_id");
CREATE UNIQUE INDEX "providers_condominium_id_document_key" ON "providers"("condominium_id", "document");

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "residents" ADD CONSTRAINT "residents_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "providers" ADD CONSTRAINT "providers_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation hardening
-- ============================================================================

-- units.resale_id/client_id must match the parent condominium's chain.
CREATE OR REPLACE FUNCTION enforce_unit_condominium_consistency() RETURNS trigger AS $$
DECLARE
  expected_resale_id TEXT;
  expected_client_id TEXT;
BEGIN
  SELECT resale_id, client_id INTO expected_resale_id, expected_client_id
    FROM condominiums WHERE id = NEW.condominium_id;
  IF expected_resale_id IS NULL OR expected_resale_id <> NEW.resale_id OR expected_client_id <> NEW.client_id THEN
    RAISE EXCEPTION 'unit.resale_id/client_id must match the parent condominium chain';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unit_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "units"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

-- residents/vehicles: resale_id/client_id/condominium_id must match the parent unit.
CREATE OR REPLACE FUNCTION enforce_unit_child_consistency() RETURNS trigger AS $$
DECLARE
  expected_resale_id TEXT;
  expected_client_id TEXT;
  expected_condominium_id TEXT;
BEGIN
  SELECT resale_id, client_id, condominium_id
    INTO expected_resale_id, expected_client_id, expected_condominium_id
    FROM units WHERE id = NEW.unit_id;
  IF expected_resale_id IS NULL
     OR expected_resale_id <> NEW.resale_id
     OR expected_client_id <> NEW.client_id
     OR expected_condominium_id <> NEW.condominium_id THEN
    RAISE EXCEPTION 'resale_id/client_id/condominium_id must match the parent unit chain';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resident_unit_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, unit_id ON "residents"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_child_consistency();

CREATE TRIGGER trg_vehicle_unit_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, unit_id ON "vehicles"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_child_consistency();

-- providers: resale_id/client_id must match the parent condominium chain
-- (same shape as units, reuse the same trigger function via a thin wrapper
-- that reads condominium_id instead of a differently-named column would be
-- redundant here since the column name matches).
CREATE TRIGGER trg_provider_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "providers"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

-- Row-Level Security, same three-level pattern as the tenancy migration.
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "units" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "units"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "residents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "residents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "residents"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "vehicles"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "providers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "providers"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

-- The restricted app role needs write access to these new tables too.
-- Guarded: in environments where prisma/provisioning/create-app-role.sql
-- hasn't run yet (e.g. schema-only setups), skip instead of failing the
-- migration outright.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "units", "residents", "vehicles", "providers" TO portalia_app;
  END IF;
END
$$;
