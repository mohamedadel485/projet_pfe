import type { BackendMonitor, MonitorIpVersion } from './api';

export type DeletedMonitorResponseValidation = {
  field: 'status';
  mode: 'value' | 'type';
  expectedValue?: string;
  expectedType?: 'string' | 'boolean' | 'number';
};

export interface DeletedMonitorSnapshot extends BackendMonitor {
  ipVersion?: MonitorIpVersion;
  emailNotificationsEnabled?: boolean;
  followRedirections?: boolean;
  body?: string;
  headers?: Record<string, string>;
  responseValidation?: DeletedMonitorResponseValidation;
  upStatusCodeGroups?: Array<'2xx' | '3xx'>;
}

export interface DeletedMonitorTrashEntry {
  monitor: DeletedMonitorSnapshot;
  deletedAt: number;
  expiresAt: number;
}

export const MONITOR_TRASH_TTL_MS = 10 * 60 * 1000;
const MONITOR_TRASH_STORAGE_KEY = 'uptimewarden_deleted_monitor_trash';

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDeletedMonitorResponseValidation = (
  value: unknown,
): value is DeletedMonitorResponseValidation => {
  if (!isRecord(value)) return false;
  if (value.field !== 'status' || (value.mode !== 'value' && value.mode !== 'type')) {
    return false;
  }

  if (value.expectedValue !== undefined && typeof value.expectedValue !== 'string') {
    return false;
  }

  if (
    value.expectedType !== undefined &&
    value.expectedType !== 'string' &&
    value.expectedType !== 'boolean' &&
    value.expectedType !== 'number'
  ) {
    return false;
  }

  return true;
};

const isDeletedMonitorSnapshot = (value: unknown): value is DeletedMonitorSnapshot => {
  if (!isRecord(value)) return false;
  if (typeof value._id !== 'string' || typeof value.name !== 'string' || typeof value.url !== 'string') {
    return false;
  }
  if (
    value.type !== 'http' &&
    value.type !== 'https' &&
    value.type !== 'ws' &&
    value.type !== 'wss'
  ) {
    return false;
  }
  if (typeof value.interval !== 'number' || typeof value.timeout !== 'number') {
    return false;
  }
  if (
    value.httpMethod !== 'GET' &&
    value.httpMethod !== 'POST' &&
    value.httpMethod !== 'PUT' &&
    value.httpMethod !== 'DELETE' &&
    value.httpMethod !== 'HEAD' &&
    value.httpMethod !== 'PATCH' &&
    value.httpMethod !== 'OPTIONS'
  ) {
    return false;
  }
  if (
    value.status !== 'up' &&
    value.status !== 'down' &&
    value.status !== 'paused' &&
    value.status !== 'pending'
  ) {
    return false;
  }
  if (typeof value.uptime !== 'number' || typeof value.responseTime !== 'number') {
    return false;
  }
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    return false;
  }

  if (
    value.sharedWith !== undefined &&
    (!Array.isArray(value.sharedWith) ||
      value.sharedWith.some((sharedUserId) => typeof sharedUserId !== 'string'))
  ) {
    return false;
  }

  if (
    value.responseValidation !== undefined &&
    !isDeletedMonitorResponseValidation(value.responseValidation)
  ) {
    return false;
  }

  return true;
};

const sanitizeDeletedMonitorSnapshot = (
  value: DeletedMonitorSnapshot,
): DeletedMonitorSnapshot => ({
  ...value,
  sharedWith: Array.isArray(value.sharedWith)
    ? value.sharedWith.filter((sharedUserId): sharedUserId is string => typeof sharedUserId === 'string')
    : undefined,
});

const sanitizeDeletedMonitorTrashEntry = (
  value: unknown,
): DeletedMonitorTrashEntry | null => {
  if (!isRecord(value)) return null;
  if (!isDeletedMonitorSnapshot(value.monitor)) return null;
  if (typeof value.deletedAt !== 'number' || typeof value.expiresAt !== 'number') {
    return null;
  }

  return {
    monitor: sanitizeDeletedMonitorSnapshot(value.monitor),
    deletedAt: value.deletedAt,
    expiresAt: value.expiresAt,
  };
};

const pruneExpiredEntries = (
  entries: DeletedMonitorTrashEntry[],
  now = Date.now(),
): DeletedMonitorTrashEntry[] => {
  const uniqueEntries = new Map<string, DeletedMonitorTrashEntry>();

  for (const entry of entries) {
    if (entry.expiresAt <= now) continue;
    uniqueEntries.set(entry.monitor._id, entry);
  }

  return [...uniqueEntries.values()].sort((leftEntry, rightEntry) => {
    if (leftEntry.expiresAt !== rightEntry.expiresAt) {
      return rightEntry.expiresAt - leftEntry.expiresAt;
    }
    return rightEntry.deletedAt - leftEntry.deletedAt;
  });
};

export const createDeletedMonitorTrashEntry = (
  monitor: DeletedMonitorSnapshot,
  now = Date.now(),
): DeletedMonitorTrashEntry => ({
  monitor: sanitizeDeletedMonitorSnapshot(monitor),
  deletedAt: now,
  expiresAt: now + MONITOR_TRASH_TTL_MS,
});

export const readDeletedMonitorTrash = (now = Date.now()): DeletedMonitorTrashEntry[] => {
  try {
    const storedValue = window.localStorage.getItem(MONITOR_TRASH_STORAGE_KEY);
    const parsedValue = readJsonValue<unknown>(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    const entries = parsedValue
      .map((entry) => sanitizeDeletedMonitorTrashEntry(entry))
      .filter((entry): entry is DeletedMonitorTrashEntry => Boolean(entry));

    return pruneExpiredEntries(entries, now);
  } catch {
    return [];
  }
};

export const writeDeletedMonitorTrash = (
  entries: DeletedMonitorTrashEntry[],
  now = Date.now(),
): void => {
  try {
    const nextEntries = pruneExpiredEntries(entries, now);
    writeJsonValue(MONITOR_TRASH_STORAGE_KEY, nextEntries);
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
};

export const upsertDeletedMonitorTrashEntries = (
  currentEntries: DeletedMonitorTrashEntry[],
  nextEntries: DeletedMonitorTrashEntry[],
  now = Date.now(),
): DeletedMonitorTrashEntry[] => {
  const mergedEntries = new Map<string, DeletedMonitorTrashEntry>();

  for (const entry of currentEntries) {
    mergedEntries.set(entry.monitor._id, entry);
  }

  for (const entry of nextEntries) {
    mergedEntries.set(entry.monitor._id, entry);
  }

  return pruneExpiredEntries([...mergedEntries.values()], now);
};

export const removeDeletedMonitorTrashEntry = (
  currentEntries: DeletedMonitorTrashEntry[],
  monitorId: string,
  now = Date.now(),
): DeletedMonitorTrashEntry[] =>
  pruneExpiredEntries(
    currentEntries.filter((entry) => entry.monitor._id !== monitorId),
    now,
  );
