import type { CookieOptions } from 'express';

const DEFAULT_COOKIE_NAME = 'uptimewarden_token';
const DEFAULT_SESSION_DAYS = 7;

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (!value || value.trim() === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseDurationToMs = (value?: string): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const match = trimmed.match(/^(\d+)([smhd])?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = (match[2] ?? 's').toLowerCase();
  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
};

const normalizeSameSite = (value?: string): CookieOptions['sameSite'] | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lax') return 'lax';
  if (normalized === 'strict') return 'strict';
  if (normalized === 'none') return 'none';
  return undefined;
};

interface AuthCookieOptionsInput {
  rememberMe?: boolean;
}

export const getAuthCookieName = (): string =>
  process.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;

export const buildAuthCookieOptions = (options?: AuthCookieOptionsInput): CookieOptions => {
  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
  const maxAgeFromEnv = parseDurationToMs(process.env.JWT_EXPIRE);
  const maxAge = maxAgeFromEnv ?? DEFAULT_SESSION_DAYS * 24 * 60 * 60 * 1000;
  const configuredSameSite = normalizeSameSite(process.env.AUTH_COOKIE_SAMESITE);
  const sameSite = configuredSameSite ?? (isProduction ? 'none' : 'lax');
  const secure = parseBooleanEnv(process.env.AUTH_COOKIE_SECURE, isProduction || sameSite === 'none');
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
  const rememberMe = options?.rememberMe ?? true;

  const baseOptions: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
  };

  if (!rememberMe) {
    return baseOptions;
  }

  return {
    ...baseOptions,
    maxAge,
  };
};

export const buildAuthCookieClearOptions = (): CookieOptions => ({
  ...buildAuthCookieOptions({ rememberMe: true }),
  maxAge: 0,
});
