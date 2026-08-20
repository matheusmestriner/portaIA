-- CreateEnum
CREATE TYPE "CallPartyType" AS ENUM ('GATEHOUSE', 'EXTENSION');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('QUEUED', 'RINGING', 'ANSWERED', 'COMPLETED', 'MISSED', 'ABANDONED', 'REJECTED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "extensions" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sip_username" TEXT NOT NULL,
    "sip_password_encrypted" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "external_call_id" TEXT,
    "caller_type" "CallPartyType" NOT NULL,
    "caller_extension_id" TEXT,
    "callee_type" "CallPartyType" NOT NULL,
    "callee_extension_id" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'QUEUED',
    "queued_at" TIMESTAMP(3),
    "ringing_at" TIMESTAMP(3),
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordings" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "retention_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_nonces" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extensions_unit_id_key" ON "extensions"("unit_id");

-- CreateIndex
CREATE INDEX "extensions_resale_id_idx" ON "extensions"("resale_id");

-- CreateIndex
CREATE INDEX "extensions_client_id_idx" ON "extensions"("client_id");

-- CreateIndex
CREATE INDEX "extensions_condominium_id_idx" ON "extensions"("condominium_id");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_condominium_id_number_key" ON "extensions"("condominium_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_condominium_id_sip_username_key" ON "extensions"("condominium_id", "sip_username");

-- CreateIndex
CREATE UNIQUE INDEX "calls_external_call_id_key" ON "calls"("external_call_id");

-- CreateIndex
CREATE INDEX "calls_resale_id_idx" ON "calls"("resale_id");

-- CreateIndex
CREATE INDEX "calls_client_id_idx" ON "calls"("client_id");

-- CreateIndex
CREATE INDEX "calls_condominium_id_idx" ON "calls"("condominium_id");

-- CreateIndex
CREATE INDEX "calls_callee_extension_id_status_idx" ON "calls"("callee_extension_id", "status");

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE UNIQUE INDEX "recordings_call_id_key" ON "recordings"("call_id");

-- CreateIndex
CREATE INDEX "recordings_resale_id_idx" ON "recordings"("resale_id");

-- CreateIndex
CREATE INDEX "recordings_client_id_idx" ON "recordings"("client_id");

-- CreateIndex
CREATE INDEX "recordings_condominium_id_idx" ON "recordings"("condominium_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_nonces_nonce_key" ON "webhook_nonces"("nonce");

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_extension_id_fkey" FOREIGN KEY ("caller_extension_id") REFERENCES "extensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_callee_extension_id_fkey" FOREIGN KEY ("callee_extension_id") REFERENCES "extensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation hardening
-- ============================================================================

-- extensions hangs off a unit: reuse the residents/vehicles consistency check.
CREATE TRIGGER trg_extension_unit_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, unit_id ON "extensions"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_child_consistency();

-- calls: whichever side is EXTENSION must belong to this call's own
-- condominium chain, and its extension_id must be present (and absent when
-- that side is GATEHOUSE — a call cannot claim to be from an extension it
-- doesn't reference, or reference an extension while claiming GATEHOUSE).
CREATE OR REPLACE FUNCTION enforce_call_consistency() RETURNS trigger AS $$
DECLARE
  ext_resale_id TEXT;
  ext_client_id TEXT;
  ext_condominium_id TEXT;
BEGIN
  IF NEW.caller_type = 'EXTENSION' THEN
    IF NEW.caller_extension_id IS NULL THEN
      RAISE EXCEPTION 'caller_extension_id is required when caller_type = EXTENSION';
    END IF;
    SELECT resale_id, client_id, condominium_id INTO ext_resale_id, ext_client_id, ext_condominium_id
      FROM extensions WHERE id = NEW.caller_extension_id;
    IF ext_resale_id IS NULL OR ext_resale_id <> NEW.resale_id OR ext_client_id <> NEW.client_id OR ext_condominium_id <> NEW.condominium_id THEN
      RAISE EXCEPTION 'call tenant chain must match caller_extension_id';
    END IF;
  ELSIF NEW.caller_extension_id IS NOT NULL THEN
    RAISE EXCEPTION 'caller_extension_id must be null when caller_type = GATEHOUSE';
  END IF;

  IF NEW.callee_type = 'EXTENSION' THEN
    IF NEW.callee_extension_id IS NULL THEN
      RAISE EXCEPTION 'callee_extension_id is required when callee_type = EXTENSION';
    END IF;
    SELECT resale_id, client_id, condominium_id INTO ext_resale_id, ext_client_id, ext_condominium_id
      FROM extensions WHERE id = NEW.callee_extension_id;
    IF ext_resale_id IS NULL OR ext_resale_id <> NEW.resale_id OR ext_client_id <> NEW.client_id OR ext_condominium_id <> NEW.condominium_id THEN
      RAISE EXCEPTION 'call tenant chain must match callee_extension_id';
    END IF;
  ELSIF NEW.callee_extension_id IS NOT NULL THEN
    RAISE EXCEPTION 'callee_extension_id must be null when callee_type = GATEHOUSE';
  END IF;

  IF NEW.caller_type = 'GATEHOUSE' AND NEW.callee_type = 'GATEHOUSE' THEN
    RAISE EXCEPTION 'a call cannot be GATEHOUSE to GATEHOUSE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_call_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, caller_type, caller_extension_id, callee_type, callee_extension_id ON "calls"
  FOR EACH ROW EXECUTE FUNCTION enforce_call_consistency();

-- recordings.resale_id/client_id/condominium_id must match the parent call's chain.
CREATE OR REPLACE FUNCTION enforce_recording_call_consistency() RETURNS trigger AS $$
DECLARE
  expected_resale_id TEXT;
  expected_client_id TEXT;
  expected_condominium_id TEXT;
BEGIN
  SELECT resale_id, client_id, condominium_id
    INTO expected_resale_id, expected_client_id, expected_condominium_id
    FROM calls WHERE id = NEW.call_id;
  IF expected_resale_id IS NULL
     OR expected_resale_id <> NEW.resale_id
     OR expected_client_id <> NEW.client_id
     OR expected_condominium_id <> NEW.condominium_id THEN
    RAISE EXCEPTION 'recording tenant chain must match the parent call';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recording_call_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, call_id ON "recordings"
  FOR EACH ROW EXECUTE FUNCTION enforce_recording_call_consistency();

-- Row-Level Security, same three-level pattern as the earlier migrations.
-- webhook_nonces is intentionally excluded — it's a global anti-replay
-- dedup, not tenant data (same rationale as idempotency_keys).
ALTER TABLE "extensions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extensions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "extensions"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calls" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "calls"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "recordings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recordings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "recordings"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "extensions", "calls", "recordings", "webhook_nonces" TO portalia_app;
  END IF;
END
$$;
