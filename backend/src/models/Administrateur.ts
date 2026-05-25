import User, { type IUser, type UserRole } from "./User";

export type Administrateur = IUser & {
  role: Extract<UserRole, "admin" | "super_admin">;
};

export default User;
