import { randomBytes, createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { User, UserRole } from '@prisma/client';
import type { EnvConfig } from '../config/env.schema';

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  resaleId: string | null;
  clientId: string | null;
  condominiumId: string | null;
  mustChangePassword: boolean;
}

export interface IssuedRefreshToken {
  plain: string;
  hash: string;
  expiresAt: Date;
}

const JWT_ISSUER = 'portalia-api';
const JWT_AUDIENCE = 'portalia-app';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  signAccessToken(claims: AccessTokenClaims): string {
    return this.jwt.sign(claims, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  /** Maps a User row to AccessTokenClaims — pass `mustChangePassword` to override the row's own value (e.g. right after a successful change-password, before the row-read that produced `user` would reflect it). */
  signAccessTokenForUser(user: User, overrides: { mustChangePassword?: boolean } = {}): string {
    return this.signAccessToken({
      sub: user.id,
      role: user.role,
      resaleId: user.resaleId,
      clientId: user.clientId,
      condominiumId: user.condominiumId,
      mustChangePassword: overrides.mustChangePassword ?? user.mustChangePassword,
    });
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    // Pin algorithm/issuer/audience explicitly: `jsonwebtoken` otherwise
    // trusts the algorithm named in the token's own (attacker-controlled)
    // header, which is the classic "alg confusion" opening — pinning closes
    // it even though this app only ever mints HS256 today.
    return this.jwt.verify<AccessTokenClaims>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  issueRefreshToken(): IssuedRefreshToken {
    const plain = randomBytes(48).toString('base64url');
    const ttlSeconds = this.config.get('JWT_REFRESH_TTL_SECONDS', { infer: true });
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
