const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const rawBackendProxyTarget = (import.meta.env.VITE_BACKEND_PROXY_TARGET as string | undefined)?.trim();

const API_BASE_URL = rawApiBaseUrl || '/api';
const BACKEND_PROXY_TARGET = rawBackendProxyTarget || 'http://localhost:3003';
const LOCAL_DIRECT_BACKEND_FALLBACKS = ['http://localhost:3004', 'http://localhost:3001', 'http://localhost:3003'];

const isBrowser = typeof window !== 'undefined';
const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);
const isLocalhostRuntime = (): boolean =>
  isBrowser &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const AUTH_LOCAL_STORAGE_KEY = 'uptimewarden_auth_token';
const AUTH_SESSION_STORAGE_KEY = 'uptimewarden_auth_session_token';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  type: 'http' | 'https' | 'ws' | 'wss';
  interval: number;
  timeout: number;
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  expectedStatusCode: number;
  status: 'up' | 'down' | 'paused' | 'pending';
  uptime: number;
  responseTime: number;
  lastChecked?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorListResponse {
  monitors: BackendMonitor[];
}

export type BackendMaintenanceStatus = 'scheduled' | 'ongoing' | 'paused' | 'completed' | 'cancelled';

export interface BackendMaintenanceMonitor {
  _id: string;
  name: string;
  url: string;
  type: 'http' | 'https' | 'ws' | 'wss';
  status: 'up' | 'down' | 'paused' | 'pending';
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
  type: 'http' | 'https' | 'ws' | 'wss';
  expectedStatusCode: number;
}

export interface BackendIncident {
  _id: string;
  monitor: BackendIncidentMonitor | null;
  status: 'up' | 'down';
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
  status: 'up' | 'down';
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

export interface CreateMonitorInput {
  name: string;
  url: string;
  type: 'http' | 'https' | 'ws' | 'wss';
  interval?: number;
  timeout?: number;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
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
    status: 'pending' | 'accepted' | 'expired';
    expiresAt: string;
    createdAt: string;
  }>;
}

interface InvitationCreateResponse {
  message: string;
  invitation: {
    id: string;
    name: string;
    email: string;
    monitorIds?: string[];
    status: 'pending' | 'accepted' | 'expired';
    expiresAt: string;
    createdAt: string;
  };
}

interface InvitationByTokenResponse {
  invitation: {
    name?: string;
    email: string;
    expiresAt: string;
    invitedBy?: unknown;
  };
}

interface AuthMeResponse {
  user: AuthUser;
}

interface MessageResponse {
  message: string;
  delivery?: 'smtp' | 'development-fallback';
  details?: string;
}

interface UserMutationResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    isActive: boolean;
  };
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

export const getStoredAuthToken = (): string | null => {
  if (!isBrowser) return null;

  return (
    window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY) ??
    window.localStorage.getItem(AUTH_LOCAL_STORAGE_KEY)
  );
};

export const saveAuthToken = (token: string, rememberMe: boolean): void => {
  if (!isBrowser) return;

  window.localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);

  if (rememberMe) {
    window.localStorage.setItem(AUTH_LOCAL_STORAGE_KEY, token);
    return;
  }

  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, token);
};

export const clearStoredAuthToken = (): void => {
  if (!isBrowser) return;

  window.localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
};

const getApiErrorMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const direct = record.error ?? record.message;
    const details = record.details;
    if (typeof direct === 'string' && direct.trim() !== '') {
      if (typeof details === 'string' && details.trim() !== '') {
        return `${direct} (${details})`;
      }
      return direct;
    }

    const validationErrors = record.errors;
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      const firstError = validationErrors[0];
      if (firstError && typeof firstError === 'object') {
        const details = firstError as Record<string, unknown>;
        const msg = details.msg;
        const path = details.path;

        if (typeof msg === 'string' && msg.trim() !== '') {
          if (typeof path === 'string' && path.trim() !== '') {
            return `${msg} (${path})`;
          }
          return msg;
        }
      }
    }
  }
  return fallback;
};

