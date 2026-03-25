import axios from 'axios';
import https from 'https';
import net from 'net';
import tls from 'tls';
import Monitor, { IMonitor } from '../models/Monitor';
import MonitorLog from '../models/MonitorLog';
import maintenanceService from './maintenanceService';
import integrationService from './integrationService';

interface CheckResult {
  status: 'up' | 'down';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
}

interface ExpiryCheckResult {
  expiryAt?: Date;
  error?: string;
}

const EXPIRY_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const RDAP_TIMEOUT_MS = 8000;
const TLS_TIMEOUT_MS = 8000;

const isExpiredOrMissing = (checkedAt?: Date | null): boolean => {
  if (!checkedAt) return true;
  const elapsed = Date.now() - checkedAt.getTime();
  return elapsed >= EXPIRY_CHECK_INTERVAL_MS;
};

const parseMonitorUrl = (rawUrl: string): URL | null => {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
};

const buildDomainCandidates = (host: string): string[] => {
  const cleaned = host.replace(/\.$/, '').toLowerCase();
  const parts = cleaned.split('.').filter(Boolean);
  if (parts.length <= 1) {
    return cleaned ? [cleaned] : [];
  }

  const candidates: string[] = [];
  for (let index = 0; index < parts.length - 1; index += 1) {
    const candidate = parts.slice(index).join('.');
    if (candidate) candidates.push(candidate);
  }

  return candidates;
};

const extractRdapExpiry = (payload: Record<string, unknown>): Date | null => {
  const events = payload.events;
  if (!Array.isArray(events)) return null;

  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const record = event as Record<string, unknown>;
    const action = typeof record.eventAction === 'string' ? record.eventAction.toLowerCase() : '';
    if (!action.includes('expir')) continue;
    const eventDate = typeof record.eventDate === 'string' ? record.eventDate : '';
    const parsed = Date.parse(eventDate);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  return null;
};

const fetchRdapPayload = (domain: string): Promise<{ statusCode: number; payload?: Record<string, unknown> }> => {
  const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { Accept: 'application/rdap+json, application/json' } },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          if (statusCode !== 200) {
            resolve({ statusCode });
            return;
          }

          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            resolve({ statusCode, payload: parsed });
          } catch (error) {
            reject(new Error('Reponse RDAP invalide'));
          }
        });
      }
    );

    request.on('error', (error) => reject(error));
    request.setTimeout(RDAP_TIMEOUT_MS, () => {
      request.destroy(new Error('Timeout RDAP'));
    });
  });
};

const fetchSslExpiry = (host: string, port: number): Promise<Date> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error, expiry?: Date) => {
      if (settled) return;
      settled = true;
      if (err) {
        reject(err);
        return;
      }
      if (!expiry) {
        reject(new Error('Certificat SSL introuvable'));
        return;
      }
      resolve(expiry);
    };

    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const validTo = typeof cert?.valid_to === 'string' ? cert.valid_to : '';
        const parsed = Date.parse(validTo);
        socket.end();
        if (Number.isNaN(parsed)) {
          finish(new Error('Date SSL invalide'));
          return;
        }
        finish(undefined, new Date(parsed));
      }
    );

    socket.setTimeout(TLS_TIMEOUT_MS);
    socket.on('timeout', () => {
      socket.destroy();
      finish(new Error('Timeout TLS'));
    });
    socket.on('error', (error: Error) => {
      socket.destroy();
      finish(error);
    });
  });

export class MonitorService {
  /**
   * Vérifie un monitor spécifique
   */
  async checkMonitor(monitor: IMonitor): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      if (monitor.type === 'http' || monitor.type === 'https') {
        return await this.checkHttp(monitor, startTime);
      } else if (monitor.type === 'ws' || monitor.type === 'wss') {
        return await this.checkWebSocket(monitor, startTime);
      }

