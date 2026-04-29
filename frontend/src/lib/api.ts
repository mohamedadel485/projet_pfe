const rawApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.trim();
const rawBackendProxyTarget = (
  import.meta.env.VITE_BACKEND_PROXY_TARGET as string | undefined
)?.trim();

const API_BASE_URL = rawApiBaseUrl || "/api";
const BACKEND_PROXY_TARGET = rawBackendProxyTarget || "";
const LOCAL_DIRECT_BACKEND_FALLBACKS = Array.from(
  new Set([BACKEND_PROXY_TARGET].filter((target) => target.trim() !== "")),
);

const isBrowser = typeof window !== "undefined";
const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const AUTH_LOCAL_STORAGE_KEY = "uptimewarden_auth_token";
const AUTH_SESSION_STORAGE_KEY = "uptimewarden_auth_session_token";
export const COOKIE_AUTH_SENTINEL = "__uptimewarden_cookie_session__";
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const EMAIL_DELIVERY_REQUEST_TIMEOUT_MS = 20000;
const TRANSIENT_GET_RETRY_DELAY_MS = 350;

export type UserRole = "super_admin" | "admin" | "user";
export type EditableUserRole = Exclude<UserRole, "super_admin">;
export type MonitorIpVersion =
  | "IPv4 / IPv6 (IPv4 Priority)"
  | "IPv6 / IPv4 (IPv6 Priority)"
  | "IPv4 only"
  | "IPv6 only";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string | null;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface BackendMonitor {
  _id: string;
  name: string;
  url: string;
  type: "http" | "https" | "ws" | "wss";
  interval: number;
  timeout: number;
  httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  expectedStatusCode: number;
  status: "up" | "down" | "paused" | "pending";
  uptime: number;
  responseTime: number;
  sharedWith?: string[];
  domainExpiryMode?: "enabled" | "disabled";
  domainExpiryAt?: string;
  domainExpiryCheckedAt?: string;
  domainExpiryError?: string;
  sslExpiryMode?: "enabled" | "disabled";
  sslExpiryAt?: string;
  sslExpiryCheckedAt?: string;
  sslExpiryError?: string;
  lastChecked?: string;
  createdAt: string;
  updatedAt: string;
}

export type IntegrationProvider = "webhook" | "slack" | "telegram";
export type IntegrationEvent = "up" | "down";

