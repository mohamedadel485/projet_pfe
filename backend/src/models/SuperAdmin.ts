import User, { type IUser } from "./User";

export type SuperAdmin = IUser & {
  role: "super_admin";
};

export default User;
