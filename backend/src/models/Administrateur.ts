import type { Utilisateur } from "./Utilisateur";
import type { AdminRole } from "../utils/roles";

export interface Administrateur extends Utilisateur {
  role: AdminRole;
}
