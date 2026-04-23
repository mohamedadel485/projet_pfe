import axios from "axios";
import dns from "dns";
import http from "http";
import https from "https";
import net from "net";
import tls from "tls";
import Monitor, { IMonitor } from "../models/Monitor";
import MonitorLog from "../models/MonitorLog";
import incidentService from "./incidentService";
import maintenanceService from "./maintenanceService";
import integrationService from "./integrationService";

interface CheckResult {
  status: "up" | "down";
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
const HTTP_CHECK_RETRY_ATTEMPTS = 2;
const HTTP_CHECK_RETRY_DELAY_MS = 1000;
const MAX_HTTP_REDIRECTS = 20;
const DEFAULT_HTTP_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};
const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
type MonitorIpVersion =
  | "IPv4 / IPv6 (IPv4 Priority)"
  | "IPv6 / IPv4 (IPv6 Priority)"
  | "IPv4 only"
  | "IPv6 only";
type UpStatusCodeGroup = "2xx" | "3xx";
type LookupAddressEntry = {
  address: string;
  family: 4 | 6;
};
const DEFAULT_UP_STATUS_CODE_GROUPS: UpStatusCodeGroup[] = ["2xx", "3xx"];
const DEFAULT_MONITOR_IP_VERSION: MonitorIpVersion = "IPv4 / IPv6 (IPv4 Priority)";

const isUpStatusCodeGroup = (value: unknown): value is UpStatusCodeGroup =>
  value === "2xx" || value === "3xx";

const normalizeUpStatusCodeGroups = (
  groups: IMonitor["upStatusCodeGroups"],
): UpStatusCodeGroup[] | null => {
  if (!Array.isArray(groups)) {
    return null;
  }

  const sanitizedGroups = groups.filter(isUpStatusCodeGroup);
  if (sanitizedGroups.length === 0) {
    return null;
  }

  return Array.from(new Set(sanitizedGroups));
};

const resolveUpStatusCodeGroups = (
  groups: IMonitor["upStatusCodeGroups"],
): UpStatusCodeGroup[] =>
  normalizeUpStatusCodeGroups(groups) ?? DEFAULT_UP_STATUS_CODE_GROUPS;

const isStatusCodeAllowedByGroup = (
  statusCode: number,
  group: UpStatusCodeGroup,
): boolean => {
  if (group === "2xx") {
    return statusCode >= 200 && statusCode < 300;
  }

  return statusCode >= 300 && statusCode < 400;
};

const doesStatusCodeMatchAllowedGroups = (
  statusCode: number,
  groups: UpStatusCodeGroup[],
): boolean => groups.some((group) => isStatusCodeAllowedByGroup(statusCode, group));

const formatAllowedStatusCodeGroups = (groups: UpStatusCodeGroup[]): string =>
  groups.length === 2 && groups.includes("2xx") && groups.includes("3xx")
    ? "200-399"
    : groups
        .map((group) => (group === "2xx" ? "200-299" : "300-399"))
        .join(" ou ");

const resolveRequestHeaders = (
  headers: IMonitor["headers"],
): Record<string, string> | undefined => {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Map) {
    return Object.fromEntries(headers.entries());
  }

  return headers;
};

type LookupFunction = import("net").LookupFunction;

const isMonitorIpVersion = (value: unknown): value is MonitorIpVersion =>
  value === "IPv4 / IPv6 (IPv4 Priority)" ||
  value === "IPv6 / IPv4 (IPv6 Priority)" ||
  value === "IPv4 only" ||
  value === "IPv6 only";

const resolveMonitorIpVersion = (
  value: IMonitor["ipVersion"],
): MonitorIpVersion =>
  isMonitorIpVersion(value) ? value : DEFAULT_MONITOR_IP_VERSION;