      throw new Error('Type de monitor non supporté');
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'down',
        responseTime,
        errorMessage: error.message || 'Erreur inconnue',
      };
    }
  }

  /**
   * Vérifie un endpoint HTTP/HTTPS
   */
  private async checkHttp(monitor: IMonitor, startTime: number): Promise<CheckResult> {
    try {
      const config: any = {
        method: monitor.httpMethod,
        url: monitor.url,
        timeout: monitor.timeout * 1000,
        validateStatus: () => true, // Ne pas rejeter sur les codes d'erreur
      };

      if (monitor.headers) {
        config.headers = monitor.headers instanceof Map 
          ? Object.fromEntries(monitor.headers.entries())
          : monitor.headers;
      }

      if (monitor.body && ['POST', 'PUT'].includes(monitor.httpMethod)) {
        config.data = monitor.body;
      }

      const response = await axios(config);
      const responseTime = Date.now() - startTime;

      const isSuccess = response.status === monitor.expectedStatusCode;

      return {
        status: isSuccess ? 'up' : 'down',
        responseTime,
        statusCode: response.status,
        errorMessage: isSuccess ? undefined : `Code de statut attendu: ${monitor.expectedStatusCode}, reçu: ${response.status}`,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'down',
        responseTime,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Vérifie la disponibilité d'une cible WebSocket via connexion TCP/TLS.
   */
  private async checkWebSocket(monitor: IMonitor, startTime: number): Promise<CheckResult> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: CheckResult, socket?: net.Socket | tls.TLSSocket): void => {
        if (settled) return;
        settled = true;
        if (socket) {
          socket.removeAllListeners();
          socket.destroy();
        }
        resolve(result);
      };

      try {
        const parsedUrl = new URL(monitor.url);
        const isSecure = monitor.type === 'wss' || parsedUrl.protocol === 'wss:';
        const port = monitor.port || Number(parsedUrl.port) || (isSecure ? 443 : 80);
        const timeoutMs = monitor.timeout * 1000;

        if (isSecure) {
          const socket = tls.connect(
            {
              host: parsedUrl.hostname,
              port,
              servername: parsedUrl.hostname,
            },
            () => {
              const responseTime = Date.now() - startTime;
              finish({ status: 'up', responseTime }, socket);
            }
          );

          socket.setTimeout(timeoutMs);
          socket.on('timeout', () => {
            const responseTime = Date.now() - startTime;
            finish({ status: 'down', responseTime, errorMessage: 'Timeout WebSocket (wss)' }, socket);
          });
          socket.on('error', (error: Error) => {
            const responseTime = Date.now() - startTime;
            finish({ status: 'down', responseTime, errorMessage: error.message }, socket);
          });
        } else {
          const socket = net.connect(
            {
              host: parsedUrl.hostname,
              port,
            },
            () => {
              const responseTime = Date.now() - startTime;
              finish({ status: 'up', responseTime }, socket);
            }
          );

          socket.setTimeout(timeoutMs);
          socket.on('timeout', () => {
            const responseTime = Date.now() - startTime;
            finish({ status: 'down', responseTime, errorMessage: 'Timeout WebSocket (ws)' }, socket);
          });
          socket.on('error', (error: Error) => {
            const responseTime = Date.now() - startTime;
            finish({ status: 'down', responseTime, errorMessage: error.message }, socket);
          });
        }
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        finish({
          status: 'down',
          responseTime,
          errorMessage: error?.message || 'URL WebSocket invalide',
        });
      }
    });
  }

  private async checkSslExpiry(monitor: IMonitor, parsedUrl: URL | null): Promise<ExpiryCheckResult> {
    if (!parsedUrl) {
      return { error: 'URL invalide' };
    }

    const isSecure = parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:';
    if (!isSecure) {
      return { error: 'TLS non applicable pour ce protocole' };
    }

    const host = parsedUrl.hostname;
    if (!host) {
      return { error: 'Hote introuvable' };
    }

    const explicitPort = monitor.port ?? (parsedUrl.port ? Number(parsedUrl.port) : undefined);
    const resolvedPort = Number.isFinite(explicitPort) && Number(explicitPort) > 0 ? Number(explicitPort) : 443;

    try {
      const expiryAt = await fetchSslExpiry(host, resolvedPort);
      return { expiryAt };
    } catch (error) {
      return { error: (error as Error)?.message || 'Erreur verification SSL' };
    }
  }

  private async checkDomainExpiry(monitor: IMonitor, parsedUrl: URL | null): Promise<ExpiryCheckResult> {
    if (!parsedUrl) {
      return { error: 'URL invalide' };
    }

    const host = parsedUrl.hostname;
    if (!host) {
      return { error: 'Hote introuvable' };
    }

    if (host === 'localhost' || net.isIP(host) !== 0) {
      return { error: 'Domaine non valide pour WHOIS' };
    }

    const candidates = buildDomainCandidates(host);
    if (candidates.length === 0) {
      return { error: 'Domaine invalide' };
    }

    for (const candidate of candidates) {
      try {
        const { statusCode, payload } = await fetchRdapPayload(candidate);
        if (statusCode === 404) {
          continue;
        }
        if (statusCode !== 200) {
          return { error: `RDAP ${statusCode}` };
        }
        if (payload) {
          const expiry = extractRdapExpiry(payload);
          if (expiry) {
            return { expiryAt: expiry };
          }
          return { error: 'Date d\u0027expiration introuvable' };
        }
      } catch (error) {
        return { error: (error as Error)?.message || 'Erreur WHOIS/RDAP' };
      }
    }

    return { error: 'Domaine introuvable via RDAP' };
  }

  async refreshSecurityChecks(monitor: IMonitor): Promise<void> {
    const now = new Date();
    const parsedUrl = parseMonitorUrl(monitor.url);
    let hasUpdates = false;

    if (monitor.sslExpiryMode === 'enabled' && isExpiredOrMissing(monitor.sslExpiryCheckedAt)) {
      const result = await this.checkSslExpiry(monitor, parsedUrl);
      monitor.sslExpiryCheckedAt = now;
      monitor.sslExpiryAt = result.expiryAt;
      monitor.sslExpiryError = result.expiryAt ? undefined : result.error;
      hasUpdates = true;
    }

    if (monitor.domainExpiryMode === 'enabled' && isExpiredOrMissing(monitor.domainExpiryCheckedAt)) {
      const result = await this.checkDomainExpiry(monitor, parsedUrl);
      monitor.domainExpiryCheckedAt = now;
      monitor.domainExpiryAt = result.expiryAt;
      monitor.domainExpiryError = result.expiryAt ? undefined : result.error;
      hasUpdates = true;
    }

    if (hasUpdates) {
      await monitor.save();
    }
  }

  /**
   * Enregistre le résultat d'une vérification et met à jour le monitor
   */
  async logCheckResult(monitor: IMonitor, result: CheckResult): Promise<void> {
    const previousStatus = monitor.status;

    // Enregistrer le log
    await MonitorLog.create({
      monitor: monitor._id,
      status: result.status,
      responseTime: result.responseTime,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
      checkedAt: new Date(),
    });

    // Mettre à jour le monitor
    monitor.lastChecked = new Date();
    monitor.lastStatus = result.status;
    monitor.totalChecks += 1;
    monitor.responseTime = result.responseTime;

    if (result.status === 'up') {
      monitor.successfulChecks += 1;
      monitor.status = 'up';
    } else {
      monitor.failedChecks += 1;
      monitor.status = 'down';
    }

    // Calculer l'uptime
    if (monitor.totalChecks > 0) {
      monitor.uptime = (monitor.successfulChecks / monitor.totalChecks) * 100;
    }

    await monitor.save();

    const shouldNotifyIntegration =
      (previousStatus === 'up' || previousStatus === 'down') &&
      previousStatus !== result.status;

    if (shouldNotifyIntegration) {
      await integrationService.notifyMonitorStatusChange({
        monitor,
        previousStatus,
        result,
      });
    }
  }

  /**
   * Vérifie tous les monitors actifs
   */
  async checkAllMonitors(): Promise<void> {
    try {
      await maintenanceService.refreshMaintenanceStates();

      const monitors = await Monitor.find({ 
        isActive: true, 
        status: { $ne: 'paused' } 
      });

      console.log(`Vérification de ${monitors.length} monitors...`);

      for (const monitor of monitors) {
        try {
          const result = await this.checkMonitor(monitor);
          await this.logCheckResult(monitor, result);
          try {
            await this.refreshSecurityChecks(monitor);
          } catch (error) {
            console.warn(`Erreur verification SSL/WHOIS pour ${monitor.name}:`, error);
          }
          
          console.log(`Monitor "${monitor.name}" - Status: ${result.status}, Response: ${result.responseTime}ms`);
        } catch (error) {
          console.error(`Erreur lors de la vérification du monitor ${monitor.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des monitors:', error);
    }
  }
}

export default new MonitorService();
