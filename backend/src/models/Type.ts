export const Type = {
  access: "access",
  refresh: "refresh",
  reset_password: "reset_password",
  verify_email: "verify_email",
} as const;

export type Type = (typeof Type)[keyof typeof Type];

export default Type;
