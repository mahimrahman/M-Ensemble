import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { newId } from '../utils/ids.js';

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** What a session token carries. `tv` and `jti` are the two revocation handles. */
export interface TokenClaims {
  /** The user id. */
  sub: string;
  /** `User.tokenVersion` at signing. A mismatch means "every session was signed out". */
  tv: number;
  /** Unique per token, so one session can be revoked without touching the rest. */
  jti: string;
  /** Seconds since the epoch; copied onto the `RevokedToken` row so it can expire. */
  exp: number;
}

/**
 * Signs a session for `user`. `TOKEN_TTL` is long by default — the app is
 * fully behind login and nobody wants to sign in weekly — which is exactly why
 * the token also carries the two revocation handles above.
 */
export function signToken(user: { _id: string; tokenVersion?: number }): string {
  return jwt.sign({ sub: user._id, tv: user.tokenVersion ?? 0 }, env.JWT_SECRET, {
    algorithm: 'HS256',
    // `env` validates this as a string; jsonwebtoken types it as `ms`'s template.
    expiresIn: env.TOKEN_TTL as SignOptions['expiresIn'],
    jwtid: newId(),
  });
}

/**
 * The claims of a valid token, or null for anything else — expired, tampered,
 * signed with another secret, or not a JWT at all. Callers turn null into a
 * 401; the app signs out on that status alone.
 *
 * Tokens minted before revocation existed have no `tv` or `jti`. They are read
 * as version 0 with no id, which keeps every session alive across the deploy;
 * the first password change bumps the version and retires them.
 */
export function claimsFromToken(token: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      tv: typeof payload.tv === 'number' ? payload.tv : 0,
      jti: typeof payload.jti === 'string' ? payload.jti : '',
      exp: typeof payload.exp === 'number' ? payload.exp : 0,
    };
  } catch {
    return null;
  }
}

/** Pulls the bearer token out of an Authorization header. */
export function bearerFrom(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
