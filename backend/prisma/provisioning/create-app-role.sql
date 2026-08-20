-- Run once per Postgres cluster (as a cluster superuser), separate from
-- Prisma migrations: roles are cluster-wide, not database objects, so they
-- do not belong in versioned migrations. This is invoked by docker-compose's
-- postgres init scripts and documented for manual provisioning.
--
-- Rationale: FORCE ROW LEVEL SECURITY still does not apply to superusers or
-- roles with BYPASSRLS. The application must therefore connect as a
-- dedicated, non-superuser, non-BYPASSRLS role for RLS to have any effect.
-- Migrations continue to run as the cluster's superuser/owner role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'portalia_app') THEN
    CREATE ROLE portalia_app LOGIN PASSWORD :'app_role_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE portalia TO portalia_app;
GRANT USAGE ON SCHEMA public TO portalia_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portalia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portalia_app;
