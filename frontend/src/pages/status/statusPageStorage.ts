import type { PublicStatusPageResponse } from '../../lib/api';

export type StatusPageDensity = 'wide' | 'compact';
export type StatusPageAlignment = 'left' | 'center';

export interface StoredStatusPageSettings {
  pageName?: string;
  customDomain?: string;
  logoName?: string;
  password?: string;
  passwordEnabled?: boolean;
  density?: StatusPageDensity;
  alignment?: StatusPageAlignment;
}

interface LocalStatusPageSummary {
  id: string;
  settings: StoredStatusPageSettings;
  monitorIds: string[];
}

const STATUS_PAGE_REGISTRY_STORAGE_KEY = 'uptimewarden_status_pages_registry';
const STATUS_PAGE_SETTINGS_STORAGE_PREFIX = 'uptimewarden_status_page_settings_';
const STATUS_PAGE_MONITOR_STORAGE_PREFIX = 'uptimewarden_status_page_monitors_';
const PUBLIC_STATUS_PAGE_CACHE_PREFIX = 'uptimewarden_public_status_page_cache_';

const readJsonValue = <T>(rawValue: string | null): T | null => {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
};

const writeJsonValue = (storageKey: string, value: unknown): void => {
  window.localStorage.setItem(storageKey, JSON.stringify(value));
};

export const getStatusPageSettingsStorageKey = (statusPageId: string) =>
  `${STATUS_PAGE_SETTINGS_STORAGE_PREFIX}${statusPageId}`;

export const getStatusPageMonitorStorageKey = (statusPageId: string) =>
  `${STATUS_PAGE_MONITOR_STORAGE_PREFIX}${statusPageId}`;

const getStatusPageRegistryStorageKey = () => STATUS_PAGE_REGISTRY_STORAGE_KEY;