export interface BackendIntegration {
  _id: string;
  type: IntegrationProvider;
  endpointUrl: string;
  customValue?: string;
  events: IntegrationEvent[];
  isActive: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorListResponse {
  monitors: BackendMonitor[];
}

export interface IntegrationsListResponse {
  integrations: BackendIntegration[];
}

export type BackendMaintenanceStatus =
  | "scheduled"
  | "ongoing"
  | "paused"
  | "completed"
  | "cancelled";

export interface BackendMaintenanceMonitor {
  _id: string;
  name: string;
  url: string;
  type: "http" | "https" | "ws" | "wss";
  status: "up" | "down" | "paused" | "pending";
}

export interface BackendMaintenance {
  _id: string;
  name: string;
  reason: string;
  status: BackendMaintenanceStatus;
  monitor: BackendMaintenanceMonitor | null;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceListResponse {
  maintenances: BackendMaintenance[];
}

export interface BackendIncidentMonitor {
  _id: string;
  name: string;
  url: string;
  type: "http" | "https" | "ws" | "wss";
  expectedStatusCode: number;
}

export interface BackendIncident {
  _id: string;
  monitor: BackendIncidentMonitor | null;
  status: "up" | "down";
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
  startedAt?: string;
  resolvedAt?: string | null;
  durationMs?: number;
}

export interface IncidentListResponse {
  incidents: BackendIncident[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface BackendMonitorLog {
  _id: string;
  monitor: string;
  status: "up" | "down";
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}

export interface MonitorLogsResponse {
  logs: BackendMonitorLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface PublicStatusPageResponse {
  statusPage: {
    id: string;
    pageName: string;
    passwordEnabled: boolean;
    monitors: BackendMonitor[];
    customDomain?: string;
    logoName?: string;
    density?: "wide" | "compact";
    alignment?: "left" | "center";
  };
  logsByMonitorId: Record<string, BackendMonitorLog[]>;
  incidentsByMonitorId: Record<string, BackendIncident[]>;
}

export interface SaveStatusPageInput {
  pageName: string;
  monitorIds: string[];
  passwordEnabled?: boolean;
  password?: string;
  customDomain?: string;
  logoName?: string;
  density?: "wide" | "compact";
  alignment?: "left" | "center";
}

export interface SaveStatusPageResponse {
  message: string;
  statusPage: {
    id: string;
    pageName: string;
    monitorIds: string[];
    passwordEnabled: boolean;
    customDomain?: string;
    logoName?: string;
    density?: "wide" | "compact";
    alignment?: "left" | "center";
  };
}

export interface CreateMonitorInput {
  name: string;
  url: string;
  type: "http" | "https" | "ws" | "wss";
  interval?: number;
  timeout?: number;
  httpMethod?: "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "PATCH" | "OPTIONS";
  domainExpiryMode?: "enabled" | "disabled";
  sslExpiryMode?: "enabled" | "disabled";
  ipVersion?: MonitorIpVersion;
  body?: string;
  headers?: Record<string, string>;
  responseValidation?: {
    field: "status";
    mode: "value" | "type";
    expectedValue?: string;
    expectedType?: "string" | "boolean" | "number";
  };
}

export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  type?: "http" | "https" | "ws" | "wss";
  interval?: number;
  timeout?: number;
  httpMethod?: "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "PATCH" | "OPTIONS";
  domainExpiryMode?: "enabled" | "disabled";
  sslExpiryMode?: "enabled" | "disabled";
  ipVersion?: MonitorIpVersion;
  body?: string;
  headers?: Record<string, string>;
  responseValidation?: {
    field: "status";
    mode: "value" | "type";
    expectedValue?: string;
    expectedType?: "string" | "boolean" | "number";
  };
}

export interface CreateIntegrationInput {
  type?: IntegrationProvider;
  endpointUrl: string;
  customValue?: string;
  events?: IntegrationEvent[];
}

export interface CreateMaintenanceInput {
  monitorId: string;
  name?: string;
  reason?: string;
  startAt: string;
  endAt: string;
}

interface UserListResponse {
  users: Array<{
    _id?: string;
    id?: string;
    email: string;
    name: string;
    role: UserRole;
    isActive?: boolean;
  }>;
}

interface InvitationListResponse {
  invitations: Array<{
    _id?: string;
    id?: string;
    name?: string;
    email: string;
    monitorIds?: string[];
    role?: EditableUserRole;
    status: "pending" | "accepted" | "expired";
    expiresAt: string;
    createdAt: string;
  }>;
}

interface InvitationCreateResponse {
  message: string;
  delivery?: "smtp" | "manual-link";
  warning?: string;
  invitationUrl?: string;
  invitation: {
    id: string;
    name: string;
    email: string;
    monitorIds?: string[];
    role?: EditableUserRole;
    status: "pending" | "accepted" | "expired";
    expiresAt: string;
    createdAt: string;
  };
}

interface InvitationByTokenResponse {
  invitation: {
    name?: string;
    email: string;
    role?: EditableUserRole;
    expiresAt: string;
    invitedBy?: unknown;
  };
}

interface AuthMeResponse {
  user: AuthUser;
}

interface MessageResponse {
  message: string;
  delivery?: "smtp" | "development-fallback";
  details?: string;
}

export interface BackendHealthResponse {
  ok?: boolean;
  status: string;
  timestamp: string;
  uptime: number;
  apiKeyConfigured?: boolean;
  model?: string;
}

interface UserMutationResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    isActive: boolean;
    avatar?: string | null;
  };
}

export interface AccountRequestEntry {
  id: string;
  email: string;
  name: string;
  message?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export const isApiError = (value: unknown): value is ApiError =>
  value instanceof ApiError;

const clearLegacyStoredAuthTokens = (): void => {
  if (!isBrowser) return;

  window.localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
};

export const getStoredAuthToken = (): string | null => {
  clearLegacyStoredAuthTokens();
  return null;
};

export const saveAuthToken = (_token: string, _rememberMe: boolean): void => {
  clearLegacyStoredAuthTokens();
};

export const clearStoredAuthToken = (): void => {
  clearLegacyStoredAuthTokens();
};

const getApiErrorMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const direct = record.error ?? record.message;
    const details = record.details;
    if (typeof direct === "string" && direct.trim() !== "") {
      if (typeof details === "string" && details.trim() !== "") {
        return `${direct} (${details})`;
      }
      return direct;
    }