const lookupHostnameWithFamily = (
  hostname: string,
  family: 4 | 6,
  all = false,
): Promise<LookupAddressEntry | LookupAddressEntry[]> =>
  new Promise((resolve, reject) => {
    dns.lookup(
      hostname,
      { family, all } as dns.LookupOneOptions & dns.LookupAllOptions,
      (
        error: NodeJS.ErrnoException | null,
        addressOrAddresses: string | dns.LookupAddress[] | undefined,
        resolvedFamily?: number,
      ) => {
        if (error || !addressOrAddresses) {
          reject(error ?? new Error("Adresse introuvable"));
          return;
        }

        if (all) {
          const addresses = Array.isArray(addressOrAddresses)
            ? addressOrAddresses
            : [
                {
                  address: addressOrAddresses,
                  family: resolvedFamily === 6 ? 6 : 4,
                },
              ];

          resolve(
            addresses.map((entry) => ({
              address: entry.address,
              family: entry.family === 6 ? 6 : 4,
            })),
          );
          return;
        }

        if (Array.isArray(addressOrAddresses)) {
          const firstAddress = addressOrAddresses[0];
          if (!firstAddress) {
            reject(new Error("Adresse introuvable"));
            return;
          }

          resolve({
            address: firstAddress.address,
            family: firstAddress.family === 6 ? 6 : 4,
          });
          return;
        }

        resolve({
          address: addressOrAddresses,
          family: resolvedFamily === 6 ? 6 : 4,
        });
      },
    );
  });

const createLookupResolver = (ipVersion: MonitorIpVersion): LookupFunction => {
  const resolvePreferredFamily = async (
    hostname: string,
    all: boolean,
  ): Promise<LookupAddressEntry | LookupAddressEntry[]> => {
    if (ipVersion === "IPv4 only") {
      return lookupHostnameWithFamily(hostname, 4, all);
    }

    if (ipVersion === "IPv6 only") {
      return lookupHostnameWithFamily(hostname, 6, all);
    }

    if (ipVersion === "IPv6 / IPv4 (IPv6 Priority)") {
      try {
        return await lookupHostnameWithFamily(hostname, 6, all);
      } catch {
        return lookupHostnameWithFamily(hostname, 4, all);
      }
    }

    try {
      return await lookupHostnameWithFamily(hostname, 4, all);
    } catch {
      return lookupHostnameWithFamily(hostname, 6, all);
    }
  };

  return (hostname, _options, callback) => {
    // follow-redirects requests all addresses, so we must honor the array callback form too.
    const wantsAll = Boolean(
      _options &&
        typeof _options === "object" &&
        "all" in _options &&
        (_options as { all?: boolean }).all,
    );

    resolvePreferredFamily(hostname, wantsAll)
      .then((result) => {
        if (wantsAll) {
          callback(null, result as LookupAddressEntry[]);
          return;
        }

        const singleResult = result as LookupAddressEntry;
        callback(null, singleResult.address, singleResult.family);
      })
      .catch((error: unknown) => {
        if (wantsAll) {
          callback(error as NodeJS.ErrnoException, []);
          return;
        }

        callback(error as NodeJS.ErrnoException, "", 4);
      });
  };
};

const buildHttpRequestConfig = (
  monitor: IMonitor,
  requestHeaders: Record<string, string>,
  method: IMonitor["httpMethod"],
): Record<string, unknown> => {
  const lookup = createLookupResolver(resolveMonitorIpVersion(monitor.ipVersion));
  const agentOptions = { lookup };
  const config: Record<string, unknown> = {
    method,
    url: monitor.url,
    timeout: monitor.timeout * 1000,
    validateStatus: () => true,
    maxRedirects: monitor.followRedirections === false ? 0 : MAX_HTTP_REDIRECTS,
    headers: {
      ...DEFAULT_HTTP_HEADERS,
      ...requestHeaders,
    },
    httpAgent: new http.Agent(agentOptions),
    httpsAgent: new https.Agent(agentOptions),
  };

  if (
    monitor.body &&
    ["POST", "PUT", "PATCH"].includes(method)
  ) {
    config.data = monitor.body;
  }

  return config;
};

const isRetryableHttpStatus = (statusCode: number): boolean =>
  RETRYABLE_HTTP_STATUS_CODES.has(statusCode);

