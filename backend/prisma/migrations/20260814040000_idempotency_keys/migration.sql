-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_route_actor_user_id_key" ON "idempotency_keys"("key", "route", "actor_user_id");

-- No RLS here: this table is an internal replay cache, never listed or
-- exposed to tenant-facing reads. It's scoped by (key, route, actor_user_id)
-- which already prevents cross-actor leakage.

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "idempotency_keys" TO portalia_app;
  END IF;
END
$$;