    const validationErrors = record.errors;
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      const firstError = validationErrors[0];
      if (firstError && typeof firstError === "object") {
        const details = firstError as Record<string, unknown>;
        const msg = details.msg;
        const path = details.path;

        if (typeof msg === "string" && msg.trim() !== "") {
          if (typeof path === "string" && path.trim() !== "") {
            return `${msg} (${path})`;
          }
          return msg;
        }
      }
    }
  }
  return fallback;
};

const normalizeList = <T>(payload: unknown, key: string): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const value = record[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }
  return [];
};

const isAccountRequestStatus = (
  value: unknown,
): value is AccountRequestEntry["status"] =>
  value === "pending" || value === "approved" || value === "rejected";

const normalizeAccountRequest = (
  payload: unknown,
): AccountRequestEntry | null => {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const rawId = record.id ?? record._id;
  const id =
    typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
  if (id === "") return null;

  const email = typeof record.email === "string" ? record.email.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const createdAt =
    typeof record.createdAt === "string"
      ? record.createdAt
      : new Date().toISOString();
  const status = isAccountRequestStatus(record.status)
    ? record.status
    : "pending";

  const normalized: AccountRequestEntry = {
    id,
    email,
    name,
    status,
    createdAt,
  };

  if (typeof record.message === "string" && record.message.trim() !== "") {
    normalized.message = record.message.trim();
  }

  if (
    typeof record.approvedAt === "string" &&
    record.approvedAt.trim() !== ""
  ) {
    normalized.approvedAt = record.approvedAt;
  }

  if (
    typeof record.approvedBy === "string" &&
    record.approvedBy.trim() !== ""
  ) {
    normalized.approvedBy = record.approvedBy;
  }

  return normalized;
};

const normalizeAccountRequestList = (
  payload: unknown,
): AccountRequestEntry[] => {
  const rawRequests = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).requests
      : null;

  if (!Array.isArray(rawRequests)) return [];

  return rawRequests
    .map((item) => normalizeAccountRequest(item))
    .filter((item): item is AccountRequestEntry => item !== null);
};

const buildEndpoint = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const sanitizedBase = API_BASE_URL.replace(/\/+$/, "");

  if (isHttpUrl(sanitizedBase)) {
    return `${sanitizedBase}${normalizedPath}`;
  }

  const normalizedBase = sanitizedBase.startsWith("/")
    ? sanitizedBase
    : `/${sanitizedBase}`;

  if (BACKEND_PROXY_TARGET.trim() !== "") {
    return `${BACKEND_PROXY_TARGET.replace(/\/+$/, "")}${normalizedBase}${normalizedPath}`;
  }

  return `${normalizedBase}${normalizedPath}`;
};

const buildDirectBackendEndpoint = (target: string, path: string): string => {
  const sanitizedTarget = target.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiPath =
    normalizedPath.startsWith("/api/") || normalizedPath === "/api"
      ? normalizedPath
      : `/api${normalizedPath}`;
  return `${sanitizedTarget}${apiPath}`;
};

