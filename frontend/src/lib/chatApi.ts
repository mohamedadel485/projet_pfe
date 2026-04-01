const rawApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.trim();
const rawBackendProxyTarget = (
  import.meta.env.VITE_BACKEND_PROXY_TARGET as string | undefined
)?.trim();

const CHAT_API_BASE_URL = rawApiBaseUrl || '/api';
const BACKEND_PROXY_TARGET = rawBackendProxyTarget || 'http://localhost:3001';
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);
const ensureLeadingSlash = (value: string): string => (value.startsWith('/') ? value : `/${value}`);
const ensureApiPath = (path: string): string => {
  const normalizedPath = ensureLeadingSlash(path);
  return normalizedPath.startsWith('/api/') || normalizedPath === '/api'
    ? normalizedPath
    : `/api${normalizedPath}`;
};

const buildEndpointFromBase = (base: string, path: string): string => {
  const trimmedBase = base.trim().replace(/\/+$/, '');
  const normalizedPath = ensureLeadingSlash(path);

  if (trimmedBase === '') {
    return ensureApiPath(normalizedPath);
  }

  if (isHttpUrl(trimmedBase)) {
    try {
      const resolvedUrl = new URL(trimmedBase);
      const currentPathname = resolvedUrl.pathname.replace(/\/+$/, '');
      const nextPathname =
        currentPathname === '/api' || currentPathname.endsWith('/api')
          ? `${currentPathname}${normalizedPath}`
          : `${currentPathname}${ensureApiPath(normalizedPath)}`;
      resolvedUrl.pathname = nextPathname;
      return resolvedUrl.toString();
    } catch {
      return `${trimmedBase}${ensureApiPath(normalizedPath)}`;
    }
  }

  const normalizedBase = ensureLeadingSlash(trimmedBase);
  if (normalizedBase === '/api' || normalizedBase.endsWith('/api')) {
    return `${normalizedBase}${normalizedPath}`;
  }

  return `${normalizedBase}${ensureApiPath(normalizedPath)}`;
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const externalSignal = init.signal;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const abortFromExternalSignal = (): void => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortFromExternalSignal, {
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
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
};

const buildConfiguredEndpoint = (path: string): string => buildEndpointFromBase(CHAT_API_BASE_URL, path);
const buildDirectBackendEndpoint = (target: string, path: string): string => buildEndpointFromBase(target, path);

const buildRequestCandidates = (path: string): string[] => {
  const candidates = [buildConfiguredEndpoint(path)];

  const directTargets = Array.from(
    new Set(
      [
        BACKEND_PROXY_TARGET,
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
      ].filter((target) => target.trim() !== ''),
    ),
  );

  directTargets.forEach((target) => {
    const endpoint = buildDirectBackendEndpoint(target, path);
    if (!candidates.includes(endpoint)) {
      candidates.push(endpoint);
    }
  });

  return candidates;
};

const shouldRetryWithNextCandidate = (response: Response): boolean =>
  response.status === 404 || response.status === 405 || response.status >= 500;

export const fetchChatResponse = async (
  path: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> => {
  const candidates = buildRequestCandidates(path);
  let lastError: unknown = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const endpoint = candidates[index];

    try {
      const response = await fetchWithTimeout(endpoint, init, timeoutMs);
      if (response.ok) {
        return response;
      }

      const hasAnotherCandidate = index < candidates.length - 1;
      if (hasAnotherCandidate && shouldRetryWithNextCandidate(response)) {
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (index === candidates.length - 1) {
        break;
      }
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError') {
    throw new Error("Le chatbot ne repond pas a temps. Verifie l'URL backend ou le proxy en production.");
  }

  if (lastError instanceof Error) {
    if (/failed to fetch/i.test(lastError.message)) {
      throw new Error(
        "Impossible de joindre le service d'assistant. Verifie VITE_API_BASE_URL, l'URL backend, le proxy nginx et CORS en production.",
      );
    }

    throw lastError;
  }

  throw new Error("Impossible de joindre le service d'assistant.");
};
