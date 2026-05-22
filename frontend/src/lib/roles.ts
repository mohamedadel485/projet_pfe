import type { UserRole } from './api';

export const isUserRole = (role: unknown): role is UserRole =>
  role === 'super_admin' || role === 'admin' || role === 'user';

export const isAdminRole = (role: unknown): role is Extract<UserRole, 'super_admin' | 'admin'> =>
  role === 'super_admin' || role === 'admin';

export const getUserRoleLabel = (role: UserRole): string => {
  if (role === 'super_admin') {
    return 'Super admin';
  }

  if (role === 'admin') {
    return 'Admin';
  }

  return 'Member';
};
