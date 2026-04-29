const rawApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.trim();
const rawBackendProxyTarget = (
  import.meta.env.VITE_BACKEND_PROXY_TARGET as string | undefined
)?.trim();

const CHAT_API_BASE_URL = rawApiBaseUrl || "/api";
const BACKEND_PROXY_TARGET = rawBackendProxyTarget || "";
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const CHAT_REQUEST_TIMEOUT_MESSAGE = 'The chatbot is taking too long to respond. Please try again in a moment.';

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const externalSignal = init.signal;
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

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
  } catch (error) {
    if (didTimeout) {
      throw new Error(CHAT_REQUEST_TIMEOUT_MESSAGE);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
};

const buildRelativeEndpoint = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = CHAT_API_BASE_URL.replace(/\/+$/, "");

  if (isHttpUrl(base)) {
    return `${base}${normalizedPath}`;
  }

  const normalizedBase = base.startsWith("/") ? base : `/${base}`;
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

const buildRequestCandidates = (path: string): string[] => {
  const candidates = [buildRelativeEndpoint(path)];

  if (isHttpUrl(CHAT_API_BASE_URL) || !import.meta.env.DEV) {
    return candidates;
  }

  const directTargets = Array.from(
    new Set(
      [BACKEND_PROXY_TARGET].filter((target) => target.trim() !== ""),
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

const CHAT_STREAM_ERROR_MARKER = '\n\n[error]';
const GENERIC_CHAT_ERROR_MESSAGE = 'The chatbot encountered a temporary error. Please try again in a moment.';
const QUOTA_CHAT_ERROR_MESSAGE =
  'Gemini quota reached. Try again shortly or check your plan and billing.';
const UNAVAILABLE_CHAT_ERROR_MESSAGE =
  'The Gemini service is temporarily overloaded. Please try again in a moment.';
const API_KEY_CHAT_ERROR_MESSAGE =
  'The GEMINI_API_KEY (or GOOGLE_API_KEY) is missing or invalid. Check your backend configuration.';

const parseJsonMaybe = (value: string): unknown => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
};

const readNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
};

const readString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return null;
};

const extractChatErrorDetails = (
  rawMessage: string,
): {
  code: number | null;
  status: string;
  message: string;
} => {
  const trimmed = rawMessage.trim();
  if (trimmed === '') {
    return {
      code: null,
      status: '',
      message: '',
    };
  }

  const jsonStart = trimmed.indexOf('{');
  const parsedOuter = asRecord(parseJsonMaybe(jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed));
  const outerError = parsedOuter && asRecord(parsedOuter.error) ? asRecord(parsedOuter.error) : parsedOuter;

  const parsedInner =
    outerError && typeof outerError.message === 'string' ? asRecord(parseJsonMaybe(outerError.message)) : null;
  const innerError = parsedInner && asRecord(parsedInner.error) ? asRecord(parsedInner.error) : parsedInner;

  const code = readNumber(outerError?.code, innerError?.code, parsedInner?.code, parsedOuter?.code);
  const status = readString(outerError?.status, innerError?.status, parsedInner?.status, parsedOuter?.status) ?? '';
  const message =
    readString(innerError?.message, parsedInner?.message, outerError?.message, trimmed) ?? trimmed;

  return {
    code,
    status,
    message,
  };
};

export const formatChatErrorMessage = (rawMessage: string): string => {
  const { code, status, message } = extractChatErrorDetails(rawMessage);
  const combined = `${status} ${message}`.toLowerCase();

  if (
    code === 429 ||
    combined.includes('quota') ||
    combined.includes('resource_exhausted') ||
    combined.includes('too many requests') ||
    combined.includes('rate limit')
  ) {
    return QUOTA_CHAT_ERROR_MESSAGE;
  }

  if (
    code === 503 ||
    combined.includes('unavailable') ||
    combined.includes('high demand') ||
    combined.includes('temporarily') ||
    combined.includes('try again later') ||
    combined.includes('spikes in demand') ||
    combined.includes('too many requests') ||
    combined.includes('rate limit')
  ) {
    return UNAVAILABLE_CHAT_ERROR_MESSAGE;
  }

  if (
    combined.includes('api key') ||
    combined.includes('gemini_api_key')
  ) {
    return API_KEY_CHAT_ERROR_MESSAGE;
  }

  if (message === '' || /^\{.*\}$/.test(message)) {
    return GENERIC_CHAT_ERROR_MESSAGE;
  }

  return message;
};

export interface ParsedChatStreamResult {
  content: string;
  errorMessage: string | null;
}

export const parseChatStreamText = (rawText: string): ParsedChatStreamResult => {
  const markerIndex = rawText.indexOf(CHAT_STREAM_ERROR_MARKER);
  if (markerIndex < 0) {
    return {
      content: rawText,
      errorMessage: null,
    };
  }

  const content = rawText.slice(0, markerIndex).trimEnd();
  const errorMessage = formatChatErrorMessage(rawText.slice(markerIndex + CHAT_STREAM_ERROR_MARKER.length).trim());

  return {
    content,
    errorMessage,
  };
};

export const readChatResponseError = async (response: Response): Promise<string> => {
  const rawBody = (await response.text()).trim();
  if (rawBody === '') {
    return `Request failed (${response.status})`;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = JSON.parse(rawBody) as Record<string, unknown>;
      const directError =
        typeof payload.error === 'string'
          ? payload.error
          : typeof payload.message === 'string'
            ? payload.message
            : '';
      if (directError !== '') {
        return formatChatErrorMessage(directError);
      }
    } catch {
      // Fall back to the raw text below.
    }
  }

  return formatChatErrorMessage(rawBody);
};

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

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Unable to reach the assistant service.");
};
