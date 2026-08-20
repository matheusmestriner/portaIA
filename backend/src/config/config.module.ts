import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // `validate` (not `load`) is required here: ConfigService.get() only
      // consults the Zod-coerced values (numbers, not raw env strings) when
      // they live under the internal VALIDATED_ENV_PROPNAME store, which
      // NestJS only populates via `validate`/`validationSchema`. `load`
      // merges into a different internal bucket that `get()` checks *after*
      // raw process.env — so any coerced field (e.g. z.coerce.number()) that
      // also exists as a literal env var name silently came back as the
      // unparsed string instead (900 → "900", which jsonwebtoken's
      // expiresIn treats as an immediate 0-second expiry).
      validate: validateEnv,
      cache: true,
    }),
  ],
})
export class ConfigModule {}
