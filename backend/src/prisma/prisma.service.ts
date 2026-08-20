import { Injectable, Optional, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export interface TenantScope {
  resaleId?: string | null;
  clientId?: string | null;
  condominiumId?: string | null;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // datasourceUrl should point at the restricted `portalia_app` Postgres
  // role (see prisma/provisioning/create-app-role.sql) so Row-Level
  // Security policies actually apply — superuser/owner connections bypass
  // RLS regardless of FORCE ROW LEVEL SECURITY. Falls back to the
  // migrations connection (DATABASE_URL) when not provided, for local/dev
  // convenience only.
  constructor(@Optional() datasourceUrl?: string) {
    super(datasourceUrl ? { datasourceUrl } : undefined);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Runs a callback inside a transaction with the Postgres session vars
   * app.tenant_resale_id / app.tenant_client_id / app.tenant_condominium_id
   * set from the caller's resolved scope, so the Row-Level Security
   * policies (see prisma/migrations) enforce isolation independently of
   * application-level checks. A null/undefined level means "no restriction
   * at that level" — only super admins and resale/client admins should ever
   * be resolved with a partial scope.
   */
  async withTenantContext<T>(scope: TenantScope, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.tenant_resale_id', ${scope.resaleId ?? null}, true)`,
      );
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.tenant_client_id', ${scope.clientId ?? null}, true)`,
      );
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.tenant_condominium_id', ${scope.condominiumId ?? null}, true)`,
      );
      return fn(tx as PrismaClient);
    });
  }
}
