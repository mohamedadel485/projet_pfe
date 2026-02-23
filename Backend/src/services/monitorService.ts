import axios from 'axios';
import net from 'net';
import tls from 'tls';
import Monitor, { IMonitor } from '../models/Monitor';
import MonitorLog from '../models/MonitorLog';

interface CheckResult {
  status: 'up' | 'down';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
}

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

  /**
   * Enregistre le résultat d'une vérification et met à jour le monitor
   */
  async logCheckResult(monitor: IMonitor, result: CheckResult): Promise<void> {
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
  }

  /**
   * Vérifie tous les monitors actifs
   */
  async checkAllMonitors(): Promise<void> {
    try {
      const monitors = await Monitor.find({ 
        isActive: true, 
        status: { $ne: 'paused' } 
      });

      console.log(`Vérification de ${monitors.length} monitors...`);

      for (const monitor of monitors) {
        try {
          const result = await this.checkMonitor(monitor);
          await this.logCheckResult(monitor, result);
          
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
