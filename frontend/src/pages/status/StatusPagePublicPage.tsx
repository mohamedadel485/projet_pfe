import { CheckCircle2, AlertTriangle, Clock3, LockKeyhole } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  fetchIncidents,
  fetchMonitorLogs,
  fetchMonitors,
  isApiError,
  type BackendIncident,
  type BackendMonitor,
  type BackendMonitorLog,
} from '../../lib/api';
import './status-page-public-page.css';

interface StatusPagePublicPageProps {
  statusPageId: string;
  onBackToStatusPages: () => void;
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
}

interface StoredStatusPageSettings {
  pageName?: string;
  password?: string;
  passwordEnabled?: boolean;
}

const getStatusPageMonitorStorageKey = (statusPageId: string) =>
  `uptimewarden_status_page_monitors_${statusPageId}`;

const getStatusPageSettingsStorageKey = (statusPageId: string) =>
  `uptimewarden_status_page_settings_${statusPageId}`;

const parseDateMs = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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

const parseStatusPageIndex = (statusPageId: string): number | null => {
  const match = statusPageId.match(/^status-page-(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : null;
};

const pickMonitorFromStatusPageId = (monitors: BackendMonitor[], statusPageId: string): BackendMonitor | null => {
  if (monitors.length === 0) return null;

  const directMatch = monitors.find((monitor) => monitor._id === statusPageId);
  if (directMatch) return directMatch;

  const statusPageIndex = parseStatusPageIndex(statusPageId);
  if (statusPageIndex !== null && monitors[statusPageIndex]) {
    return monitors[statusPageIndex];
  }

  return monitors[0] ?? null;
};

const readStoredStatusPageSettings = (statusPageId: string): StoredStatusPageSettings => {
  try {
    const storedValue = window.localStorage.getItem(getStatusPageSettingsStorageKey(statusPageId));
    if (!storedValue) return {};

    const parsedValue = JSON.parse(storedValue) as StoredStatusPageSettings;
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch {
    return {};
  }
};

const readStoredMonitorIds = (statusPageId: string, monitors: BackendMonitor[]): string[] => {
  const validMonitorIds = new Set(monitors.map((monitor) => monitor._id));

  try {
    const storedValue = window.localStorage.getItem(getStatusPageMonitorStorageKey(statusPageId));
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue.filter(
      (monitorId): monitorId is string => typeof monitorId === 'string' && validMonitorIds.has(monitorId),
    );
  } catch {
    return [];
  }
};

const pickPublishedMonitors = (monitors: BackendMonitor[], statusPageId: string): BackendMonitor[] => {
  const storedMonitorIds = readStoredMonitorIds(statusPageId, monitors);
  if (storedMonitorIds.length > 0) {
    return storedMonitorIds
      .map((monitorId) => monitors.find((monitor) => monitor._id === monitorId) ?? null)
      .filter((monitor): monitor is BackendMonitor => monitor !== null);
  }

  const fallbackMonitor = pickMonitorFromStatusPageId(monitors, statusPageId);
  return fallbackMonitor ? [fallbackMonitor] : [];
};

const buildUptimeBars = (logsNewestFirst: BackendMonitorLog[], monitorStatus: BackendMonitor['status']): Array<'up' | 'down'> => {
  if (logsNewestFirst.length === 0) {
    return Array.from({ length: 90 }, () => (monitorStatus === 'down' ? 'down' : 'up'));
  }

  const bars = logsNewestFirst
    .slice(0, 90)
    .reverse()
    .map((log) => (log.status === 'down' ? 'down' : 'up'));

  if (bars.length < 90) {
    const padValue = monitorStatus === 'down' ? 'down' : 'up';
    return [...Array.from({ length: 90 - bars.length }, () => padValue), ...bars];
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

const buildResponsePath = (logsNewestFirst: BackendMonitorLog[], fallbackMs: number): string => {
  const upLogsOldestFirst = logsNewestFirst
    .filter((log) => log.status === 'up' && Number.isFinite(log.responseTime))
    .slice(0, 240)
    .reverse();

  const bucketCount = 16;
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);

  if (upLogsOldestFirst.length === 0) {
    const baseline = Math.max(1, fallbackMs);
    for (let index = 0; index < bucketCount; index += 1) {
      buckets[index].push(baseline);
    }
  } else {
    upLogsOldestFirst.forEach((log, index) => {
      const bucketIndex = Math.min(bucketCount - 1, Math.floor((index / upLogsOldestFirst.length) * bucketCount));
      buckets[bucketIndex].push(log.responseTime);
    });
  }

  const averages: number[] = [];
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    if (bucket.length > 0) {
      averages.push(bucket.reduce((sum, value) => sum + value, 0) / bucket.length);
      continue;
    }

    if (index > 0) {
      averages.push(averages[index - 1] ?? fallbackMs);
      continue;
    }

    averages.push(fallbackMs);
  }

  const minValue = Math.min(...averages);
  const maxValue = Math.max(...averages);
  const span = Math.max(1, maxValue - minValue);

  return averages
    .map((value: number, index: number) => {
      const normalized = (value - minValue) / span;
      const x = (index / (averages.length - 1)) * 100;
      const y = 80 - normalized * 55;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
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

function StatusPagePublicPage({ statusPageId, onBackToStatusPages }: StatusPagePublicPageProps) {
  const storedStatusPageSettings = useMemo(() => readStoredStatusPageSettings(statusPageId), [statusPageId]);
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
  const [publishedMonitors, setPublishedMonitors] = useState<BackendMonitor[]>([]);
  const [monitorLogsById, setMonitorLogsById] = useState<Record<string, BackendMonitorLog[]>>({});
  const [monitorIncidentsById, setMonitorIncidentsById] = useState<Record<string, BackendIncident[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setPageName(configuredPageName);
    setPasswordInput('');
    setPasswordError(null);
    setUnlockedPassword(configuredPassword.trim() ? null : configuredPassword);
  }, [configuredPageName, configuredPassword]);

  useEffect(() => {
    let cancelled = false;

    const loadPublicStatusData = async () => {
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

      try {
        const monitorsResponse = await fetchMonitors();
        if (cancelled) return;

        const availableMonitors = monitorsResponse.monitors ?? [];
        const nextPublishedMonitors = pickPublishedMonitors(availableMonitors, statusPageId);
        const storedSettings = readStoredStatusPageSettings(statusPageId);
        const nextPageName =
          storedSettings.pageName?.trim() ||
          (nextPublishedMonitors.length === 1 ? nextPublishedMonitors[0].name : 'Service status');

        setPageName(nextPageName);
        setPublishedMonitors(nextPublishedMonitors);

        if (nextPublishedMonitors.length === 0) {
          setMonitorLogsById({});
          setMonitorIncidentsById({});
          return;
        }

        const [incidentsResponse, logEntries] = await Promise.all([
          fetchIncidents(undefined, { limit: 500 }),
          Promise.all(
            nextPublishedMonitors.map(async (monitor) => {
              const logsResponse = await fetchMonitorLogs(monitor._id, undefined, { limit: 2000 });
              const logs = [...logsResponse.logs].sort((a, b) => parseDateMs(b.checkedAt) - parseDateMs(a.checkedAt));
              return [monitor._id, logs] as const;
            }),
          ),
        ]);
        if (cancelled) return;

        setMonitorLogsById(Object.fromEntries(logEntries));
        setMonitorIncidentsById(
          Object.fromEntries(
            nextPublishedMonitors.map((monitor) => [
              monitor._id,
              incidentsResponse.incidents.filter((incident) => incident.monitor?._id === monitor._id),
            ]),
          ),
        );
      } catch (error) {
        if (cancelled) return;

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
  }, [configuredPassword, statusPageId, unlockedPassword]);

  const isPasswordRequired = configuredPassword.trim() !== '';
  const isPasswordUnlocked = !isPasswordRequired || unlockedPassword === configuredPassword;
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

        return {
          monitor,
          logs,
          incidents,
          uptimeBars,
          uptimePercent,
          lastChecked: logs[0]?.checkedAt ?? monitor.lastChecked ?? null,
          healthLabel: getMonitorHealthLabel(monitor.status),
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

  const responsePath = useMemo(
    () => buildResponsePath(primaryMonitorEntry?.logs ?? [], primaryMonitor?.responseTime ?? 120),
    [primaryMonitor, primaryMonitorEntry],
  );

  const handleUnlockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isPasswordRequired) {
      setUnlockedPassword(configuredPassword);
      setPasswordError(null);
      return;
    }

    if (passwordInput === configuredPassword) {
      setUnlockedPassword(configuredPassword);
      setPasswordError(null);
      return;
    }

    setPasswordError('Incorrect password. Please try again.');
  };

  return (
    <section className="status-page-public-page">
      {isLocked ? (
        <>
          <section className="status-public-hero">
            <div className="status-public-hero-inner">
              <div className="status-public-hero-side">
                <button type="button" className="status-public-crumb" onClick={onBackToStatusPages}>
                  <span aria-hidden="true">&lsaquo;</span>
                  Status pages
                </button>
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
                <button type="button" className="status-public-crumb" onClick={onBackToStatusPages}>
                  <span aria-hidden="true">&lsaquo;</span>
                  Status pages
                </button>
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
                </article>
              ))}
            </div>
          </section>

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
                  <div className="status-public-metrics">
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
                  Response Time <span>{primaryMonitor.name} - Last 90 days</span>
                </h3>
                <div className="status-public-card-inner status-public-response-inner">
                  <div className="status-public-chart">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Response time chart">
                      <path d={responsePath} />
                    </svg>
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
                      {eventItem.kind === 'running' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
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