const buildEndpoint = (path: string): string => {
  if (!path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`;
  }

  return `${API_BASE_URL}${path}`;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
}

const request = async <T>(path: string, options?: RequestOptions): Promise<T> => {
  const token = options?.token ?? getStoredAuthToken();
  const hasBody = options?.body !== undefined;
  const endpoint = buildEndpoint(path);
  const isMaintenancePath = path.startsWith('/maintenances');
  const directBackendTargets =
    isLocalhostRuntime() && !isHttpUrl(API_BASE_URL)
      ? Array.from(
          new Set(
            [BACKEND_PROXY_TARGET, ...LOCAL_DIRECT_BACKEND_FALLBACKS].filter((target) => isHttpUrl(target))
          )
        )
      : [];
  const canTryDirectBackend =
    directBackendTargets.length > 0;

  const requestInit: RequestInit = {
    method: options?.method ?? 'GET',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: hasBody ? JSON.stringify(options?.body) : undefined,
    signal: options?.signal,
  };

  const parseResponsePayload = async (response: Response): Promise<unknown> => {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    const textPayload = await response.text();
    return textPayload || null;
  };

  let response: Response;
  let usedDirectBackend = false;
  try {
    response = await fetch(endpoint, requestInit);
  } catch (primaryError) {
    if (!canTryDirectBackend) {
      throw new ApiError(
        'Connexion impossible au serveur (Failed to fetch). Verifiez que frontend et backend sont demarres.',
        0,
        primaryError
      );
    }

    let directResponse: Response | null = null;
    for (const target of directBackendTargets) {
      try {
        const candidateResponse = await fetch(`${target}${endpoint}`, requestInit);
        directResponse = candidateResponse;
        usedDirectBackend = true;

        if (!isMaintenancePath || candidateResponse.status !== 404) {
          break;
        }
      } catch {
        // Try the next direct backend target.
      }
    }

    if (!directResponse) {
      throw new ApiError(
        `Connexion impossible au serveur (Failed to fetch). Verifiez le backend sur ${directBackendTargets[0] ?? BACKEND_PROXY_TARGET}.`,
        0,
        primaryError
      );
    }

    response = directResponse;
  }

  let payload: unknown = await parseResponsePayload(response);

  if (!response.ok) {
    const shouldRetryWithDirectBackend =
      !usedDirectBackend &&
      canTryDirectBackend &&
      (response.status >= 500 || (isMaintenancePath && response.status === 404));

    if (shouldRetryWithDirectBackend) {
      for (const target of directBackendTargets) {
        try {
          const directResponse = await fetch(`${target}${endpoint}`, requestInit);
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
      payload
    );
  }

  return payload as T;
};

export const login = (email: string, password: string): Promise<AuthResponse> =>
  request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

export const requestPasswordReset = (email: string): Promise<MessageResponse> =>
  request<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });

export const resetPasswordWithCode = (
  email: string,
  code: string,
  newPassword: string
): Promise<MessageResponse> =>
  request<MessageResponse>('/auth/reset-password', {
    method: 'POST',
    body: { email, code, newPassword },
  });

export const fetchMe = (token?: string): Promise<AuthMeResponse> =>
  request<AuthMeResponse>('/auth/me', { token });

export const acceptInvitation = (
  token: string,
  password: string,
  name?: string
): Promise<AuthResponse> =>
  request<AuthResponse>('/auth/accept-invitation', {
    method: 'POST',
    body: name && name.trim() !== '' ? { token, password, name: name.trim() } : { token, password },
  });

export const fetchMonitors = (token?: string): Promise<MonitorListResponse> =>
  request<MonitorListResponse>('/monitors', { token });

export const fetchMaintenances = (
  token?: string,
  options?: { status?: BackendMaintenanceStatus; monitorId?: string; search?: string }
): Promise<MaintenanceListResponse> => {
  const params = new URLSearchParams();

  if (options?.status) {
    params.set('status', options.status);
  }
  if (options?.monitorId) {
    params.set('monitorId', options.monitorId);
  }
  if (options?.search && options.search.trim() !== '') {
    params.set('search', options.search.trim());
  }

  const query = params.toString();
  const path = query ? `/maintenances?${query}` : '/maintenances';
  return request<MaintenanceListResponse>(path, { token });
};

export const fetchIncidents = (
  token?: string,
  options?: { limit?: number; page?: number; status?: 'up' | 'down' }
): Promise<IncidentListResponse> => {
  const params = new URLSearchParams();

  if (options?.limit && Number.isFinite(options.limit)) {
    params.set('limit', String(options.limit));
  }
  if (options?.page && Number.isFinite(options.page)) {
    params.set('page', String(options.page));
  }
  if (options?.status) {
    params.set('status', options.status);
  }

  const query = params.toString();
  const path = query ? `/incidents?${query}` : '/incidents';
  return request<IncidentListResponse>(path, { token });
};

export const fetchMonitorLogs = (
  monitorId: string,
  token?: string,
  options?: { limit?: number; page?: number }
): Promise<MonitorLogsResponse> => {
  const params = new URLSearchParams();

  if (options?.limit && Number.isFinite(options.limit)) {
    params.set('limit', String(options.limit));
  }
  if (options?.page && Number.isFinite(options.page)) {
    params.set('page', String(options.page));
  }

  const query = params.toString();
  const path = query ? `/monitors/${monitorId}/logs?${query}` : `/monitors/${monitorId}/logs`;
  return request<MonitorLogsResponse>(path, { token });
};

export const createMonitor = (
  monitor: CreateMonitorInput,
  token?: string
): Promise<{ message: string; monitor: BackendMonitor }> =>
  request<{ message: string; monitor: BackendMonitor }>('/monitors', {
    method: 'POST',
    token,
    body: monitor,
  });

export const pauseMonitor = (
  monitorId: string,
  token?: string
): Promise<{ message: string; monitor: BackendMonitor }> =>
  request<{ message: string; monitor: BackendMonitor }>(`/monitors/${monitorId}/pause`, {
    method: 'POST',
    token,
  });

export const resumeMonitor = (
  monitorId: string,
  token?: string
): Promise<{ message: string; monitor: BackendMonitor }> =>
  request<{ message: string; monitor: BackendMonitor }>(`/monitors/${monitorId}/resume`, {
    method: 'POST',
    token,
  });

export const checkMonitor = (
  monitorId: string,
  token?: string
): Promise<{
  message: string;
  result: { status: 'up' | 'down'; responseTime: number; statusCode?: number; errorMessage?: string };
  monitor: BackendMonitor;
}> =>
  request<{
    message: string;
    result: { status: 'up' | 'down'; responseTime: number; statusCode?: number; errorMessage?: string };
    monitor: BackendMonitor;
  }>(`/monitors/${monitorId}/check`, {
    method: 'POST',
    token,
  });

export const deleteMonitor = (monitorId: string, token?: string): Promise<{ message: string }> =>
  request<{ message: string }>(`/monitors/${monitorId}`, {
    method: 'DELETE',
    token,
  });

export const createMaintenance = (
  input: CreateMaintenanceInput,
  token?: string
): Promise<{ message: string; maintenance: BackendMaintenance }> =>
  request<{ message: string; maintenance: BackendMaintenance }>('/maintenances', {
    method: 'POST',
    token,
    body: input,
  });

export const startMaintenance = (
  maintenanceId: string,
  token?: string
): Promise<{ message: string; maintenance: BackendMaintenance }> =>
  request<{ message: string; maintenance: BackendMaintenance }>(`/maintenances/${maintenanceId}/start`, {
    method: 'POST',
    token,
  });

export const pauseMaintenance = (
  maintenanceId: string,
  token?: string
): Promise<{ message: string; maintenance: BackendMaintenance }> =>
  request<{ message: string; maintenance: BackendMaintenance }>(`/maintenances/${maintenanceId}/pause`, {
    method: 'POST',
    token,
  });

export const resumeMaintenance = (
  maintenanceId: string,
  token?: string
): Promise<{ message: string; maintenance: BackendMaintenance }> =>
  request<{ message: string; maintenance: BackendMaintenance }>(`/maintenances/${maintenanceId}/resume`, {
    method: 'POST',
    token,
  });

export const deleteMaintenance = (
  maintenanceId: string,
  token?: string
): Promise<{ message: string }> =>
  request<{ message: string }>(`/maintenances/${maintenanceId}`, {
    method: 'DELETE',
    token,
  });

export const fetchUsers = (token?: string): Promise<UserListResponse> =>
  request<UserListResponse>('/users', { token });

export const fetchInvitations = (token?: string): Promise<InvitationListResponse> =>
  request<InvitationListResponse>('/invitations', { token });

export const fetchInvitationByToken = (token: string): Promise<InvitationByTokenResponse> =>
  request<InvitationByTokenResponse>(`/invitations/${encodeURIComponent(token)}`);

export const createInvitation = (
  name: string,
  email: string,
  monitorIds: string[] = [],
  token?: string
): Promise<InvitationCreateResponse> =>
  request<InvitationCreateResponse>('/invitations', {
    method: 'POST',
    token,
    body: { name, email, monitorIds },
  });

export const deleteUser = (userId: string, token?: string): Promise<{ message: string }> =>
  request<{ message: string }>(`/users/${userId}`, {
    method: 'DELETE',
    token,
  });

export const updateUser = (
  userId: string,
  payload: Partial<{ role: UserRole; isActive: boolean; name: string; email: string }>,
  token?: string
): Promise<UserMutationResponse> =>
  request<UserMutationResponse>(`/users/${userId}`, {
    method: 'PUT',
    token,
    body: payload,
  });

export const deleteInvitation = (invitationId: string, token?: string): Promise<{ message: string }> =>
  request<{ message: string }>(`/invitations/${invitationId}`, {
    method: 'DELETE',
    token,
  });