export const resolveAvatarUrl = (
  avatar?: string | null,
): string | undefined => {
  if (typeof avatar !== "string") return undefined;

  const trimmedAvatar = avatar.trim();
  if (trimmedAvatar === "") return undefined;

  try {
    const baseUrl =
      isHttpUrl(API_BASE_URL)
      ? API_BASE_URL
      : BACKEND_PROXY_TARGET.trim() !== ""
        ? BACKEND_PROXY_TARGET
        : isBrowser
          ? window.location.origin
          : null;

    if (!baseUrl) {
      return trimmedAvatar;
    }

    return new URL(trimmedAvatar, baseUrl).toString();
  } catch {
    return trimmedAvatar;
  }
};

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials;
}

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> => {
  const externalSignal = init.signal;
  const controller = new AbortController();
  const resolvedTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_REQUEST_TIMEOUT_MS;
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, resolvedTimeoutMs);

  const abortFromExternalSignal = (): void => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, {
        once: true,
      });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const request = async <T>(
  path: string,
  options?: RequestOptions,
): Promise<T> => {
  const token =
    options?.token && options.token !== COOKIE_AUTH_SENTINEL
      ? options.token
      : null;
  const hasBody = options?.body !== undefined;
  const endpoint = buildEndpoint(path);
  const requestTimeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const isMaintenancePath = path.startsWith("/maintenances");
  const isAuthPath = path.startsWith("/auth/");
  const isAuthRegisterPath = path.startsWith("/auth/register");
  const isRelativeApiBase = !isHttpUrl(API_BASE_URL);
  const directBackendTargets = LOCAL_DIRECT_BACKEND_FALLBACKS.filter(
    (target) => buildDirectBackendEndpoint(target, path) !== endpoint,
  );
  const canTryDirectBackend = directBackendTargets.length > 0;

  const requestInit: RequestInit = {
    method: options?.method ?? "GET",
    cache: "no-store",
    credentials: options?.credentials ?? "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      "Cache-Control": "no-store",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: hasBody ? JSON.stringify(options?.body) : undefined,
    signal: options?.signal,
  };
  const requestMethod = requestInit.method ?? "GET";

  const parseResponsePayload = async (response: Response): Promise<unknown> => {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    const textPayload = await response.text();
    return textPayload || null;
  };

  let response: Response;
  let usedDirectBackend = false;
  try {
    response = await fetchWithTimeout(endpoint, requestInit, requestTimeoutMs);
  } catch (primaryError) {
    let retryResponse: Response | null = null;
    const shouldRetryPrimaryGet = requestMethod === "GET";
    if (shouldRetryPrimaryGet) {
      try {
        await sleep(TRANSIENT_GET_RETRY_DELAY_MS);
        retryResponse = await fetchWithTimeout(
          endpoint,
          requestInit,
          requestTimeoutMs,
        );
      } catch {
        // Fall through to direct backend fallback / final error.
      }
    }

    if (retryResponse) {
      const payload: unknown = await parseResponsePayload(retryResponse);
      if (retryResponse.ok) {
        return payload as T;
      }
      throw new ApiError(
        getApiErrorMessage(
          payload,
          `Requete API echouee (${retryResponse.status})`,
        ),
        retryResponse.status,
        payload,
      );
    }

    if (!canTryDirectBackend) {
      throw new ApiError(
        "Unable to connect to the server (Failed to fetch). Ensure frontend and backend are running.",
        0,
        primaryError,
      );
    }

    let directResponse: Response | null = null;
    for (const target of directBackendTargets) {
      try {
        const candidateResponse = await fetchWithTimeout(
          buildDirectBackendEndpoint(target, path),
          requestInit,
          requestTimeoutMs,
        );
        directResponse = candidateResponse;
        usedDirectBackend = true;

        if (candidateResponse.status !== 404) {
          break;
        }
      } catch {
        // Try the next direct backend target.
      }
    }

    if (!directResponse) {
      throw new ApiError(
        "Unable to connect to the server (Failed to fetch). Ensure the backend is running on localhost.",
        0,
        primaryError,
      );
    }

    response = directResponse;
  }

  let payload: unknown = await parseResponsePayload(response);

  if (!response.ok) {
    const shouldRetryWithDirectBackend =
      !usedDirectBackend &&
      isRelativeApiBase &&
      canTryDirectBackend &&
      (response.status >= 500 ||
        response.status === 405 ||
        (isMaintenancePath && response.status === 404) ||
        (isAuthPath && response.status === 404) ||
        (isAuthRegisterPath && response.status === 403));

    if (shouldRetryWithDirectBackend) {
      for (const target of directBackendTargets) {
        try {
          const directResponse = await fetchWithTimeout(
            buildDirectBackendEndpoint(target, path),
            requestInit,
            requestTimeoutMs,
          );
          const directPayload = await parseResponsePayload(directResponse);

          if (directResponse.ok) {
            return directPayload as T;
          }

          response = directResponse;
          payload = directPayload;

          // For missing maintenance route, keep trying other local backend ports.
          if (!(isMaintenancePath && directResponse.status === 404)) {
            break;
          }
        } catch {
          // Keep the original error if direct retry also fails.
        }
      }
    }

    throw new ApiError(
      getApiErrorMessage(payload, `Requete API echouee (${response.status})`),
      response.status,
      payload,
    );
  }

  return payload as T;
};

