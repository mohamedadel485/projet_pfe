import { ArrowDownRight, CheckCircle2, Clock3, LockKeyhole } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  fetchPublicStatusPage,
  isApiError,
  saveStatusPage,
  unlockPublicStatusPage,
  type BackendIncident,
  type BackendMonitor,
  type BackendMonitorLog,
  type PublicStatusPageResponse,
} from '../../lib/api';
import { ensureChartsRegistered } from '../../lib/charts';
import {
  readCachedPublicStatusPage,
  readStoredStatusPageMonitorIds,
  readStoredStatusPageSettings,
  readLocalStatusPageSummaries,
  writeCachedPublicStatusPage,
} from './statusPageStorage';
import './status-page-public-page.css';

interface StatusPagePublicPageProps {
  statusPageId: string;
  authToken?: string | null;
}

type EventKind = 'running' | 'degraded';
type PublicHealthLabel = 'operational' | 'degraded' | 'paused' | 'pending';

interface StatusEvent {
  id: string;
  kind: EventKind;
  title: string;
  details: string;
  at: string;
}

interface PublicMonitorEntry {
  monitor: BackendMonitor;
  logs: BackendMonitorLog[];
  incidents: BackendIncident[];
  uptimeBars: Array<'up' | 'down'>;
  uptimePercent: number;
  lastChecked: string | null;
  healthLabel: PublicHealthLabel;
  responseTrendPoints: ResponseChartPoint[];
  responseTrendLabel: string;
  responseTrendLatestMs: number | null;
}

interface ResponseChartPoint {
  x: number;
  y: number;
  responseTime: number;
  checkedAt: string | null;
}

const parseDateMs = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getLocalDayKey = (value?: string | Date | null): string | null => {
  const timestamp = value instanceof Date ? value.getTime() : parseDateMs(value);
  if (timestamp === 0) return null;

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getLocalDayStartMs = (value?: string | Date | null): number => {
  const timestamp = value instanceof Date ? value.getTime() : parseDateMs(value);
  if (timestamp === 0) return 0;

  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const formatChartTooltipDateTime = (value?: string | null): string => {
  const timestamp = parseDateMs(value);
  if (timestamp === 0) return '-';

  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'shortOffset',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';

  const month = getPart('month');
  const day = getPart('day');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const dayPeriod = getPart('dayPeriod');
  const timeZoneName = getPart('timeZoneName');

  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMinutesRemainder = Math.abs(offsetMinutes) % 60;
  const fallbackTimeZone =
    offsetMinutesRemainder === 0
      ? `GMT${offsetSign}${offsetHours}`
      : `GMT${offsetSign}${offsetHours}:${String(offsetMinutesRemainder).padStart(2, '0')}`;

  return `${month} ${day}, '${year}, ${hour}:${minute}${dayPeriod} ${timeZoneName || fallbackTimeZone}`;
};

const formatDateTime = (value?: string | null): string => {
  const timestamp = parseDateMs(value);
  if (timestamp === 0) return '-';

  return new Date(timestamp)
    .toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\s(AM|PM)$/i, '$1');
};

const formatSparklineTooltipDate = (value?: string | null): string => {
  const timestamp = parseDateMs(value);
  if (timestamp === 0) return '-';

  return new Date(timestamp)
    .toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\s(AM|PM)$/i, '$1');
};

const formatShortDate = (value?: string | null): string => {
  const timestamp = parseDateMs(value);
  if (timestamp === 0) return '-';

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const buildResponseChartWindowLabel = (logsNewestFirst: BackendMonitorLog[]): string => {
  const validLogsOldestFirst = [...logsNewestFirst]
    .filter(
      (log) =>
        Number.isFinite(log.responseTime) &&
        parseDateMs(log.checkedAt) > 0,
    )
    .sort((a, b) => parseDateMs(a.checkedAt) - parseDateMs(b.checkedAt));

  if (validLogsOldestFirst.length === 0) {
    return 'Last 90 days';
  }

  const firstLogDayMs = getLocalDayStartMs(validLogsOldestFirst[0].checkedAt);
  const lastLogDayMs = getLocalDayStartMs(validLogsOldestFirst[validLogsOldestFirst.length - 1].checkedAt);
  const availableDayCount = Math.max(1, Math.floor((lastLogDayMs - firstLogDayMs) / DAY_MS) + 1);

  if (availableDayCount >= RESPONSE_CHART_MAX_DAY_COUNT) {
    return 'Last 90 days';
  }

  return `Since ${formatShortDate(validLogsOldestFirst[0].checkedAt)}`;
};

const formatDurationMs = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '0m';

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
};

interface DraftPublicStatusPageData {
  monitors: BackendMonitor[];
  logsByMonitorId: Record<string, BackendMonitorLog[]>;
  incidentsByMonitorId: Record<string, BackendIncident[]>;
}

const mergePublicStatusPageResponses = (responses: PublicStatusPageResponse[]): DraftPublicStatusPageData => {
  const monitors: BackendMonitor[] = [];
  const logsByMonitorId: Record<string, BackendMonitorLog[]> = {};
  const incidentsByMonitorId: Record<string, BackendIncident[]> = {};
  const seenMonitorIds = new Set<string>();

  for (const response of responses) {
    const responseMonitors = response.statusPage?.monitors ?? [];

    for (const monitor of responseMonitors) {
      if (seenMonitorIds.has(monitor._id)) {
        continue;
      }

      seenMonitorIds.add(monitor._id);
      monitors.push(monitor);
      logsByMonitorId[monitor._id] = response.logsByMonitorId?.[monitor._id] ?? [];
      incidentsByMonitorId[monitor._id] = response.incidentsByMonitorId?.[monitor._id] ?? [];
    }
  }

  return {
    monitors,
    logsByMonitorId,
    incidentsByMonitorId,
  };
};