const isRetryableHttpError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return true;
  }

  const statusCode = error.response?.status;
  if (typeof statusCode === "number") {
    return isRetryableHttpStatus(statusCode);
  }

  return true;
};

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const buildHttpSuccessResult = (
  response: any,
  responseTime: number,
  allowedStatusCodeGroups: UpStatusCodeGroup[],
  monitor: IMonitor,
): CheckResult => {
  const isSuccess = isHttpStatusUp(response.status, allowedStatusCodeGroups);

  if (!isSuccess) {
    return {
      status: "down",
      responseTime,
      statusCode: response.status,
      errorMessage: `Code HTTP attendu: ${formatAllowedStatusCodeGroups(
        allowedStatusCodeGroups,
      )}, recu: ${response.status}`,
    };
  }

  if (!monitor.responseValidation) {
    return {
      status: "up",
      responseTime,
      statusCode: response.status,
    };
  }

  const { field, mode, expectedValue, expectedType } =
    monitor.responseValidation;
  let payload: unknown = response.data;

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      // Keep as string; validation will fail if we expect object field.
    }
  }

  const readPath = (input: unknown, path: string): unknown => {
    if (!input || typeof input !== "object") return undefined;
    const record = input as Record<string, unknown>;
    return record[path];
  };

  const actual = readPath(payload, field);
  if (mode === "type") {
    const actualType = typeof actual;
    if (!expectedType) {
      return {
        status: "up",
        responseTime,
        statusCode: response.status,
      };
    }

    const wanted = expectedType ?? "string";
    if (wanted === "string" && actualType !== "string") {
      return {
        status: "down",
        responseTime,
        statusCode: response.status,
        errorMessage: `Validation echouee: status doit etre de type ${wanted}`,
      };
    }
    if (wanted === "number" && actualType !== "number") {
      return {
        status: "down",
        responseTime,
        statusCode: response.status,
        errorMessage: `Validation echouee: status doit etre de type ${wanted}`,
      };
    }
    if (wanted === "boolean" && actualType !== "boolean") {
      return {
        status: "down",
        responseTime,
        statusCode: response.status,
        errorMessage: `Validation echouee: status doit etre de type ${wanted}`,
      };
    }
  } else {
    const expected =
      typeof expectedValue === "string" ? expectedValue.trim() : "";
    if (expected === "") {
      return {
        status: "up",
        responseTime,
        statusCode: response.status,
      };
    }

    const actualType = typeof actual;
    let matches = false;

    if (actualType === "number") {
      const parsed = Number(expected);
      matches = Number.isFinite(parsed) && actual === parsed;
    } else if (actualType === "boolean") {
      const normalized = expected.toLowerCase();
      const parsed =
        normalized === "true"
          ? true
          : normalized === "false"
            ? false
            : null;
      matches = parsed !== null && actual === parsed;
    } else if (actualType === "string") {
      matches = String(actual).toLowerCase() === expected.toLowerCase();
    } else {
      matches = false;
    }

    if (!matches) {
      console.log(`[Monitor Debug] Validation failed for field "${field}": expected "${expected}" (${typeof expected}), got "${actual}" (${typeof actual})`);
      return {
        status: "down",
        responseTime,
        statusCode: response.status,
        errorMessage: `Validation echouee: ${field} = "${actual}" (attendu: "${expected}")`,
      };
    }
  }

  return {
    status: "up",
    responseTime,
    statusCode: response.status,
  };
};

const isHttpStatusUp = (
  statusCode: number,
  allowedGroups: UpStatusCodeGroup[],
): boolean => {
  return doesStatusCodeMatchAllowedGroups(statusCode, allowedGroups);
};

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
  const cleaned = host.replace(/\.$/, "").toLowerCase();
  const parts = cleaned.split(".").filter(Boolean);
  if (parts.length <= 1) {
    return cleaned ? [cleaned] : [];
  }

  const candidates: string[] = [];
  for (let index = 0; index < parts.length - 1; index += 1) {
    const candidate = parts.slice(index).join(".");
    if (candidate) candidates.push(candidate);
  }

  return candidates;
};

