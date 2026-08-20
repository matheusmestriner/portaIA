-- AlterTable
ALTER TABLE "residents" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_failed_login_at" TIMESTAMP(3),
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "password_changed_at" TIMESTAMP(3),
ADD COLUMN     "password_hash" TEXT;

-- CreateTable
CREATE TABLE "resident_refresh_tokens" (
    "id" TEXT NOT NULL,
    "resident_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "resale_id" TEXT,
    "client_id" TEXT,
    "condominium_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resident_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resident_refresh_tokens_token_hash_key" ON "resident_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "resident_refresh_tokens_resident_id_idx" ON "resident_refresh_tokens"("resident_id");

-- CreateIndex
CREATE INDEX "resident_refresh_tokens_expires_at_idx" ON "resident_refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "residents_email_key" ON "residents"("email");

-- AddForeignKey
ALTER TABLE "resident_refresh_tokens" ADD CONSTRAINT "resident_refresh_tokens_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation hardening for resident_refresh_tokens
-- ============================================================================
-- Same three-level scope as refresh_tokens (equipe) — see
-- 20260814010000_auth_rbac/migration.sql. Unit-level scoping (a resident may
-- only touch their own unit's rows) is not expressible as row-level security
-- here since no app.tenant_unit_id session var exists; it is enforced at the
-- application layer instead (backend/src/resident/**, always filters by the
-- resident's own unitId, never trusting a client-supplied value).

ALTER TABLE "resident_refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resident_refresh_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "resident_refresh_tokens"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

-- The restricted app role needs write access to this new table too. Guarded:
-- in environments where prisma/provisioning/create-app-role.sql hasn't run
-- yet (e.g. schema-only setups), skip instead of failing the migration.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "resident_refresh_tokens" TO portalia_app;
  END IF;
END
$$;