export const login = (
  email: string,
  password: string,
  rememberMe = true,
): Promise<AuthResponse> =>
  request<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password, rememberMe },
  });

export const register = (
  email: string,
  password: string,
  name: string,
  rememberMe = true,
): Promise<AuthResponse> =>
  request<AuthResponse>("/auth/register", {
    method: "POST",
    body: { email, password, name, rememberMe },
    credentials: "omit",
  });

export const requestAccountCreation = ({
  email,
  name,
  message,
}: {
  email: string;
  name: string;
  message?: string;
}): Promise<{
  message: string;
  warning?: string;
  request?: AccountRequestEntry;
}> =>
  request<{ message: string; warning?: string; request?: AccountRequestEntry }>(
    "/auth/request-account",
    {
      method: "POST",
      body: { email, name, message },
      credentials: "omit",
    },
  );

export const getAccountRequests = async (
  token: string,
): Promise<{ requests: AccountRequestEntry[] }> => {
  const payload = await request<unknown>("/auth/account-requests", {
    method: "GET",
    token,
  });

  return { requests: normalizeAccountRequestList(payload) };
};

export const approveAccountRequest = (
  requestId: string,
  tempPassword: string,
  role: "user" | "admin",
  monitorIds: string[],
  token: string,
): Promise<{
  message: string;
  user: { id: string; email: string; name: string };
}> =>
  request<{
    message: string;
    user: { id: string; email: string; name: string };
  }>("/auth/approve-request", {
    method: "POST",
    body: { requestId, tempPassword, role, monitorIds },
    token,
  });

export const rejectAccountRequest = (
  requestId: string,
  token: string,
): Promise<{ message: string }> =>
  request<{ message: string }>("/auth/reject-request", {
    method: "POST",
    body: { requestId },
    token,
  });

export const deleteAccountRequests = (
  status: "approved" | "rejected" | undefined,
  token: string,
): Promise<{ message: string; deletedCount: number }> =>
  request<{ message: string; deletedCount: number }>("/auth/account-requests", {
    method: "DELETE",
    body: status ? { status } : {},
    token,
  });

export const checkEmailExists = (email: string): Promise<{ exists: boolean }> =>
  request<{ exists: boolean }>("/auth/check-email", {
    method: "POST",
    body: { email },
    credentials: "omit",
  });

export const requestPasswordReset = (email: string): Promise<MessageResponse> =>
  request<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: { email },
    timeoutMs: EMAIL_DELIVERY_REQUEST_TIMEOUT_MS,
    credentials: "omit",
  });

export const resetPasswordWithCode = (
  email: string,
  code: string,
  newPassword: string,
): Promise<MessageResponse> =>
  request<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: { email, code, newPassword },
    credentials: "omit",
  });

export const changePassword = (
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> =>
  request<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });

export const fetchMe = (token?: string): Promise<AuthMeResponse> =>
  request<AuthMeResponse>("/auth/me", { token });

export const acceptInvitation = (
  token: string,
  password: string,
  rememberMe = true,
  name?: string,
): Promise<AuthResponse> =>
  request<AuthResponse>("/auth/accept-invitation", {
    method: "POST",
    body:
      name && name.trim() !== ""
        ? { token, password, rememberMe, name: name.trim() }
        : { token, password, rememberMe },
  });

