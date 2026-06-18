import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { Request } from "express";
import Tokens, { type TokenType } from "../models/Tokens";
import { getAuthCookieName } from "../config/auth";

export const jwtSecret = process.env.JWT_SECRET as string;
export const jwtExpiresIn = (process.env.JWT_EXPIRE ??
  "7d") as SignOptions["expiresIn"];
export const PASSWORD_RESET_CODE_LENGTH = 6;
export const LOGIN_OTP_CODE_LENGTH = 6;
export const passwordResetCodeExpireMinutes = Number(
  process.env.PASSWORD_RESET_CODE_EXPIRE_MINUTES ?? 10,
);
export const loginOtpExpireMinutes = Number(
  process.env.LOGIN_OTP_EXPIRE_MINUTES ?? 10,
);
export const exposeDebugDetails =
  (process.env.NODE_ENV ?? "development") !== "production";

export const generateNumericCode = (length: number): string => {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(crypto.randomInt(min, max));
};

export const generatePasswordResetCode = (): string =>
  generateNumericCode(PASSWORD_RESET_CODE_LENGTH);

export const generateLoginOtpCode = (): string =>
  generateNumericCode(LOGIN_OTP_CODE_LENGTH);

export const parseCookieHeader = (header?: string): Record<string, string> => {
  if (!header) return {};

  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const trimmed = part.trim();
    if (trimmed === "") return acc;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      acc[trimmed] = "";
      return acc;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) return acc;

    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {});
};

export const parseRememberMe = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return true;
};

export const getIssuedTokenExpirationDate = (token: string): Date | null => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== "object" || decoded === null) {
    return null;
  }

  const exp = "exp" in decoded ? decoded.exp : undefined;
  if (typeof exp !== "number") {
    return null;
  }

  return new Date(exp * 1000);
};

export const mirrorTokenRecord = async ({
  userId,
  token,
  type,
  expiresAt,
}: {
  userId: string;
  token: string;
  type: TokenType;
  expiresAt: Date;
}): Promise<void> => {
  try {
    await Tokens.deleteMany({ user: userId, type });
    await Tokens.create({
      user: userId,
      token,
      type,
      expiresAt,
    });
  } catch (error) {
    console.warn(`Impossible de synchroniser le jeton ${type}:`, error);
  }
};

export const deleteTokenRecord = async (
  token: string | undefined,
  type?: TokenType,
  userId?: string,
): Promise<void> => {
  if (!token) return;

  try {
    const query: Record<string, unknown> = userId
      ? { user: userId }
      : { token };
    if (type) {
      query.type = type;
    }
    await Tokens.deleteMany(query);
  } catch (error) {
    console.warn(
      `Impossible de supprimer le jeton ${type ?? "unknown"}:`,
      error,
    );
  }
};

export const getAuthTokenFromRequest = (req: Request): string | null => {
  const headerToken = req.header("Authorization")?.replace("Bearer ", "");
  if (headerToken) {
    return headerToken;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[getAuthCookieName()] || null;
};