const extractRdapExpiry = (payload: Record<string, unknown>): Date | null => {
  const events = payload.events;
  if (!Array.isArray(events)) return null;

  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const record = event as Record<string, unknown>;
    const action =
      typeof record.eventAction === "string"
        ? record.eventAction.toLowerCase()
        : "";
    if (!action.includes("expir")) continue;
    const eventDate =
      typeof record.eventDate === "string" ? record.eventDate : "";
    const parsed = Date.parse(eventDate);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  return null;
};

const fetchRdapPayload = (
  domain: string,
): Promise<{ statusCode: number; payload?: Record<string, unknown> }> => {
  const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { Accept: "application/rdap+json, application/json" } },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          if (statusCode !== 200) {
            resolve({ statusCode });
            return;
          }

          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            resolve({ statusCode, payload: parsed });
          } catch (error) {
            reject(new Error("Reponse RDAP invalide"));
          }
        });
      },
    );

    request.on("error", (error) => reject(error));
    request.setTimeout(RDAP_TIMEOUT_MS, () => {
      request.destroy(new Error("Timeout RDAP"));
    });
  });
};

const fetchSslExpiry = (
  host: string,
  port: number,
  lookup?: LookupFunction,
): Promise<Date> =>
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
        reject(new Error("Certificat SSL introuvable"));
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
        lookup,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const validTo = typeof cert?.valid_to === "string" ? cert.valid_to : "";
        const parsed = Date.parse(validTo);
        socket.end();
        if (Number.isNaN(parsed)) {
          finish(new Error("Date SSL invalide"));
          return;
        }
        finish(undefined, new Date(parsed));
      },
    );

    socket.setTimeout(TLS_TIMEOUT_MS);
    socket.on("timeout", () => {
      socket.destroy();
      finish(new Error("Timeout TLS"));
    });
    socket.on("error", (error: Error) => {
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
      if (monitor.type === "http" || monitor.type === "https") {
        return await this.checkHttp(monitor, startTime);
      } else if (monitor.type === "ws" || monitor.type === "wss") {
        return await this.checkWebSocket(monitor, startTime);
      }

      throw new Error("Type de monitor non supporté");
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        status: "down",
        responseTime,
        errorMessage: error.message || "Erreur inconnue",
      };
    }
  }

  /**
   * Vérifie un endpoint HTTP/HTTPS
   */
  private async checkHttp(
    monitor: IMonitor,
    startTime: number,
  ): Promise<CheckResult> {
    try {
      const requestHeaders = resolveRequestHeaders(monitor.headers) ?? {};
      const allowedStatusCodeGroups = resolveUpStatusCodeGroups(
        monitor.upStatusCodeGroups,
      );
      const effectiveHttpMethod = monitor.httpMethod ?? "GET";
      const candidateMethods: Array<IMonitor["httpMethod"]> =
        effectiveHttpMethod === "HEAD" ? ["HEAD", "GET"] : [effectiveHttpMethod];

      let lastFailure: CheckResult | null = null;

      for (const method of candidateMethods) {
        for (
          let attempt = 0;
          attempt <= HTTP_CHECK_RETRY_ATTEMPTS;
          attempt += 1
        ) {
          try {
            const response = await axios(
              buildHttpRequestConfig(monitor, requestHeaders, method),
            );
            const responseTime = Date.now() - startTime;
            const result = buildHttpSuccessResult(
              response,
              responseTime,
              allowedStatusCodeGroups,
              monitor,
            );

            if (result.status === "up") {
              return result;
            }

            lastFailure = result;
            if (
              attempt < HTTP_CHECK_RETRY_ATTEMPTS &&
              typeof result.statusCode === "number" &&
              isRetryableHttpStatus(result.statusCode)
            ) {
              await sleep(HTTP_CHECK_RETRY_DELAY_MS);
              continue;
            }

            break;
          } catch (error: any) {
            const responseTime = Date.now() - startTime;
            const result: CheckResult = {
              status: "down",
              responseTime,
              errorMessage: error.message || "Erreur HTTP",
            };

            if (
              axios.isAxiosError(error) &&
              error.response &&
              typeof error.response.status === "number"
            ) {
              result.statusCode = error.response.status;
            }

            lastFailure = result;
            if (
              attempt < HTTP_CHECK_RETRY_ATTEMPTS &&
              isRetryableHttpError(error)
            ) {
              await sleep(HTTP_CHECK_RETRY_DELAY_MS);
              continue;
            }

            break;
          }
        }
      }

      return (
        lastFailure ?? {
          status: "down",
          responseTime: Date.now() - startTime,
          errorMessage: "Erreur HTTP",
        }
      );
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        status: "down",
        responseTime,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Vérifie la disponibilité d'une cible WebSocket via connexion TCP/TLS.
   */
  private async checkWebSocket(
    monitor: IMonitor,
    startTime: number,
  ): Promise<CheckResult> {
    return new Promise((resolve) => {
      const lookup = createLookupResolver(resolveMonitorIpVersion(monitor.ipVersion));
      let settled = false;
      const finish = (
        result: CheckResult,
        socket?: net.Socket | tls.TLSSocket,
      ): void => {
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
        const isSecure =
          monitor.type === "wss" || parsedUrl.protocol === "wss:";
        const port =
          monitor.port || Number(parsedUrl.port) || (isSecure ? 443 : 80);
        const timeoutMs = monitor.timeout * 1000;

        if (isSecure) {
          const socket = tls.connect(
            {
              host: parsedUrl.hostname,
              port,
              servername: parsedUrl.hostname,
              lookup,
            },
            () => {
              const responseTime = Date.now() - startTime;
              finish({ status: "up", responseTime }, socket);
            },
          );

          socket.setTimeout(timeoutMs);
          socket.on("timeout", () => {
            const responseTime = Date.now() - startTime;
            finish(
              {
                status: "down",
                responseTime,
                errorMessage: "Timeout WebSocket (wss)",
              },
              socket,
            );
          });
          socket.on("error", (error: Error) => {
            const responseTime = Date.now() - startTime;
            finish(
              { status: "down", responseTime, errorMessage: error.message },
              socket,
            );
          });
        } else {
          const socket = net.connect(
            {
              host: parsedUrl.hostname,
              port,
              lookup,
            },
            () => {
              const responseTime = Date.now() - startTime;
              finish({ status: "up", responseTime }, socket);
            },
          );

          socket.setTimeout(timeoutMs);
          socket.on("timeout", () => {
            const responseTime = Date.now() - startTime;
            finish(
              {
                status: "down",
                responseTime,
                errorMessage: "Timeout WebSocket (ws)",
              },
              socket,
            );
          });
          socket.on("error", (error: Error) => {
            const responseTime = Date.now() - startTime;
            finish(
              { status: "down", responseTime, errorMessage: error.message },
              socket,
            );
          });
        }
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        finish({
          status: "down",
          responseTime,
          errorMessage: error?.message || "URL WebSocket invalide",
        });
      }
    });
  }

  private async checkSslExpiry(
    monitor: IMonitor,
    parsedUrl: URL | null,
  ): Promise<ExpiryCheckResult> {
    if (!parsedUrl) {
      return { error: "URL invalide" };
    }

    const isSecure =
      parsedUrl.protocol === "https:" || parsedUrl.protocol === "wss:";
    if (!isSecure) {
      return { error: "TLS non applicable pour ce protocole" };
    }

    const host = parsedUrl.hostname;
    if (!host) {
      return { error: "Hote introuvable" };
    }

    const explicitPort =
      monitor.port ?? (parsedUrl.port ? Number(parsedUrl.port) : undefined);
    const resolvedPort =
      Number.isFinite(explicitPort) && Number(explicitPort) > 0
        ? Number(explicitPort)
        : 443;

    try {
      const lookup = createLookupResolver(resolveMonitorIpVersion(monitor.ipVersion));
      const expiryAt = await fetchSslExpiry(host, resolvedPort, lookup);
      return { expiryAt };
    } catch (error) {
      return { error: (error as Error)?.message || "Erreur verification SSL" };
    }
  }

  private async checkDomainExpiry(
    monitor: IMonitor,
    parsedUrl: URL | null,
  ): Promise<ExpiryCheckResult> {
    if (!parsedUrl) {
      return { error: "URL invalide" };
    }

    const host = parsedUrl.hostname;
    if (!host) {
      return { error: "Hote introuvable" };
    }

    if (host === "localhost" || net.isIP(host) !== 0) {
      return { error: "Domaine non valide pour WHOIS" };
    }

    const candidates = buildDomainCandidates(host);
    if (candidates.length === 0) {
      return { error: "Domaine invalide" };
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
          return { error: "Date d\u0027expiration introuvable" };
        }
      } catch (error) {
        return { error: (error as Error)?.message || "Erreur WHOIS/RDAP" };
      }
    }

    return { error: "Domaine introuvable via RDAP" };
  }

  async refreshSecurityChecks(monitor: IMonitor): Promise<void> {
    const now = new Date();
    const parsedUrl = parseMonitorUrl(monitor.url);
    let hasUpdates = false;

    if (
      monitor.sslExpiryMode === "enabled" &&
      isExpiredOrMissing(monitor.sslExpiryCheckedAt)
    ) {
      const result = await this.checkSslExpiry(monitor, parsedUrl);
      monitor.sslExpiryCheckedAt = now;
      monitor.sslExpiryAt = result.expiryAt;
      monitor.sslExpiryError = result.expiryAt ? undefined : result.error;
      hasUpdates = true;
    }

    if (
      monitor.domainExpiryMode === "enabled" &&
      isExpiredOrMissing(monitor.domainExpiryCheckedAt)
    ) {
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
    const checkedAt = new Date();

    // Enregistrer le log
    await MonitorLog.create({
      monitor: monitor._id,
      status: result.status,
      responseTime: result.responseTime,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
      checkedAt,
    });

    // Mettre à jour le monitor
    monitor.lastChecked = checkedAt;
    monitor.lastStatus = result.status;
    monitor.totalChecks += 1;
    monitor.responseTime = result.responseTime;

    if (result.status === "up") {
      monitor.successfulChecks += 1;
      monitor.status = "up";
    } else {
      monitor.failedChecks += 1;
      monitor.status = "down";
    }

    // Calculer l'uptime
    if (monitor.totalChecks > 0) {
      monitor.uptime = (monitor.successfulChecks / monitor.totalChecks) * 100;
    }

    await monitor.save();

    try {
      await incidentService.recordMonitorCheck({
        monitor,
        result,
        checkedAt,
      });
    } catch (error) {
      console.error("Erreur lors de la mise a jour des incidents:", error);
    }

    const shouldNotifyIntegration =
      (previousStatus === "up" || previousStatus === "down") &&
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
        status: { $ne: "paused" },
      });

      console.log(`Vérification de ${monitors.length} monitors...`);

      const concurrency = 5;
      let currentIndex = 0;

      const runNext = async (): Promise<void> => {
        while (true) {
          const monitor = monitors[currentIndex];
          currentIndex += 1;
          if (!monitor) {
            return;
          }

          try {
            const result = await this.checkMonitor(monitor);
            await this.logCheckResult(monitor, result);
            try {
              await this.refreshSecurityChecks(monitor);
            } catch (error) {
              console.warn(
                `Erreur verification SSL/WHOIS pour ${monitor.name}:`,
                error,
              );
            }

            console.log(
              `Monitor "${monitor.name}" - Status: ${result.status}, Response: ${result.responseTime}ms`,
            );
          } catch (error) {
            console.error(
              `Erreur lors de la vérification du monitor ${monitor.name}:`,
              error,
            );
          }
        }
      };

      const workerCount = Math.max(1, Math.min(concurrency, monitors.length));
      await Promise.all(Array.from({ length: workerCount }, () => runNext()));
    } catch (error) {
      console.error("Erreur lors de la vérification des monitors:", error);
    }
  }
}

export default new MonitorService();
