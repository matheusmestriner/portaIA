-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'DELETION', 'PORTABILITY');
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "subject_document" TEXT,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "granted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_document" TEXT NOT NULL,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'OPEN',
    "details" TEXT,
    "resolved_by" TEXT,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" TEXT NOT NULL,
    "resale_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "condominium_id" TEXT NOT NULL,
    "subject_document" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifted_at" TIMESTAMP(3),
    "lifted_by" TEXT,

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consents_resale_id_idx" ON "consents"("resale_id");
CREATE INDEX "consents_client_id_idx" ON "consents"("client_id");
CREATE INDEX "consents_condominium_id_idx" ON "consents"("condominium_id");
CREATE INDEX "consents_subject_document_idx" ON "consents"("subject_document");

CREATE INDEX "data_subject_requests_resale_id_idx" ON "data_subject_requests"("resale_id");
CREATE INDEX "data_subject_requests_client_id_idx" ON "data_subject_requests"("client_id");
CREATE INDEX "data_subject_requests_condominium_id_idx" ON "data_subject_requests"("condominium_id");
CREATE INDEX "data_subject_requests_requester_document_idx" ON "data_subject_requests"("requester_document");
CREATE INDEX "data_subject_requests_status_idx" ON "data_subject_requests"("status");

CREATE INDEX "legal_holds_resale_id_idx" ON "legal_holds"("resale_id");
CREATE INDEX "legal_holds_client_id_idx" ON "legal_holds"("client_id");
CREATE INDEX "legal_holds_condominium_id_idx" ON "legal_holds"("condominium_id");
CREATE INDEX "legal_holds_subject_document_idx" ON "legal_holds"("subject_document");

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation hardening
-- ============================================================================

-- All three tables hang directly off a condominium: reuse the
-- units/providers/occurrences/announcements consistency check.
CREATE TRIGGER trg_consent_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "consents"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

CREATE TRIGGER trg_data_subject_request_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "data_subject_requests"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

CREATE TRIGGER trg_legal_hold_condominium_consistency
  BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id ON "legal_holds"
  FOR EACH ROW EXECUTE FUNCTION enforce_unit_condominium_consistency();

-- Row-Level Security, same three-level pattern as the earlier migrations.
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "consents"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "data_subject_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_subject_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_subject_requests"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

ALTER TABLE "legal_holds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_holds" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "legal_holds"
  USING (
    (app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id'))
    AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id'))
    AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id'))
  );

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "consents", "data_subject_requests", "legal_holds" TO portalia_app;
  END IF;
END
$$;
