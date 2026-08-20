CREATE TYPE "VmsProvider" AS ENUM ('GENERIC_ONVIF', 'HIKVISION', 'DAHUA', 'INTELBRAS', 'MILESTONE', 'GENETEC', 'OTHER');
CREATE TYPE "VmsConnectionStatus" AS ENUM ('NOT_CONFIGURED', 'OFFLINE', 'ONLINE', 'DEGRADED');
CREATE TYPE "CameraStatus" AS ENUM ('UNKNOWN', 'ONLINE', 'OFFLINE', 'RECORDING_ERROR');
CREATE TYPE "AlarmPanelStatus" AS ENUM ('NOT_CONFIGURED', 'ARMED', 'DISARMED', 'ALARM', 'OFFLINE');
CREATE TYPE "AlarmEventType" AS ENUM ('INTRUSION', 'PANIC', 'TAMPER', 'FIRE', 'POWER_FAILURE', 'COMMUNICATION_FAILURE', 'OTHER');
CREATE TYPE "AlarmEventStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "SecurityLicenseFeature" AS ENUM ('VMS', 'LPR', 'FACE_DETECTION', 'VIDEO_ANALYTICS');

CREATE TABLE "vms_servers" (
  "id" TEXT NOT NULL,
  "resale_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "condominium_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" "VmsProvider" NOT NULL DEFAULT 'GENERIC_ONVIF',
  "endpoint" TEXT,
  "connection_status" "VmsConnectionStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "last_checked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vms_servers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cameras" (
  "id" TEXT NOT NULL,
  "resale_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "condominium_id" TEXT NOT NULL,
  "vms_server_id" TEXT,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "external_id" TEXT,
  "status" "CameraStatus" NOT NULL DEFAULT 'UNKNOWN',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alarm_panels" (
  "id" TEXT NOT NULL,
  "resale_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "condominium_id" TEXT NOT NULL,
  "vms_server_id" TEXT,
  "name" TEXT NOT NULL,
  "provider" "VmsProvider" NOT NULL DEFAULT 'OTHER',
  "external_id" TEXT,
  "status" "AlarmPanelStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alarm_panels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alarm_events" (
  "id" TEXT NOT NULL,
  "resale_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "condominium_id" TEXT NOT NULL,
  "alarm_panel_id" TEXT,
  "camera_id" TEXT,
  "type" "AlarmEventType" NOT NULL,
  "status" "AlarmEventStatus" NOT NULL DEFAULT 'OPEN',
  "message" TEXT NOT NULL,
  "source_event_id" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alarm_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_licenses" (
  "id" TEXT NOT NULL,
  "resale_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "condominium_id" TEXT NOT NULL,
  "feature" "SecurityLicenseFeature" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_licenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vms_servers_resale_id_idx" ON "vms_servers"("resale_id");
CREATE INDEX "vms_servers_client_id_idx" ON "vms_servers"("client_id");
CREATE INDEX "vms_servers_condominium_id_idx" ON "vms_servers"("condominium_id");
CREATE INDEX "cameras_resale_id_idx" ON "cameras"("resale_id");
CREATE INDEX "cameras_client_id_idx" ON "cameras"("client_id");
CREATE INDEX "cameras_condominium_id_idx" ON "cameras"("condominium_id");
CREATE INDEX "cameras_vms_server_id_idx" ON "cameras"("vms_server_id");
CREATE UNIQUE INDEX "cameras_condominium_id_external_id_key" ON "cameras"("condominium_id", "external_id");
CREATE INDEX "alarm_panels_resale_id_idx" ON "alarm_panels"("resale_id");
CREATE INDEX "alarm_panels_client_id_idx" ON "alarm_panels"("client_id");
CREATE INDEX "alarm_panels_condominium_id_idx" ON "alarm_panels"("condominium_id");
CREATE INDEX "alarm_panels_vms_server_id_idx" ON "alarm_panels"("vms_server_id");
CREATE UNIQUE INDEX "alarm_panels_condominium_id_external_id_key" ON "alarm_panels"("condominium_id", "external_id");
CREATE INDEX "alarm_events_resale_id_idx" ON "alarm_events"("resale_id");
CREATE INDEX "alarm_events_client_id_idx" ON "alarm_events"("client_id");
CREATE INDEX "alarm_events_condominium_id_status_idx" ON "alarm_events"("condominium_id", "status");
CREATE INDEX "alarm_events_occurred_at_idx" ON "alarm_events"("occurred_at");
CREATE UNIQUE INDEX "alarm_events_condominium_id_source_event_id_key" ON "alarm_events"("condominium_id", "source_event_id");
CREATE INDEX "security_licenses_resale_id_idx" ON "security_licenses"("resale_id");
CREATE INDEX "security_licenses_client_id_idx" ON "security_licenses"("client_id");
CREATE INDEX "security_licenses_condominium_id_idx" ON "security_licenses"("condominium_id");
CREATE UNIQUE INDEX "security_licenses_condominium_id_feature_key" ON "security_licenses"("condominium_id", "feature");

ALTER TABLE "vms_servers" ADD CONSTRAINT "vms_servers_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_vms_server_id_fkey" FOREIGN KEY ("vms_server_id") REFERENCES "vms_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alarm_panels" ADD CONSTRAINT "alarm_panels_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alarm_panels" ADD CONSTRAINT "alarm_panels_vms_server_id_fkey" FOREIGN KEY ("vms_server_id") REFERENCES "vms_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alarm_events" ADD CONSTRAINT "alarm_events_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alarm_events" ADD CONSTRAINT "alarm_events_alarm_panel_id_fkey" FOREIGN KEY ("alarm_panel_id") REFERENCES "alarm_panels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alarm_events" ADD CONSTRAINT "alarm_events_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "security_licenses" ADD CONSTRAINT "security_licenses_condominium_id_fkey" FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_vms_child_consistency() RETURNS trigger AS $$
DECLARE expected_resale_id TEXT; expected_client_id TEXT; expected_condominium_id TEXT;
BEGIN
  IF NEW.vms_server_id IS NULL THEN RETURN NEW; END IF;
  SELECT resale_id, client_id, condominium_id INTO expected_resale_id, expected_client_id, expected_condominium_id FROM vms_servers WHERE id = NEW.vms_server_id;
  IF expected_resale_id IS NULL OR expected_resale_id <> NEW.resale_id OR expected_client_id <> NEW.client_id OR expected_condominium_id <> NEW.condominium_id THEN RAISE EXCEPTION 'VMS parent tenant chain mismatch'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_camera_vms_consistency BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, vms_server_id ON "cameras" FOR EACH ROW EXECUTE FUNCTION enforce_vms_child_consistency();
CREATE TRIGGER trg_alarm_panel_vms_consistency BEFORE INSERT OR UPDATE OF resale_id, client_id, condominium_id, vms_server_id ON "alarm_panels" FOR EACH ROW EXECUTE FUNCTION enforce_vms_child_consistency();

ALTER TABLE "vms_servers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vms_servers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "cameras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cameras" FORCE ROW LEVEL SECURITY;
ALTER TABLE "alarm_panels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alarm_panels" FORCE ROW LEVEL SECURITY;
ALTER TABLE "alarm_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alarm_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "security_licenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_licenses" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "vms_servers" USING ((app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id')) AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id')) AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id')));
CREATE POLICY tenant_isolation ON "cameras" USING ((app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id')) AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id')) AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id')));
CREATE POLICY tenant_isolation ON "alarm_panels" USING ((app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id')) AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id')) AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id')));
CREATE POLICY tenant_isolation ON "alarm_events" USING ((app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id')) AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id')) AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id')));
CREATE POLICY tenant_isolation ON "security_licenses" USING ((app_tenant_var('app.tenant_resale_id') IS NULL OR resale_id = app_tenant_var('app.tenant_resale_id')) AND (app_tenant_var('app.tenant_client_id') IS NULL OR client_id = app_tenant_var('app.tenant_client_id')) AND (app_tenant_var('app.tenant_condominium_id') IS NULL OR condominium_id = app_tenant_var('app.tenant_condominium_id')));

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "vms_servers", "cameras", "alarm_panels", "alarm_events", "security_licenses" TO portalia_app;
  END IF;
END $$;
