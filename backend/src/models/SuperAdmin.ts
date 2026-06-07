import type { Administrateur } from "./Administrateur";

export interface SuperAdmin extends Administrateur {
  role: "super_admin";
}