export const logout = (): Promise<MessageResponse> =>
  request<MessageResponse>("/auth/logout", {
    method: "POST",
  });

export const fetchMonitors = async (
  token?: string,
): Promise<MonitorListResponse> => {
  const payload = await request<unknown>("/monitors", { token });
  return { monitors: normalizeList<BackendMonitor>(payload, "monitors") };
};

export const fetchIntegrations = (
  token?: string,
): Promise<IntegrationsListResponse> =>
  request<IntegrationsListResponse>("/integrations", { token });

export const fetchMaintenances = (
  token?: string,
  options?: {
    status?: BackendMaintenanceStatus;
    monitorId?: string;
    search?: string;
  },
): Promise<MaintenanceListResponse> => {
  const params = new URLSearchParams();

  if (options?.status) {
    params.set("status", options.status);
  }
  if (options?.monitorId) {
    params.set("monitorId", options.monitorId);
  }
  if (options?.search && options.search.trim() !== "") {
    params.set("search", options.search.trim());
  }

  const query = params.toString();
  const path = query ? `/maintenances?${query}` : "/maintenances";
  return request<unknown>(path, { token }).then((payload) => ({
    maintenances: normalizeList<BackendMaintenance>(payload, "maintenances"),
  }));
};

export const fetchIncidents = (
  token?: string,
  options?: { limit?: number; page?: number; status?: "up" | "down" },
): Promise<IncidentListResponse> => {
  const params = new URLSearchParams();

  if (options?.limit && Number.isFinite(options.limit)) {
    params.set("limit", String(options.limit));
  }
  if (options?.page && Number.isFinite(options.page)) {
    params.set("page", String(options.page));
  }
  if (options?.status) {
    params.set("status", options.status);
  }

  const query = params.toString();
  const path = query ? `/incidents?${query}` : "/incidents";
  return request<IncidentListResponse>(path, { token });
};

export const fetchMonitorLogs = (
  monitorId: string,
  token?: string,
  options?: {
    limit?: number;
    page?: number;
    startDate?: string;
    endDate?: string;
  },
): Promise<MonitorLogsResponse> => {
  const params = new URLSearchParams();

  if (
    options?.limit !== undefined &&
    Number.isFinite(options.limit) &&
    options.limit >= 0
  ) {
    params.set("limit", String(Math.floor(options.limit)));
  }
  if (options?.page && Number.isFinite(options.page)) {
    params.set("page", String(options.page));
  }
  if (options?.startDate) {
    params.set("startDate", options.startDate);
  }
  if (options?.endDate) {
    params.set("endDate", options.endDate);
  }

  const query = params.toString();
  const path = query
    ? `/monitors/${monitorId}/logs?${query}`
    : `/monitors/${monitorId}/logs`;
  return request<MonitorLogsResponse>(path, { token });
};

export const fetchPublicStatusPage = (
  statusPageId: string,
): Promise<PublicStatusPageResponse> =>
  request<PublicStatusPageResponse>(
    `/status-pages/${encodeURIComponent(statusPageId)}/public`,
    { credentials: "omit" },
  );

export const saveStatusPage = (
  statusPageId: string,
  payload: SaveStatusPageInput,
  token?: string,
): Promise<SaveStatusPageResponse> =>
  request<SaveStatusPageResponse>(
    `/status-pages/${encodeURIComponent(statusPageId)}`,
    {
      method: "PUT",
      token,
      body: payload,
    },
  );

export const deleteStatusPage = (
  statusPageId: string,
  token?: string,
): Promise<{ message: string }> =>
  request<{ message: string }>(
    `/status-pages/${encodeURIComponent(statusPageId)}`,
    {
      method: "DELETE",
      token,
    },
  );

export const unlockPublicStatusPage = (
  statusPageId: string,
  password: string,
): Promise<PublicStatusPageResponse> =>
  request<PublicStatusPageResponse>(
    `/status-pages/${encodeURIComponent(statusPageId)}/unlock`,
    {
      method: "POST",
      credentials: "omit",
      body: { password },
    },
  );

