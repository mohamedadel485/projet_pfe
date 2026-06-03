export interface IMoteurDeSurveillance {
  statut: "actif" | "inactif" | "en_pause";
  intervalleVerification: number;
  derniereVerification: Date | null;
  totalVerifications: number;
  verificationsReussies: number;
  verificationsEchouees: number;
  historiqueErreurs: Array<{ date: Date; message: string; type: string }>;
}

export { default } from "../services/MoteurDeSurveillance";
export type { MoteurDeSurveillance } from "../services/MoteurDeSurveillance";
