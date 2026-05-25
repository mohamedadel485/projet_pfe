import monitorService from "./monitorService";
import type { IMonitor } from "../models/Monitor";
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
  async detecterPannes(): Promise<void> {
    await monitorService.checkAllMonitors();
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
}

export default new MoteurDeSurveillance();