export const createMonitor = (
  monitor: CreateMonitorInput,
  token?: string,
): Promise<{ message: string; monitor: BackendMonitor }> =>
  request<{ message: string; monitor: BackendMonitor }>("/monitors", {
    method: "POST",
    token,
    body: monitor,
  });

export const fetchBackendHealth = (): Promise<BackendHealthResponse> =>
  request<BackendHealthResponse>("/health");

export const updateMonitor = (
  monitorId: string,
  payload: UpdateMonitorInput,
  token?: string,
): Promise<{ message: string; monitor: BackendMonitor }> =>
  request<{ message: string; monitor: BackendMonitor }>(
    `/monitors/${monitorId}`,
    {
      method: "PUT",
      token,
      body: payload,
    },
  );

export const createIntegration = (
  input: CreateIntegrationInput,
  token?: string,
): Promise<{ message: string; integration: BackendIntegration }> =>
  request<{ message: string; integration: BackendIntegration }>(
    "/integrations",
    {
      method: "POST",
      token,
      body: input,
    },
  );

export const deleteIntegration = (
  integrationId: string,
  token?: string,
): Promise<{ message: string }> =>
  request<{ message: string }>(`/integrations/${integrationId}`, {
    method: "DELETE",
    token,
  });

export const pauseMonitor = (
  monitorId: string,
  token?: string,
): Promise<{ message: string; monitor: BackendMonitor }> =>
  request<{ message: string; monitor: BackendMonitor }>(
    `/monitors/${monitorId}/pause`,
    {
      method: "POST",
      token,
    },
  );

export const resumeMonitor = (
  monitorId: string,
  token?: string,
): Promise<{ message: string; monitor: BackendMonitor }> =>
  request<{ message: string; monitor: BackendMonitor }>(
    `/monitors/${monitorId}/resume`,
    {
      method: "POST",
      token,
    },
  );

export const checkMonitor = (
  monitorId: string,
  token?: string,
): Promise<{
  message: string;
  result: {
    status: "up" | "down";
    responseTime: number;
    statusCode?: number;
    errorMessage?: string;
  };
  monitor: BackendMonitor;
}> =>
  request<{
    message: string;
    result: {
      status: "up" | "down";
      responseTime: number;
      statusCode?: number;
      errorMessage?: string;
    };
    monitor: BackendMonitor;
  }>(`/monitors/${monitorId}/check`, {
    method: "POST",
    token,
  });

export const testMonitorConfiguration = (
  monitor: CreateMonitorInput,
  token?: string,
): Promise<{
  message: string;
  result: {
    status: "up" | "down";
    responseTime: number;
    statusCode?: number;
    errorMessage?: string;
    isMatch: boolean;
  };
}> =>
  request<{
    message: string;
    result: {
      status: "up" | "down";
      responseTime: number;
      statusCode?: number;
      errorMessage?: string;
      isMatch: boolean;
    };
  }>("/monitors/test", {
    method: "POST",
    token,
    body: monitor,
  });

export const deleteMonitor = (
  monitorId: string,
  token?: string,
): Promise<{ message: string }> =>
  request<{ message: string }>(`/monitors/${monitorId}`, {
    method: "DELETE",
    token,
  });

export const shareMonitorWithUser = (
  monitorId: string,
  userId: string,
  token?: string,
): Promise<{ message: string; warning?: string; monitor: BackendMonitor }> =>
  request<{ message: string; warning?: string; monitor: BackendMonitor }>(
    `/monitors/${monitorId}/share`,
    {
      method: "POST",
      token,
      body: { userId },
      timeoutMs: EMAIL_DELIVERY_REQUEST_TIMEOUT_MS,
    },
  );

export const removeMonitorShare = (
  monitorId: string,
  userId: string,
  token?: string,
): Promise<{ message: string; monitor: BackendMonitor }> =>
  request<{ message: string; monitor: BackendMonitor }>(
    `/monitors/${monitorId}/share/${userId}`,
    {
      method: "DELETE",
      token,
    },
  );

