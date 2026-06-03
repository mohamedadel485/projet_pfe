import type { UserRole } from "../models/Utilisateur";

export type AdminRole = Extract<UserRole, "super_admin" | "admin">;

export const ADMIN_ROLES: AdminRole[] = ["super_admin", "admin"];

// Role hierarchy: super_admin > admin > user
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  super_admin: 3,
};

export const isUserRole = (role: unknown): role is UserRole =>
  role === "super_admin" || role === "admin" || role === "user";

export const isAdminRole = (role: unknown): role is AdminRole =>
  role === "super_admin" || role === "admin";

// Check if a role has at least the specified role level (inheritance)
export const hasRoleLevel = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

// Check if user can manage another user based on role hierarchy
export const canManageUser = (managerRole: UserRole, targetRole: UserRole): boolean => {
  return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole];
};

// Check if user can assign a specific role
export const canAssignRole = (assignerRole: UserRole, roleToAssign: UserRole): boolean => {
  // Only super_admin can assign admin role
  if (roleToAssign === "admin" && assignerRole !== "super_admin") {
    return false;
  }
  // No one can assign super_admin role (except maybe system)
  if (roleToAssign === "super_admin") {
    return false;
  }
  // Admin can assign user role
  return hasRoleLevel(assignerRole, "admin");
};
