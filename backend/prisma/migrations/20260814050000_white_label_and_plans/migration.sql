-- CreateTable
CREATE TABLE "white_label_configs" (
    "id" TEXT NOT NULL,
    "scope" "FeatureFlagScope" NOT NULL,
    "scope_id" TEXT NOT NULL DEFAULT '',
    "brand_name" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "white_label_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modules" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "white_label_configs_scope_scope_id_key" ON "white_label_configs"("scope", "scope_id");
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- AlterTable: add the new plan_id column to the existing resales table.
ALTER TABLE "resales" ADD COLUMN "plan_id" TEXT;
CREATE INDEX "resales_plan_id_idx" ON "resales"("plan_id");
ALTER TABLE "resales" ADD CONSTRAINT "resales_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No RLS on white_label_configs (same rationale as feature_flags: resolving
-- "effective" needs multi-level reads a per-row policy can't express;
-- tenant-tree restriction for write happens in application code via
-- resolveWritableScopeId). No RLS on plans either — it's a platform-wide
-- catalog, readable/writable only by PLATFORM_MANAGE (super admin).

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "white_label_configs", "plans" TO portalia_app;
  END IF;
END
$$;