export const createMaintenance = (
  input: CreateMaintenanceInput,
  token?: string,
): Promise<{ message: string; maintenance: BackendMaintenance }> =>
  request<{ message: string; maintenance: BackendMaintenance }>(
    "/maintenances",
    {
      method: "POST",
      token,
      body: input,
    },
  );

export const startMaintenance = (
  maintenanceId: string,
  token?: string,
): Promise<{ message: string; maintenance: BackendMaintenance }> =>
  request<{ message: string; maintenance: BackendMaintenance }>(
    `/maintenances/${maintenanceId}/start`,
    {
      method: "POST",
      token,
    },
  );

export const pauseMaintenance = (
  maintenanceId: string,
  token?: string,
): Promise<{ message: string; maintenance: BackendMaintenance }> =>
  request<{ message: string; maintenance: BackendMaintenance }>(
    `/maintenances/${maintenanceId}/pause`,
    {
      method: "POST",
      token,
    },
  );

export const resumeMaintenance = (
  maintenanceId: string,
  token?: string,
): Promise<{ message: string; maintenance: BackendMaintenance }> =>
  request<{ message: string; maintenance: BackendMaintenance }>(
    `/maintenances/${maintenanceId}/resume`,
    {
      method: "POST",
      token,
    },
  );

export const deleteMaintenance = (
  maintenanceId: string,
  token?: string,
): Promise<{ message: string }> =>
  request<{ message: string }>(`/maintenances/${maintenanceId}`, {
    method: "DELETE",
    token,
  });

export const fetchUsers = (token?: string): Promise<UserListResponse> =>
  request<UserListResponse>("/users", { token });

export const fetchInvitations = (
  token?: string,
): Promise<InvitationListResponse> =>
  request<InvitationListResponse>("/invitations", { token });

export const fetchInvitationByToken = (
  token: string,
): Promise<InvitationByTokenResponse> =>
  request<InvitationByTokenResponse>(
    `/invitations/${encodeURIComponent(token)}`,
    { credentials: "omit" },
  );

export const createInvitation = (
  name: string,
  email: string,
  monitorIds: string[] = [],
  token?: string,
  role?: "admin" | "member",
): Promise<InvitationCreateResponse> =>
  request<InvitationCreateResponse>("/invitations", {
    method: "POST",
    token,
    body:
      role && role.trim() !== ""
        ? { name, email, monitorIds, role: role === "admin" ? "admin" : "user" }
        : { name, email, monitorIds },
    timeoutMs: EMAIL_DELIVERY_REQUEST_TIMEOUT_MS,
  });

export const deleteUser = (
  userId: string,
  token?: string,
): Promise<{ message: string }> =>
  request<{ message: string }>(`/users/${userId}`, {
    method: "DELETE",
    token,
  });

export const updateUser = (
  userId: string,
  payload: Partial<{
    role: EditableUserRole;
    isActive: boolean;
    name: string;
    email: string;
  }>,
  token?: string,
): Promise<UserMutationResponse> =>
  request<UserMutationResponse>(`/users/${userId}`, {
    method: "PUT",
    token,
    body: payload,
  });

export const updateMe = (
  payload: Partial<{
    name: string;
    email: string;
  }>,
  token?: string,
): Promise<UserMutationResponse> =>
  request<UserMutationResponse>(`/users/me`, {
    method: "PUT",
    token,
    body: payload,
  });

export const uploadAvatar = async (
  file: File,
  token?: string,
): Promise<{ message: string; avatarUrl: string }> => {
  const fd = new FormData();
  fd.append("avatar", file);

  const headers: Record<string, string> = {};
  if (token && token !== COOKIE_AUTH_SENTINEL) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(buildEndpoint("/users/me/avatar"), {
    method: "POST",
    headers,
    body: fd,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed: ${res.status}`);
  }

  return res.json();
};

export const deleteInvitation = (
  invitationId: string,
  token?: string,
): Promise<{ message: string }> =>
  request<{ message: string }>(`/invitations/${invitationId}`, {
    method: "DELETE",
    token,
  });
