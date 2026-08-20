import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BootstrapSuperAdminUseCase } from './auth/use-cases/bootstrap-super-admin.use-case';

/**
 * Administrative command: `npm run bootstrap:super-admin`.
 * Idempotent — safe to run on every deploy.
 */
async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const useCase = app.get(BootstrapSuperAdminUseCase);
    const result = await useCase.execute();
    process.exitCode = 0;
    if (result.created) {
      // eslint-disable-next-line no-console
      console.log('Super admin criado. Troca de senha obrigatória no primeiro login.');
    } else {
      // eslint-disable-next-line no-console
      console.log('Super admin já existia. Nada a fazer.');
    }
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Falha no bootstrap do super admin:', error.message ?? error);
  process.exitCode = 1;
});
