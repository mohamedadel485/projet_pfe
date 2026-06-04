import monitorService from "./monitorService";
import type { IMonitor } from "../models/Moniteur";
import CertificatsSSL from "../models/CertificatsSSL";
import Domaine from "../models/Domaine";
import ErreurSSL from "../models/ErreurSSL";

const extractHostname = (monitor: IMonitor): string => {
  try {
    return new URL(monitor.url).hostname || monitor.url;
  } catch {
    return monitor.url;
  }
};

const normalizeDate = (value?: Date): Date => value ?? new Date(0);

export class MoteurDeSurveillance {
  private statut: "actif" | "inactif" | "en_pause" = "inactif";
  private intervalleVerification: number = 60000; // 60 secondes par défaut
  private derniereVerification: Date | null = null;
  private totalVerifications: number = 0;
  private verificationsReussies: number = 0;
  private verificationsEchouees: number = 0;
  private historiqueErreurs: Array<{ date: Date; message: string; type: string }> = [];

  async detecterPannes(): Promise<void> {
    this.statut = "actif";
    await monitorService.checkAllMonitors();
    this.derniereVerification = new Date();
    this.totalVerifications++;
  }

  async VerifierSSL(monitor: IMonitor): Promise<CertificatsSSL | null> {
    await monitorService.refreshSecurityChecks(monitor);

    if (!monitor.sslExpiryAt && !monitor.sslExpiryError) {
      return null;
    }

    return new CertificatsSSL({
      domaine: extractHostname(monitor),
      dateExpiration: normalizeDate(monitor.sslExpiryAt),
      statut: monitor.sslExpiryError ? "erreur" : "valide",
    });
  }

  async VerifierExpirationDomain(monitor: IMonitor): Promise<Domaine | null> {
    await monitorService.refreshSecurityChecks(monitor);

    if (!monitor.domainExpiryAt && !monitor.domainExpiryError) {
      return null;
    }

    return new Domaine({
      nom: extractHostname(monitor),
      dateExpiration: normalizeDate(monitor.domainExpiryAt),
    });
  }

  async VerifierErreurSSL(monitor: IMonitor): Promise<ErreurSSL | null> {
    await monitorService.refreshSecurityChecks(monitor);

    const errorMessage = monitor.sslExpiryError?.trim() || monitor.domainExpiryError?.trim() || "";
    if (errorMessage === "") {
      return null;
    }

    return new ErreurSSL({
      typeErreur: monitor.sslExpiryError ? "ssl" : "domaine",
      description: errorMessage,
      dateErreur: new Date(),
    });
  }

  // Méthodes pour accéder aux champs
  getStatut(): "actif" | "inactif" | "en_pause" {
    return this.statut;
  }

  getIntervalleVerification(): number {
    return this.intervalleVerification;
  }

  setIntervalleVerification(intervalle: number): void {
    this.intervalleVerification = intervalle;
  }

  getDerniereVerification(): Date | null {
    return this.derniereVerification;
  }

  getStatistiques(): {
    total: number;
    reussies: number;
    echouees: number;
    tauxReussite: number;
  } {
    const tauxReussite =
      this.totalVerifications > 0
        ? (this.verificationsReussies / this.totalVerifications) * 100
        : 0;
    return {
      total: this.totalVerifications,
      reussies: this.verificationsReussies,
      echouees: this.verificationsEchouees,
      tauxReussite,
    };
  }

  getHistoriqueErreurs(): Array<{ date: Date; message: string; type: string }> {
    return [...this.historiqueErreurs];
  }

  // Méthodes pour mettre à jour les statistiques
  incrementerVerificationsReussies(): void {
    this.verificationsReussies++;
  }

  incrementerVerificationsEchouees(message: string, type: string): void {
    this.verificationsEchouees++;
    this.historiqueErreurs.push({
      date: new Date(),
      message,
      type,
    });
    // Garder seulement les 100 dernières erreurs
    if (this.historiqueErreurs.length > 100) {
      this.historiqueErreurs = this.historiqueErreurs.slice(-100);
    }
  }

  mettreEnPause(): void {
    this.statut = "en_pause";
  }

  reprendre(): void {
    this.statut = "actif";
  }

  arreter(): void {
    this.statut = "inactif";
  }

  reinitialiserStatistiques(): void {
    this.totalVerifications = 0;
    this.verificationsReussies = 0;
    this.verificationsEchouees = 0;
    this.historiqueErreurs = [];
  }
}

export default new MoteurDeSurveillance();
