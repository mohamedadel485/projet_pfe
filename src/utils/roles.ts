import type { UserRole } from '../models/User';

export type AdminRole = Extract<UserRole, 'super_admin' | 'admin'>;

export const ADMIN_ROLES: AdminRole[] = ['super_admin', 'admin'];

export const isUserRole = (role: unknown): role is UserRole =>
  role === 'super_admin' || role === 'admin' || role === 'user';

export const isAdminRole = (role: unknown): role is AdminRole =>
  role === 'super_admin' || role === 'admin';