const getPublicStatusPageCacheKey = (statusPageId: string) =>
  `${PUBLIC_STATUS_PAGE_CACHE_PREFIX}${statusPageId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const createStatusPageId = (): string => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `status-page-${window.crypto.randomUUID()}`;
  }

  return `status-page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const readStoredStatusPageSettings = (statusPageId: string): StoredStatusPageSettings => {
  try {
    const storedValue = window.localStorage.getItem(getStatusPageSettingsStorageKey(statusPageId));
    const parsedValue = readJsonValue<StoredStatusPageSettings>(storedValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch {
    return {};
  }
};

export const writeStoredStatusPageSettings = (
  statusPageId: string,
  settings: StoredStatusPageSettings,
): void => {
  try {
    writeJsonValue(getStatusPageSettingsStorageKey(statusPageId), settings);
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
};

export const readStoredStatusPageMonitorIds = (statusPageId: string): string[] => {
  try {
    const storedValue = window.localStorage.getItem(getStatusPageMonitorStorageKey(statusPageId));
    const parsedValue = readJsonValue<unknown>(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    const uniqueMonitorIds = new Set<string>();
    for (const monitorId of parsedValue) {
      if (typeof monitorId !== 'string') continue;
      const trimmedMonitorId = monitorId.trim();
      if (trimmedMonitorId === '') continue;
      uniqueMonitorIds.add(trimmedMonitorId);
    }

    return [...uniqueMonitorIds];
  } catch {
    return [];
  }
};

export const writeStoredStatusPageMonitorIds = (statusPageId: string, monitorIds: string[]): void => {
  try {
    const nextMonitorIds = Array.from(
      new Set(
        monitorIds
          .filter((monitorId): monitorId is string => typeof monitorId === 'string')
          .map((monitorId) => monitorId.trim())
          .filter((monitorId) => monitorId !== ''),
      ),
    );

    writeJsonValue(getStatusPageMonitorStorageKey(statusPageId), nextMonitorIds);
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
};

const readStatusPageRegistry = (): string[] => {
  try {
    const storedValue = window.localStorage.getItem(getStatusPageRegistryStorageKey());
    const parsedValue = readJsonValue<unknown>(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    const uniqueStatusPageIds = new Set<string>();
    for (const statusPageId of parsedValue) {
      if (typeof statusPageId !== 'string') continue;
      const trimmedStatusPageId = statusPageId.trim();
      if (trimmedStatusPageId === '') continue;
      uniqueStatusPageIds.add(trimmedStatusPageId);
    }

    return [...uniqueStatusPageIds];
  } catch {
    return [];
  }
};

const writeStatusPageRegistry = (statusPageIds: string[]): void => {
  writeJsonValue(getStatusPageRegistryStorageKey(), statusPageIds);
};

export const registerStatusPage = (statusPageId: string): void => {
  if (!statusPageId.trim()) return;

  try {
    const nextStatusPageIds = [statusPageId.trim(), ...readStatusPageRegistry().filter((id) => id !== statusPageId.trim())];
    writeStatusPageRegistry(nextStatusPageIds);
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
};

export const removeStatusPage = (statusPageId: string): void => {
  if (!statusPageId.trim()) return;

  try {
    const trimmedStatusPageId = statusPageId.trim();
    const nextStatusPageIds = readStatusPageRegistry().filter((id) => id !== trimmedStatusPageId);
    writeStatusPageRegistry(nextStatusPageIds);
    window.localStorage.removeItem(getStatusPageSettingsStorageKey(trimmedStatusPageId));
    window.localStorage.removeItem(getStatusPageMonitorStorageKey(trimmedStatusPageId));
    window.localStorage.removeItem(getPublicStatusPageCacheKey(trimmedStatusPageId));
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
};

const cleanupEmptyStatusPageDrafts = (): void => {
  const statusPageIds = readStatusPageRegistry();
  const emptyStatusPageIds = statusPageIds.filter((statusPageId) => readStoredStatusPageMonitorIds(statusPageId).length === 0);

  emptyStatusPageIds.forEach((statusPageId) => {
    removeStatusPage(statusPageId);
  });
};

export const readCachedPublicStatusPage = (statusPageId: string): PublicStatusPageResponse | null => {
  try {
    const storedValue = window.localStorage.getItem(getPublicStatusPageCacheKey(statusPageId));
    const parsedValue = readJsonValue<unknown>(storedValue);

    if (!isRecord(parsedValue)) return null;
    if (!isRecord(parsedValue.statusPage)) return null;
    if (!Array.isArray(parsedValue.statusPage.monitors)) return null;
    if (!isRecord(parsedValue.logsByMonitorId)) return null;
    if (!isRecord(parsedValue.incidentsByMonitorId)) return null;

    return parsedValue as unknown as PublicStatusPageResponse;
  } catch {
    return null;
  }
};

export const writeCachedPublicStatusPage = (
  statusPageId: string,
  response: PublicStatusPageResponse,
): void => {
  try {
    writeJsonValue(getPublicStatusPageCacheKey(statusPageId), response);
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
};

export const removeCachedPublicStatusPage = (statusPageId: string): void => {
  try {
    window.localStorage.removeItem(getPublicStatusPageCacheKey(statusPageId));
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
};

export const promoteStatusPageDraft = (
  draftStatusPageId: string,
  publishedStatusPageId?: string,
): string => {
  const sourceStatusPageId = draftStatusPageId.trim();
  const sourceMonitorIds = readStoredStatusPageMonitorIds(sourceStatusPageId);

  if (sourceMonitorIds.length === 0) {
    removeStatusPage(sourceStatusPageId);
    return '';
  }

  const nextStatusPageId = publishedStatusPageId?.trim() || createStatusPageId();

  writeStoredStatusPageSettings(nextStatusPageId, readStoredStatusPageSettings(sourceStatusPageId));
  writeStoredStatusPageMonitorIds(nextStatusPageId, sourceMonitorIds);
  registerStatusPage(nextStatusPageId);

  if (sourceStatusPageId !== nextStatusPageId) {
    removeStatusPage(sourceStatusPageId);
  }

  return nextStatusPageId;
};

export const readLocalStatusPageSummaries = (): LocalStatusPageSummary[] => {
  cleanupEmptyStatusPageDrafts();

  return readStatusPageRegistry().map((statusPageId) => ({
    id: statusPageId,
    settings: readStoredStatusPageSettings(statusPageId),
    monitorIds: readStoredStatusPageMonitorIds(statusPageId),
  }));
};
