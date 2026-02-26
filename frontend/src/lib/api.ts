const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const rawBackendProxyTarget = (import.meta.env.VITE_BACKEND_PROXY_TARGET as string | undefined)?.trim();

const API_BASE_URL = rawApiBaseUrl || '/api';
const BACKEND_PROXY_TARGET = rawBackendProxyTarget || 'http://localhost:3003';

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

export interface CreateMonitorInput {
  name: string;
  url: string;
  type: 'http' | 'https' | 'ws' | 'wss';
  interval?: number;
  timeout?: number;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
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
    email: string;
    status: 'pending' | 'accepted' | 'expired';
    expiresAt: string;
    createdAt: string;
  }>;
}

interface InvitationCreateResponse {
  message: string;
  invitation: {
    id: string;
    email: string;
    status: 'pending' | 'accepted' | 'expired';
    expiresAt: string;
    createdAt: string;
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
  const canTryDirectBackend =
    isLocalhostRuntime() &&
    !isHttpUrl(API_BASE_URL) &&
    isHttpUrl(BACKEND_PROXY_TARGET);

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

    try {
      response = await fetch(`${BACKEND_PROXY_TARGET}${endpoint}`, requestInit);
      usedDirectBackend = true;
    } catch (directError) {
      throw new ApiError(
        `Connexion impossible au serveur (Failed to fetch). Verifiez le backend sur ${BACKEND_PROXY_TARGET}.`,
        0,
        directError
      );
    }
  }

  let payload: unknown = await parseResponsePayload(response);

  if (!response.ok) {
    if (!usedDirectBackend && canTryDirectBackend && response.status >= 500) {
      try {
        const directResponse = await fetch(`${BACKEND_PROXY_TARGET}${endpoint}`, requestInit);
        const directPayload = await parseResponsePayload(directResponse);

        if (directResponse.ok) {
          return directPayload as T;
        }

        response = directResponse;
        payload = directPayload;
      } catch {
        // Keep the original server error if direct retry also fails.
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

export const fetchMonitors = (token?: string): Promise<MonitorListResponse> =>
  request<MonitorListResponse>('/monitors', { token });

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

export const fetchUsers = (token?: string): Promise<UserListResponse> =>
  request<UserListResponse>('/users', { token });

export const fetchInvitations = (token?: string): Promise<InvitationListResponse> =>
  request<InvitationListResponse>('/invitations', { token });

export const createInvitation = (email: string, token?: string): Promise<InvitationCreateResponse> =>
  request<InvitationCreateResponse>('/invitations', {
    method: 'POST',
    token,
    body: { email },
  });
