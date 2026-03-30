import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { getAuthCookieName } from '../config/auth';
import { isAdminRole } from '../utils/roles';

export interface AuthRequest extends Request {
  user?: IUser;
}

const parseCookies = (header?: string): Record<string, string> => {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const trimmed = part.trim();
    if (trimmed === '') return acc;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      acc[trimmed] = '';
      return acc;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
    }
    return acc;
  }, {});
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const headerToken = req.header('Authorization')?.replace('Bearer ', '');
    const cookieName = getAuthCookieName();
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[cookieName];
    const token = headerToken || cookieToken;

    if (!token) {
      res.status(401).json({ error: 'Authentification requise' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).select('-password');

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || !isAdminRole(req.user.role)) {
    res.status(403).json({ error: 'Accès refusé. Droits administrateur requis.' });
    return;
  }
  next();
};
