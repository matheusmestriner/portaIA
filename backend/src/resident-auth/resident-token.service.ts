import { randomBytes, createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Resident } from '@prisma/client';
import type { EnvConfig } from '../config/env.schema';

export interface ResidentAccessTokenClaims {
  sub: string;
  unitId: string;
  condominiumId: string;
  clientId: string;
  resaleId: string;
  mustChangePassword: boolean;
}

export interface IssuedResidentRefreshToken {
  plain: string;
  hash: string;
  expiresAt: Date;
}

const JWT_ISSUER = 'portalia-api';
// Distinct from the staff token's 'portalia-app' audience on purpose: a
// resident token must never pass JwtAuthGuard (staff), and a staff token
// must never pass ResidentJwtAuthGuard — audience pinning is what keeps the
// two actor spaces from crossing, even though both are signed with the same
// JWT_ACCESS_SECRET.
const RESIDENT_JWT_AUDIENCE = 'portalia-resident-app';

@Injectable()
export class ResidentTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  signAccessTokenForResident(resident: Resident, overrides: { mustChangePassword?: boolean } = {}): string {
    const claims: ResidentAccessTokenClaims = {
      sub: resident.id,
      unitId: resident.unitId,
      condominiumId: resident.condominiumId,
      clientId: resident.clientId,
      resaleId: resident.resaleId,
      mustChangePassword: overrides.mustChangePassword ?? resident.mustChangePassword,
    };
    return this.jwt.sign(claims, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('RESIDENT_JWT_ACCESS_TTL_SECONDS', { infer: true }),
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: RESIDENT_JWT_AUDIENCE,
    });
  }

  verifyAccessToken(token: string): ResidentAccessTokenClaims {
    return this.jwt.verify<ResidentAccessTokenClaims>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: RESIDENT_JWT_AUDIENCE,
    });
  }

  issueRefreshToken(): IssuedResidentRefreshToken {
    const plain = randomBytes(48).toString('base64url');
    const ttlSeconds = this.config.get('RESIDENT_JWT_REFRESH_TTL_SECONDS', { infer: true });
    return {
      plain,
      hash: this.hashRefreshToken(plain),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }

  hashRefreshToken(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }
}