const buildUptimeBars = (logsNewestFirst: BackendMonitorLog[], monitorStatus: BackendMonitor['status']): Array<'up' | 'down'> => {
  const bucketCount = 90;
  const defaultState: 'up' | 'down' = monitorStatus === 'down' ? 'down' : 'up';

  if (logsNewestFirst.length === 0) {
    return Array.from({ length: bucketCount }, () => defaultState);
  }

  const logsByDay = new Map<string, BackendMonitorLog[]>();

  for (const log of logsNewestFirst) {
    const dayKey = getLocalDayKey(log.checkedAt);
    if (!dayKey) continue;

    const bucket = logsByDay.get(dayKey);
    if (bucket) {
      bucket.push(log);
    } else {
      logsByDay.set(dayKey, [log]);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bars: Array<'up' | 'down'> = [];
  let lastKnownState: 'up' | 'down' = defaultState;

  for (let offset = bucketCount - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);

    const dayKey = getLocalDayKey(day);
    const dayLogs = dayKey ? logsByDay.get(dayKey) ?? [] : [];

    if (dayLogs.length > 0) {
      lastKnownState = dayLogs.some((log) => log.status === 'down') ? 'down' : 'up';
    }

    bars.push(lastKnownState);
  }

  return bars;
};

const calculateUptimeForHours = (logsNewestFirst: BackendMonitorLog[], hours: number): number | null => {
  const cutoff = Date.now() - hours * 3600_000;
  const windowLogs = logsNewestFirst.filter((log) => parseDateMs(log.checkedAt) >= cutoff);
  if (windowLogs.length === 0) return null;

  const upCount = windowLogs.filter((log) => log.status === 'up').length;
  return (upCount / windowLogs.length) * 100;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RESPONSE_CHART_MAX_DAY_COUNT = 90;
const RESPONSE_CHART_LEFT_PADDING = 20;
const RESPONSE_CHART_RIGHT_PADDING = 20;

const RESPONSE_CHART_VIEWBOX_WIDTH = 800;
const RESPONSE_CHART_Y_MIN = 55;
const RESPONSE_CHART_Y_MAX = 115;
const RESPONSE_CHART_Y_RANGE = RESPONSE_CHART_Y_MAX - RESPONSE_CHART_Y_MIN;

const buildResponseChartPoints = (
  logsNewestFirst: BackendMonitorLog[],
  fallbackMs: number,
  fallbackCheckedAt: string | null,
): ResponseChartPoint[] => {
  const validLogsOldestFirst = [...logsNewestFirst]
    .filter(
      (log) =>
        Number.isFinite(log.responseTime) &&
        parseDateMs(log.checkedAt) > 0,
    )
    .sort((a, b) => parseDateMs(a.checkedAt) - parseDateMs(b.checkedAt));

  if (validLogsOldestFirst.length === 0) {
    const baseline = Math.max(1, fallbackMs);
    const y = RESPONSE_CHART_Y_MAX - 0.5 * RESPONSE_CHART_Y_RANGE;

    return [
      {
        x: RESPONSE_CHART_LEFT_PADDING,
        y,
        responseTime: baseline,
        checkedAt: fallbackCheckedAt,
      },
      {
        x: RESPONSE_CHART_VIEWBOX_WIDTH - RESPONSE_CHART_RIGHT_PADDING,
        y,
        responseTime: baseline,
        checkedAt: fallbackCheckedAt,
      },
    ];
  }

  const firstLogDayMs = getLocalDayStartMs(validLogsOldestFirst[0].checkedAt);
  const lastLogDayMs = getLocalDayStartMs(validLogsOldestFirst[validLogsOldestFirst.length - 1].checkedAt);
  const availableDayCount = Math.max(1, Math.floor((lastLogDayMs - firstLogDayMs) / DAY_MS) + 1);
  const windowStartMs =
    availableDayCount > RESPONSE_CHART_MAX_DAY_COUNT
      ? lastLogDayMs - (RESPONSE_CHART_MAX_DAY_COUNT - 1) * DAY_MS
      : firstLogDayMs;

  const windowLogs = validLogsOldestFirst.filter((log) => {
    const dayStartMs = getLocalDayStartMs(log.checkedAt);
    return dayStartMs >= windowStartMs && dayStartMs <= lastLogDayMs;
  });

  if (windowLogs.length === 0) {
    const baseline = Math.max(1, fallbackMs);
    const y = RESPONSE_CHART_Y_MAX - 0.5 * RESPONSE_CHART_Y_RANGE;

    return [
      {
        x: RESPONSE_CHART_LEFT_PADDING,
        y,
        responseTime: baseline,
        checkedAt: fallbackCheckedAt,
      },
      {
        x: RESPONSE_CHART_VIEWBOX_WIDTH - RESPONSE_CHART_RIGHT_PADDING,
        y,
        responseTime: baseline,
        checkedAt: fallbackCheckedAt,
      },
    ];
  }

  const pointTargetCount = Math.min(24, windowLogs.length);
  const chartSamples =
    windowLogs.length <= pointTargetCount
      ? windowLogs.map((log) => ({
          responseTime: log.responseTime,
          checkedAt: log.checkedAt ?? null,
        }))
      : Array.from({ length: pointTargetCount }, (_, bucketIndex) => {
          const sliceStart = Math.floor((bucketIndex * windowLogs.length) / pointTargetCount);
          const sliceEnd =
            bucketIndex === pointTargetCount - 1
              ? windowLogs.length
              : Math.max(sliceStart + 1, Math.floor(((bucketIndex + 1) * windowLogs.length) / pointTargetCount));
          const slice = windowLogs.slice(sliceStart, sliceEnd);
          const midpointEntry = slice[Math.floor(slice.length / 2)] ?? slice[0];
          const averageResponseTime = slice.reduce((sum, entry) => sum + entry.responseTime, 0) / slice.length;

          return {
            responseTime: averageResponseTime,
            checkedAt: midpointEntry.checkedAt ?? null,
          };
        });

  const averages = chartSamples.map((bucket) => bucket.responseTime);
  const minValue = Math.min(...averages);
  const maxValue = Math.max(...averages);
  const span = Math.max(1, maxValue - minValue);
  const padding = Math.max(1, span * 0.08);
  const scaleMin = Math.max(0, minValue - padding);
  const scaleMax = maxValue + padding;
  const scaleSpan = Math.max(1, scaleMax - scaleMin);

  if (chartSamples.length === 1) {
    const only = chartSamples[0];
    const clampedValue = Math.min(scaleMax, Math.max(scaleMin, only.responseTime));
    const normalized = (clampedValue - scaleMin) / scaleSpan;
    const y = RESPONSE_CHART_Y_MAX - normalized * RESPONSE_CHART_Y_RANGE;

    return [
      {
        x: RESPONSE_CHART_LEFT_PADDING,
        y,
        responseTime: only.responseTime,
        checkedAt: only.checkedAt,
      },
      {
        x: RESPONSE_CHART_VIEWBOX_WIDTH - RESPONSE_CHART_RIGHT_PADDING,
        y,
        responseTime: only.responseTime,
        checkedAt: only.checkedAt,
      },
    ];
  }

  return chartSamples.map((bucket, index) => {
    const x =
      chartSamples.length <= 1
        ? RESPONSE_CHART_VIEWBOX_WIDTH / 2
        : RESPONSE_CHART_LEFT_PADDING +
          (index / (chartSamples.length - 1)) *
            (RESPONSE_CHART_VIEWBOX_WIDTH - RESPONSE_CHART_LEFT_PADDING - RESPONSE_CHART_RIGHT_PADDING);

    const clampedValue = Math.min(scaleMax, Math.max(scaleMin, bucket.responseTime));
    const normalized = (clampedValue - scaleMin) / scaleSpan;
    const y = RESPONSE_CHART_Y_MAX - normalized * RESPONSE_CHART_Y_RANGE;

    return {
      x,
      y,
      responseTime: bucket.responseTime,
      checkedAt: bucket.checkedAt,
    };
  });
};

ensureChartsRegistered();

const getNiceChartBounds = (values: number[]): { min: number; max: number } => {
  const cleaned = values.filter((value) => Number.isFinite(value));
  if (cleaned.length === 0) return { min: 0, max: 1 };
  const minValue = Math.min(...cleaned);
  const maxValue = Math.max(...cleaned);
  const span = Math.max(1, maxValue - minValue);
  const pad = Math.max(1, span * 0.12);
  return {
    min: Math.max(0, minValue - pad),
    max: maxValue + pad,
  };
};

const getMonitorHealthLabel = (monitorStatus: BackendMonitor['status']): PublicHealthLabel => {
  if (monitorStatus === 'down') return 'degraded';
  if (monitorStatus === 'paused') return 'paused';
  if (monitorStatus === 'pending') return 'pending';
  return 'operational';
};

const formatHealthLabel = (healthLabel: PublicHealthLabel) => {
  if (healthLabel === 'operational') return 'Operational';
  if (healthLabel === 'degraded') return 'Degraded';
  if (healthLabel === 'paused') return 'Paused';
  return 'Pending';
};

const buildRecentEvents = (incidents: BackendIncident[]): StatusEvent[] => {
  const sortedIncidents = [...incidents].sort(
    (a, b) => parseDateMs(b.startedAt ?? b.checkedAt) - parseDateMs(a.startedAt ?? a.checkedAt),
  );

  return sortedIncidents.slice(0, 6).map((incident) => {
    const isResolved = incident.status === 'up';
    const monitorName = incident.monitor?.name?.trim() || 'Monitor';
    const title = isResolved ? `${monitorName} is running again` : `${monitorName} is degraded`;
    const details = isResolved
      ? `Recovered after ${formatDurationMs(incident.durationMs ?? incident.responseTime)}.`
      : incident.errorMessage?.trim() || (incident.statusCode ? `HTTP ${incident.statusCode}` : 'Connection issue detected.');
    const at = formatDateTime(isResolved ? incident.resolvedAt ?? incident.checkedAt : incident.startedAt ?? incident.checkedAt);

    return {
      id: `${incident._id}-${incident.status}`,
      kind: isResolved ? 'running' : 'degraded',
      title,
      details,
      at,
    };
  });
};

const getOverallHealthLabel = (monitorEntries: PublicMonitorEntry[]): PublicHealthLabel => {
  if (monitorEntries.length === 0) return 'pending';
  if (monitorEntries.some((entry) => entry.healthLabel === 'degraded')) return 'degraded';
  if (monitorEntries.some((entry) => entry.healthLabel === 'pending')) return 'pending';
  if (monitorEntries.every((entry) => entry.healthLabel === 'paused')) return 'paused';
  return 'operational';
};

const getOverallSummaryTitle = (monitorEntries: PublicMonitorEntry[], overallHealthLabel: PublicHealthLabel) => {
  if (monitorEntries.length <= 1) {
    const singleMonitor = monitorEntries[0];
    if (!singleMonitor) return 'Status unavailable';
    return `${singleMonitor.monitor.name} is ${formatHealthLabel(overallHealthLabel)}`;
  }

  if (overallHealthLabel === 'operational') return 'All systems Operational';
  if (overallHealthLabel === 'degraded') {
    const degradedCount = monitorEntries.filter((entry) => entry.healthLabel === 'degraded').length;
    return `${degradedCount} system${degradedCount > 1 ? 's' : ''} Degraded`;
  }
  if (overallHealthLabel === 'paused') return 'All systems Paused';
  return 'Some systems Pending';
};

function StatusPagePublicPage({
  statusPageId,
  authToken,
}: StatusPagePublicPageProps) {
  const storedStatusPageSettings = useMemo(() => readStoredStatusPageSettings(statusPageId), [statusPageId]);
  const isLocalStatusPage = useMemo(() => {
    if (statusPageId === 'new') return true;
    return readLocalStatusPageSummaries().some((summary) => summary.id === statusPageId);
  }, [statusPageId]);
  const storedStatusPageMonitorIds = useMemo(() => readStoredStatusPageMonitorIds(statusPageId), [statusPageId]);
  const configuredPageName = storedStatusPageSettings.pageName?.trim() || 'Status page';
  const savedPassword = typeof storedStatusPageSettings.password === 'string' ? storedStatusPageSettings.password : '';
  const configuredPasswordEnabled =
    typeof storedStatusPageSettings.passwordEnabled === 'boolean'
      ? storedStatusPageSettings.passwordEnabled
      : savedPassword.trim().length > 0;
  const configuredPassword = configuredPasswordEnabled ? savedPassword : '';

  const [pageName, setPageName] = useState(configuredPageName);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlockedPassword, setUnlockedPassword] = useState<string | null>(configuredPassword.trim() ? null : configuredPassword);
  const [backendPasswordProtected, setBackendPasswordProtected] = useState(false);
  const [backendPasswordUnlocked, setBackendPasswordUnlocked] = useState(false);
  const [publishedMonitors, setPublishedMonitors] = useState<BackendMonitor[]>([]);
  const [monitorLogsById, setMonitorLogsById] = useState<Record<string, BackendMonitorLog[]>>({});
  const [monitorIncidentsById, setMonitorIncidentsById] = useState<Record<string, BackendIncident[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const syncPublicStatusPageState = (response: PublicStatusPageResponse): void => {
    const nextPublishedMonitors = response.statusPage?.monitors ?? [];
    const nextPageName =
      storedStatusPageSettings.pageName?.trim() ||
      response.statusPage?.pageName?.trim() ||
      (nextPublishedMonitors.length === 1 ? nextPublishedMonitors[0].name : 'Service status');

    const nextLogsByMonitorId = Object.fromEntries(
      nextPublishedMonitors.map((monitor) => {
        const logs = [...(response.logsByMonitorId?.[monitor._id] ?? [])].sort(
          (a, b) => parseDateMs(b.checkedAt) - parseDateMs(a.checkedAt),
        );
        return [monitor._id, logs];
      }),
    );

    const nextIncidentsByMonitorId = Object.fromEntries(
      nextPublishedMonitors.map((monitor) => [monitor._id, response.incidentsByMonitorId?.[monitor._id] ?? []]),
    );

    setPageName(nextPageName);
    setPublishedMonitors(nextPublishedMonitors);
    setMonitorLogsById(nextLogsByMonitorId);
    setMonitorIncidentsById(nextIncidentsByMonitorId);
    setBackendPasswordProtected(Boolean(response.statusPage?.passwordEnabled));
    if (!response.statusPage?.passwordEnabled) {
      setBackendPasswordUnlocked(false);
    }

    writeCachedPublicStatusPage(statusPageId, {
      statusPage: {
        ...response.statusPage,
        id: response.statusPage?.id ?? statusPageId,
        pageName: nextPageName,
        passwordEnabled: response.statusPage?.passwordEnabled ?? configuredPasswordEnabled,
        monitors: nextPublishedMonitors,
      },
      logsByMonitorId: nextLogsByMonitorId,
      incidentsByMonitorId: nextIncidentsByMonitorId,
    });
  };

  useEffect(() => {
    setPageName(configuredPageName);
    setPasswordInput('');
    setPasswordError(null);
    setUnlockedPassword(configuredPassword.trim() ? null : configuredPassword);
    setBackendPasswordProtected(false);
    setBackendPasswordUnlocked(false);
  }, [configuredPageName, configuredPassword, statusPageId]);

  useEffect(() => {
    let cancelled = false;

    const loadPublicStatusData = async () => {
      const cachedPublicStatusPage = readCachedPublicStatusPage(statusPageId);

      if (configuredPassword.trim() && unlockedPassword !== configuredPassword) {
        setIsLoading(false);
        setLoadError(null);
        setPublishedMonitors([]);
        setMonitorLogsById({});
        setMonitorIncidentsById({});
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const loadLocalDraftStatusPageData = async (): Promise<boolean> => {
        if (storedStatusPageMonitorIds.length === 0) {
          if (cachedPublicStatusPage) {
            syncPublicStatusPageState(cachedPublicStatusPage);
            return true;
          }

          setPageName(storedStatusPageSettings.pageName?.trim() || 'Status page');
          setPublishedMonitors([]);
          setMonitorLogsById({});
          setMonitorIncidentsById({});
          return true;
        }

        const publicStatusPageResponses = await Promise.allSettled(
          storedStatusPageMonitorIds.map((monitorId) => fetchPublicStatusPage(monitorId)),
        );
        if (cancelled) return true;

        const successfulResponses = publicStatusPageResponses
          .filter((result): result is PromiseFulfilledResult<PublicStatusPageResponse> => result.status === 'fulfilled')
          .map((result) => result.value);

        if (successfulResponses.length === 0) {
          if (cachedPublicStatusPage) {
            syncPublicStatusPageState(cachedPublicStatusPage);
            return true;
          }

          if (isLocalStatusPage) {
            setPageName(storedStatusPageSettings.pageName?.trim() || 'Status page');
            setPublishedMonitors([]);
            setMonitorLogsById({});
            setMonitorIncidentsById({});
            return true;
          }

          return false;
        }

        const mergedDraftData = mergePublicStatusPageResponses(successfulResponses);
        const nextPageName =
          storedStatusPageSettings.pageName?.trim() ||
          (mergedDraftData.monitors.length === 1 ? mergedDraftData.monitors[0].name : 'Service status');

        syncPublicStatusPageState({
          statusPage: {
            id: statusPageId,
            pageName: nextPageName,
            passwordEnabled: configuredPasswordEnabled,
            monitors: mergedDraftData.monitors,
          },
          logsByMonitorId: mergedDraftData.logsByMonitorId,
          incidentsByMonitorId: mergedDraftData.incidentsByMonitorId,
        });

        if (statusPageId !== 'new') {
          void saveStatusPage(
            statusPageId,
            {
              pageName: nextPageName,
              monitorIds: mergedDraftData.monitors.map((monitor) => monitor._id),
              passwordEnabled: configuredPasswordEnabled,
              password: configuredPasswordEnabled ? savedPassword.trim() : '',
              customDomain: storedStatusPageSettings.customDomain?.trim(),
              logoName: storedStatusPageSettings.logoName?.trim(),
              density: storedStatusPageSettings.density,
              alignment: storedStatusPageSettings.alignment,
            },
            authToken ?? undefined,
          ).catch(() => undefined);
        }

        return true;
      };

      try {
        const publicStatusPageResponse = await fetchPublicStatusPage(statusPageId);
        if (cancelled) return;
        syncPublicStatusPageState(publicStatusPageResponse);
      } catch (error) {
        if (cancelled) return;

        if (isApiError(error) && error.status === 404 && isLocalStatusPage) {
          const handledLocally = await loadLocalDraftStatusPageData();
          if (handledLocally) {
            return;
          }
        }

        if (cachedPublicStatusPage) {
          syncPublicStatusPageState(cachedPublicStatusPage);
          return;
        }

        if (isLocalStatusPage) {
          setPageName(storedStatusPageSettings.pageName?.trim() || 'Status page');
          setPublishedMonitors([]);
          setMonitorLogsById({});
          setMonitorIncidentsById({});
          return;
        }

        if (isApiError(error)) {
          setLoadError(error.message || 'Unable to load status page data.');
        } else if (error instanceof Error && error.message.trim() !== '') {
          setLoadError(error.message);
        } else {
          setLoadError('Unable to load status page data.');
        }

        setPublishedMonitors([]);
        setMonitorLogsById({});
        setMonitorIncidentsById({});
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPublicStatusData();

    return () => {
      cancelled = true;
    };
  }, [
    configuredPassword,
    configuredPasswordEnabled,
    isLocalStatusPage,
    statusPageId,
    storedStatusPageMonitorIds,
    storedStatusPageSettings.pageName,
    unlockedPassword,
  ]);

  const hasLocalPassword = configuredPassword.trim() !== '';
  const isPasswordRequired = hasLocalPassword || backendPasswordProtected;
  const isPasswordUnlocked =
    !isPasswordRequired || (hasLocalPassword && unlockedPassword === configuredPassword) || backendPasswordUnlocked;
  const isLocked = isPasswordRequired && !isPasswordUnlocked;

  const publishedMonitorEntries = useMemo(
    () =>
      publishedMonitors.map((monitor) => {
        const logs = monitorLogsById[monitor._id] ?? [];
        const incidents = monitorIncidentsById[monitor._id] ?? [];
        const uptimeBars = buildUptimeBars(logs, monitor.status);
        const upBars = uptimeBars.filter((bar) => bar === 'up').length;
        const uptimePercent =
          uptimeBars.length > 0 ? (upBars / uptimeBars.length) * 100 : Number.isFinite(monitor.uptime) ? monitor.uptime : 0;
        const responseTrendPoints = buildResponseChartPoints(logs, monitor.responseTime ?? 120, monitor.lastChecked ?? null);
        const responseTrendLatestMs = responseTrendPoints[responseTrendPoints.length - 1]?.responseTime ?? null;

        return {
          monitor,
          logs,
          incidents,
          uptimeBars,
          uptimePercent,
          lastChecked: logs[0]?.checkedAt ?? monitor.lastChecked ?? null,
          healthLabel: getMonitorHealthLabel(monitor.status),
          responseTrendPoints,
          responseTrendLabel: buildResponseChartWindowLabel(logs),
          responseTrendLatestMs,
        };
      }),
    [monitorIncidentsById, monitorLogsById, publishedMonitors],
  );

  const primaryMonitorEntry = publishedMonitorEntries[0] ?? null;
  const primaryMonitor = primaryMonitorEntry?.monitor ?? null;
  const overallHealthLabel = getOverallHealthLabel(publishedMonitorEntries);
  const overallSummaryTitle = getOverallSummaryTitle(publishedMonitorEntries, overallHealthLabel);

  const recentEvents = useMemo(
    () => buildRecentEvents(publishedMonitorEntries.flatMap((entry) => entry.incidents)),
    [publishedMonitorEntries],
  );

  const effectiveLastChecked = useMemo(() => {
    const timestamps = publishedMonitorEntries
      .map((entry) => parseDateMs(entry.lastChecked))
      .filter((timestamp) => timestamp > 0);

    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }, [publishedMonitorEntries]);

  const nextUpdateMinutes = useMemo(() => {
    if (publishedMonitorEntries.length === 0) return null;

    return publishedMonitorEntries.reduce((smallestInterval, entry) => {
      if (!Number.isFinite(entry.monitor.interval)) return smallestInterval;
      return Math.min(smallestInterval, entry.monitor.interval);
    }, publishedMonitorEntries[0].monitor.interval);
  }, [publishedMonitorEntries]);

  const primaryUptime24h = primaryMonitorEntry ? calculateUptimeForHours(primaryMonitorEntry.logs, 24) : null;
  const primaryUptime7d = primaryMonitorEntry ? calculateUptimeForHours(primaryMonitorEntry.logs, 24 * 7) : null;
  const primaryUptime30d = primaryMonitorEntry ? calculateUptimeForHours(primaryMonitorEntry.logs, 24 * 30) : null;
  const primaryUptime90d = primaryMonitorEntry ? calculateUptimeForHours(primaryMonitorEntry.logs, 24 * 90) : null;

  const responseChartPoints = useMemo(
    () =>
      buildResponseChartPoints(
        primaryMonitorEntry?.logs ?? [],
        primaryMonitor?.responseTime ?? 120,
        primaryMonitorEntry?.lastChecked ?? null,
      ),
    [primaryMonitor?.responseTime, primaryMonitorEntry?.lastChecked, primaryMonitorEntry?.logs],
  );

  const mainResponseChartData = useMemo(() => {
    const values = responseChartPoints.map((pt) => Math.max(0, pt.responseTime));
    const bounds = getNiceChartBounds(values);
    return {
      labels: responseChartPoints.map((pt) => pt.checkedAt ?? ''),
      datasets: [
        {
          label: 'Response time',
          data: values,
          tension: 0.35,
          borderWidth: 2.4,
          pointRadius: (ctx: any) => {
            const idx = ctx.dataIndex ?? 0;
            const last = (ctx.dataset?.data?.length ?? 1) - 1;
            return idx === last ? 4.5 : 0;
          },
          pointHoverRadius: 5,
          pointBackgroundColor: '#4f8fff',
          pointBorderColor: '#f7fbff',
          pointBorderWidth: 3.5,
          borderColor: '#4f8fff',
          fill: true,
          backgroundColor: (context: any) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(79,143,255,0.12)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(79,143,255,0.18)');
            gradient.addColorStop(1, 'rgba(79,143,255,0)');
            return gradient;
          },
        },
      ],
      __bounds: bounds,
    };
  }, [responseChartPoints]);

  const mainResponseChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: 0 },
      elements: {
        line: { borderCapStyle: 'round', borderJoinStyle: 'round' },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: (context: any) => {
            const { chart, tooltip } = context;
            const parent = chart?.canvas?.parentNode as HTMLElement | null;
            if (!parent) return;

            let tooltipEl = parent.querySelector('.status-public-chart-tooltip') as HTMLDivElement | null;
            if (!tooltipEl) {
              tooltipEl = document.createElement('div');
              tooltipEl.className = 'status-public-chart-tooltip align-center';
              tooltipEl.style.position = 'absolute';
              tooltipEl.style.pointerEvents = 'none';
              tooltipEl.style.opacity = '0';
              parent.appendChild(tooltipEl);
            }

            if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
              tooltipEl.style.opacity = '0';
              return;
            }

            const item = tooltip.dataPoints[0];
            const rawLabel = item?.label as string | undefined;
            const value = item?.parsed?.y as number | undefined;

            tooltipEl.innerHTML = `
              <span>${rawLabel ? formatChartTooltipDateTime(rawLabel) : '-'}</span>
              <strong>${value === undefined ? '-' : `${Math.round(value)} ms`}</strong>
            `;

            const x = tooltip.caretX ?? 0;
            const align =
              x > chart.width - 120 ? 'align-right' : x < 120 ? 'align-left' : 'align-center';
            tooltipEl.className = `status-public-chart-tooltip ${align}`;

            tooltipEl.style.left = `${(x / chart.width) * 100}%`;
            tooltipEl.style.top = `${(tooltip.caretY / chart.height) * 100}%`;
            tooltipEl.style.opacity = '1';
          },
          callbacks: {
            title: (items: any[]) => {
              const raw = items?.[0]?.label as string | undefined;
              return raw ? formatChartTooltipDateTime(raw) : '-';
            },
            label: (item: any) => {
              const value = item.parsed?.y as number | undefined;
              return value === undefined ? '-' : `${Math.round(value)} ms`;
            },
          },
        },
      },
      interaction: { mode: 'index' as const, intersect: false },
      scales: {
        x: { display: false },
        y: {
          display: false,
          min: (mainResponseChartData as any).__bounds?.min,
          max: (mainResponseChartData as any).__bounds?.max,
        },
      },
    };
  }, [mainResponseChartData]);

  const buildSparklineData = (points: ResponseChartPoint[], healthLabel: PublicHealthLabel) => {
    const values = points.map((pt) => Math.max(0, pt.responseTime));
    const bounds = getNiceChartBounds(values);
    const stroke = healthLabel === 'degraded' ? '#ea6870' : healthLabel === 'paused' ? '#8ea1bf' : '#4f8fff';
    return {
      labels: points.map((pt) => pt.checkedAt ?? ''),
      datasets: [
        {
          label: 'Response trend',
          data: values,
          tension: 0.35,
          borderWidth: 2.05,
          pointRadius: 0,
          pointHoverRadius: 3,
          pointHitRadius: 16,
          borderColor: stroke,
          fill: true,
          backgroundColor: (context: any) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(79,143,255,0.10)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            const rgba =
              stroke === '#ea6870'
                ? 'rgba(234,104,112,'
                : stroke === '#8ea1bf'
                  ? 'rgba(142,161,191,'
                  : 'rgba(79,143,255,';
            gradient.addColorStop(0, `${rgba}0.16)`);
            gradient.addColorStop(1, `${rgba}0)`);
            return gradient;
          },
        },
      ],
      __bounds: bounds,
    };
  };

  const sparklineOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: 0 },
      elements: {
        line: { borderCapStyle: 'round', borderJoinStyle: 'round' },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: (context: any) => {
            const { chart, tooltip } = context;
            const canvasParent = chart?.canvas?.parentNode as HTMLElement | null;
            if (!canvasParent) return;

            const host = canvasParent.closest('.status-public-service-trend') as HTMLElement | null;
            if (!host) return;

            let tooltipEl = host.querySelector('.status-public-service-chart-tooltip') as HTMLDivElement | null;
            if (!tooltipEl) {
              tooltipEl = document.createElement('div');
              tooltipEl.className = 'status-public-service-chart-tooltip align-center';
              tooltipEl.style.opacity = '0';
              host.appendChild(tooltipEl);
            }

            if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
              tooltipEl.style.opacity = '0';
              return;
            }

            const item = tooltip.dataPoints[0];
            const rawLabel = item?.label as string | undefined;
            const value = item?.parsed?.y as number | undefined;

            tooltipEl.innerHTML = `
              <span>${rawLabel ? formatSparklineTooltipDate(rawLabel) : '-'}</span>
              <strong>${value === undefined ? '-' : `${Math.round(value)} ms`}</strong>
            `;

            const x = tooltip.caretX ?? 0;
            const align = x > chart.width - 110 ? 'align-right' : x < 110 ? 'align-left' : 'align-center';
            tooltipEl.className = `status-public-service-chart-tooltip ${align}`;

            const canvasRect = chart.canvas.getBoundingClientRect();
            const hostRect = host.getBoundingClientRect();
            const leftPx = canvasRect.left - hostRect.left + x;
            const topPx = canvasRect.top - hostRect.top + (tooltip.caretY ?? 0);

            tooltipEl.style.left = `${leftPx}px`;
            tooltipEl.style.top = `${topPx}px`;
            tooltipEl.style.opacity = '1';
          },
        },
      },
      interaction: { mode: 'index' as const, intersect: false },
      scales: {
        x: { display: false },
        y: {
          display: false,
          // bounds provided per-chart via dataset-attached metadata
        },
      },
    };
  }, []);

  const responseChartWindowLabel = useMemo(() => {
    return buildResponseChartWindowLabel(primaryMonitorEntry?.logs ?? []);
  }, [primaryMonitorEntry?.logs]);

  const handleUnlockSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (hasLocalPassword) {
      if (passwordInput === configuredPassword) {
        setUnlockedPassword(configuredPassword);
        setPasswordError(null);
        return;
      }

      setPasswordError('Incorrect password. Please try again.');
      return;
    }

    if (!backendPasswordProtected) {
      setPasswordError(null);
      setUnlockedPassword(configuredPassword);
      return;
    }

    try {
      const unlockedResponse = await unlockPublicStatusPage(statusPageId, passwordInput);
      syncPublicStatusPageState(unlockedResponse);
      setBackendPasswordUnlocked(true);
      setPasswordError(null);
    } catch (error) {
      if (isApiError(error)) {
        setPasswordError(error.message || 'Incorrect password. Please try again.');
        return;
      }

      if (error instanceof Error && error.message.trim() !== '') {
        setPasswordError(error.message);
        return;
      }

      setPasswordError('Incorrect password. Please try again.');
    }
  };

  return (
    <section className="status-page-public-page">
      {isLocked ? (
        <>
          <section className="status-public-hero">
            <div className="status-public-hero-inner">
              <div className="status-public-hero-side">
                <p className="status-public-page-name">{pageName}</p>
              </div>
              <div className="status-public-hero-side status-public-hero-right">
                <h1>Service status</h1>
                <p>Password protected page</p>
              </div>
            </div>
          </section>

          <section className="status-public-card status-public-lock-card">
            <div className="status-public-lock-intro">
              <span className="status-public-lock-icon" aria-hidden="true">
                <LockKeyhole size={22} />
              </span>
              <div>
                <h2>Password protected</h2>
                <p>Enter the password configured in global settings to view this status page.</p>
              </div>
            </div>

            <form className="status-public-lock-form" onSubmit={handleUnlockSubmit}>
              <label className="status-public-lock-field">
                <span>Password</span>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(event) => {
                    setPasswordInput(event.target.value);
                    if (passwordError) {
                      setPasswordError(null);
                    }
                  }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </label>

              <button type="submit" className="status-public-lock-submit">
                Unlock status page
              </button>
            </form>

            {passwordError ? <p className="status-public-lock-error">{passwordError}</p> : null}
          </section>
        </>
      ) : isLoading ? (
        <section className="status-public-card">
          <p>Loading status page data...</p>
        </section>
      ) : loadError ? (
        <section className="status-public-card">
          <p>{loadError}</p>
        </section>
      ) : publishedMonitorEntries.length === 0 ? (
        <section className="status-public-card">
          <p>No monitor available to publish on this status page.</p>
        </section>
      ) : (
        <>
          <section className="status-public-hero">
            <div className="status-public-hero-inner">
              <div className="status-public-hero-side">
                <p className="status-public-page-name">{pageName}</p>
              </div>
              <div className="status-public-hero-side status-public-hero-right">
                <h1>Service status</h1>
                <p>
                  Last updated {formatDateTime(effectiveLastChecked)}
                  {nextUpdateMinutes ? ` | next update in ${nextUpdateMinutes} min` : ''}
                </p>
              </div>
            </div>
          </section>

          <section className={`status-public-card summary health-${overallHealthLabel}`}>
            <div className={`status-public-summary-icon health-${overallHealthLabel}`} aria-hidden="true">
              <span />
            </div>
            <div className="status-public-summary-copy">
              <h2>
                {overallSummaryTitle.split(' ').slice(0, -1).join(' ')}{' '}
                <span className={`health-${overallHealthLabel}`}>
                  {overallSummaryTitle.split(' ').slice(-1).join(' ')}
                </span>
              </h2>
              <p>
                {publishedMonitorEntries.length === 1
                  ? primaryMonitor?.url || 'Public monitor status'
                  : `${publishedMonitorEntries.length} services published on this status page.`}
              </p>
            </div>
          </section>

          {publishedMonitorEntries.length > 1 ? (
            <section className="status-public-card status-public-services-card">
              <h3>
                Services <span>{publishedMonitorEntries.length} monitored</span>
              </h3>
              <div className="status-public-services-list">
                {publishedMonitorEntries.map((entry) => (
                  <article className="status-public-service-row" key={entry.monitor._id}>
                    <div className="status-public-service-head">
                      <div className="status-public-service-title">
                        <strong>{entry.monitor.name}</strong>
                        <span>{entry.uptimePercent.toFixed(3)}%</span>
                      </div>
                      <div className={`status-public-service-state ${entry.healthLabel}`}>
                        <span className="status-public-service-state-dot" />
                        <span>{formatHealthLabel(entry.healthLabel)}</span>
                      </div>
                    </div>

                    <div className="status-public-service-bars">
                      {entry.uptimeBars.map((state, index) => (
                        <span key={`${entry.monitor._id}-bar-${index}`} className={`status-public-service-bar ${state}`} />
                      ))}
                    </div>

                    <div className="status-public-service-trend">
                      <div className="status-public-service-trend-head">
                        <span>Response trend</span>
                        <small>
                          {entry.responseTrendLabel}
                          {entry.responseTrendLatestMs !== null ? ` | ${Math.round(entry.responseTrendLatestMs)} ms` : ''}
                        </small>
                      </div>
                      <div className="status-public-service-trend-chart" aria-hidden="true">
                        <Line
                          data={buildSparklineData(entry.responseTrendPoints, entry.healthLabel) as any}
                          options={{
                            ...(sparklineOptions as any),
                            scales: {
                              x: { display: false },
                              y: {
                                display: false,
                                min: (buildSparklineData(entry.responseTrendPoints, entry.healthLabel) as any).__bounds?.min,
                                max: (buildSparklineData(entry.responseTrendPoints, entry.healthLabel) as any).__bounds?.max,
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {primaryMonitorEntry && publishedMonitorEntries.length === 1 ? (
            <>
              <section className="status-public-card status-public-card-uptime">
                <h3>
                  Uptime <span>{primaryMonitor.name} - Last 90 days</span>
                </h3>
                <div className="status-public-card-inner status-public-uptime-inner">
                  <p className="status-public-kpi">{primaryMonitorEntry.uptimePercent.toFixed(3)}%</p>
                  <div className="status-public-bars">
                    {primaryMonitorEntry.uptimeBars.map((state, index) => (
                      <span key={`uptime-${index}`} className={`status-public-bar ${state}`} />
                    ))}
                  </div>
                </div>
              </section>

              <section className="status-public-card status-public-card-overall">
                <h3>
                  Overall Uptime <span>{primaryMonitor.name}</span>
                </h3>
                <div className="status-public-card-inner status-public-overall-inner">
                  <div className="status-public-overall-metrics">
                    <article>
                      <strong>{(primaryUptime24h ?? primaryMonitorEntry.uptimePercent).toFixed(3)}%</strong>
                      <span>Last 24 hours</span>
                    </article>
                    <article>
                      <strong>{(primaryUptime7d ?? primaryMonitorEntry.uptimePercent).toFixed(3)}%</strong>
                      <span>Last 7 days</span>
                    </article>
                    <article>
                      <strong>{(primaryUptime30d ?? primaryMonitorEntry.uptimePercent).toFixed(3)}%</strong>
                      <span>Last 30 days</span>
                    </article>
                    <article>
                      <strong>{(primaryUptime90d ?? primaryMonitorEntry.uptimePercent).toFixed(3)}%</strong>
                      <span>Last 90 days</span>
                    </article>
                  </div>
                </div>
              </section>

              <section className="status-public-card status-public-card-response">
                <h3>
                  Response Time <span>{primaryMonitor.name} - {responseChartWindowLabel}</span>
                </h3>
                <div className="status-public-card-inner status-public-response-inner">
                  <div className="status-public-chart">
                    <div className="status-public-chart-surface">
                      <div className="status-public-chart-canvas">
                        <Line data={mainResponseChartData as any} options={mainResponseChartOptions as any} />
                      </div>
                    </div>
                  </div>
                  <div className="status-public-response-metrics">
                    <article>
                      <strong>{(primaryUptime24h ?? primaryMonitorEntry.uptimePercent).toFixed(3)}%</strong>
                      <span>Last 24 hours</span>
                    </article>
                    <article>
                      <strong>{(primaryUptime7d ?? primaryMonitorEntry.uptimePercent).toFixed(3)}%</strong>
                      <span>Last 7 days</span>
                    </article>
                    <article>
                      <strong>{(primaryUptime30d ?? primaryMonitorEntry.uptimePercent).toFixed(3)}%</strong>
                      <span>Last 30 days</span>
                    </article>
                  </div>
                </div>
              </section>
            </>
          ) : null}

          <section className="status-public-card">
            <h3>
              Recent events <span>{publishedMonitorEntries.length > 1 ? 'Across all services' : primaryMonitor?.name || ''}</span>
            </h3>
            {recentEvents.length === 0 ? (
              <p>No recent events.</p>
            ) : (
              <ul className="status-public-events">
                {recentEvents.map((eventItem) => (
                  <li key={eventItem.id} className={eventItem.kind}>
                    <span className="status-public-events-icon" aria-hidden="true">
                      {eventItem.kind === 'running' ? (
                        <CheckCircle2 size={16} strokeWidth={2.1} />
                      ) : (
                        <ArrowDownRight size={16} strokeWidth={2.1} />
                      )}
                    </span>
                    <div>
                      <strong>{eventItem.title}</strong>
                      <p>{eventItem.details}</p>
                      <small>
                        <Clock3 size={12} /> {eventItem.at}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default StatusPagePublicPage;
