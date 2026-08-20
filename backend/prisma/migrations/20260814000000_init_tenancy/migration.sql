-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'RESALE_ADMIN', 'RESALE_OPERATOR', 'CLIENT_ADMIN', 'CLIENT_OPERATOR', 'CONDO_MANAGER', 'CONDO_OPERATOR');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateTable
CREATE TABLE "resales" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condominiums" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condominiums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "resale_id" TEXT,
    "client_id" TEXT,
    "condominium_id" TEXT,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_role" TEXT,
    "tenant_resale_id" TEXT,
    "tenant_client_id" TEXT,
    "tenant_condominium_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "result" "AuditResult" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resales_slug_key" ON "resales"("slug");

-- CreateIndex
CREATE INDEX "clients_resale_id_idx" ON "clients"("resale_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_resale_id_slug_key" ON "clients"("resale_id", "slug");

-- CreateIndex
CREATE INDEX "condominiums_resale_id_idx" ON "condominiums"("resale_id");

-- CreateIndex
CREATE INDEX "condominiums_client_id_idx" ON "condominiums"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "condominiums_client_id_slug_key" ON "condominiums"("client_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_resale_id_idx" ON "users"("resale_id");

-- CreateIndex
CREATE INDEX "users_client_id_idx" ON "users"("client_id");

-- CreateIndex
CREATE INDEX "users_condominium_id_idx" ON "users"("condominium_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_resale_id_idx" ON "audit_logs"("tenant_resale_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_client_id_idx" ON "audit_logs"("tenant_client_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_condominium_id_idx" ON "audit_logs"("tenant_condominium_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_resale_id_fkey" FOREIGN KEY ("resale_id") REFERENCES "resales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condominiums" ADD CONSTRAINT "condominiums_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_resale_id_fkey" FOREIGN KEY ("resale_id") REFERENCES "resales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation hardening (defense in depth, independent of app-layer checks)
-- ============================================================================

-- Keep condominiums.resale_id consistent with the parent client's resale_id.
-- Prevents a row from ever pointing at a resale/client pair that don't form
-- a real chain, which would silently defeat the RLS policies below.
CREATE OR REPLACE FUNCTION enforce_condominium_resale_consistency() RETURNS trigger AS $$
DECLARE
  expected_resale_id TEXT;
BEGIN
  SELECT resale_id INTO expected_resale_id FROM clients WHERE id = NEW.client_id;
  IF expected_resale_id IS NULL OR expected_resale_id <> NEW.resale_id THEN
    RAISE EXCEPTION 'condominium.resale_id must match the parent client.resale_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_condominium_resale_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id ON "condominiums"
  FOR EACH ROW EXECUTE FUNCTION enforce_condominium_resale_consistency();

-- Row-Level Security: each policy allows a row when the corresponding
-- session variable is unset (NULL) -- meaning "no restriction at this
-- level" -- OR matches the row's tenant column. The app sets these via
-- PrismaService.withTenantContext() based on the authenticated user's
-- role and scope:
--   SUPER_ADMIN        -> all three vars NULL (sees everything)
--   RESALE_ADMIN/OP    -> app.tenant_resale_id set only
--   CLIENT_ADMIN/OP     -> app.tenant_resale_id + app.tenant_client_id set
--   CONDO_MANAGER/OP   -> all three vars set
-- FORCE ROW LEVEL SECURITY ensures the policies apply even to the table
-- owner (the role migrations run as), so a misconfigured connection can
-- never silently bypass isolation.

-- Postgres' set_config(name, NULL, true) stores an empty string, not SQL
-- NULL, so "no restriction at this level" is represented as NULL-or-empty.
-- This helper centralizes that so every policy reads the session var the
-- same way.
CREATE OR REPLACE FUNCTION app_tenant_var(var_name text) RETURNS text AS $$
  SELECT NULLIF(current_setting(var_name, true), '');
$$ LANGUAGE sql STABLE;

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "clients"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR id = app_tenant_var('app.tenant_client_id'))
  );

ALTER TABLE "condominiums" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "condominiums" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "condominiums"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR tenant_resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR tenant_client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR tenant_condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );
