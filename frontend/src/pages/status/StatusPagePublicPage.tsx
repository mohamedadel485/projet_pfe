import { CheckCircle2, AlertTriangle, Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

interface StatusEvent {
  id: string;
  kind: EventKind;
  title: string;
  details: string;
  at: string;
}

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

const buildRecentEvents = (incidents: BackendIncident[]): StatusEvent[] => {
  const sortedIncidents = [...incidents].sort(
    (a, b) => parseDateMs(b.startedAt ?? b.checkedAt) - parseDateMs(a.startedAt ?? a.checkedAt)
  );

  return sortedIncidents.slice(0, 6).map((incident) => {
    const isResolved = incident.status === 'up';
    const title = isResolved ? 'Running again' : 'Degraded';
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

function StatusPagePublicPage({ statusPageId, onBackToStatusPages }: StatusPagePublicPageProps) {
  const [selectedMonitor, setSelectedMonitor] = useState<BackendMonitor | null>(null);
  const [monitorLogs, setMonitorLogs] = useState<BackendMonitorLog[]>([]);
  const [monitorIncidents, setMonitorIncidents] = useState<BackendIncident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPublicStatusData = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const monitorsResponse = await fetchMonitors();
        if (cancelled) return;

        const availableMonitors = monitorsResponse.monitors ?? [];
        const monitor = pickMonitorFromStatusPageId(availableMonitors, statusPageId);
        setSelectedMonitor(monitor);

        if (!monitor) {
          setMonitorLogs([]);
          setMonitorIncidents([]);
          return;
        }

        const [logsResponse, incidentsResponse] = await Promise.all([
          fetchMonitorLogs(monitor._id, undefined, { limit: 2000 }),
          fetchIncidents(undefined, { limit: 500 }),
        ]);
        if (cancelled) return;

        const logs = [...logsResponse.logs].sort((a, b) => parseDateMs(b.checkedAt) - parseDateMs(a.checkedAt));
        const incidents = incidentsResponse.incidents.filter((incident) => incident.monitor?._id === monitor._id);

        setMonitorLogs(logs);
        setMonitorIncidents(incidents);
      } catch (error) {
        if (cancelled) return;

        if (isApiError(error)) {
          setLoadError(error.message || 'Unable to load status page data.');
        } else if (error instanceof Error && error.message.trim() !== '') {
          setLoadError(error.message);
        } else {
          setLoadError('Unable to load status page data.');
        }

        setSelectedMonitor(null);
        setMonitorLogs([]);
        setMonitorIncidents([]);
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
  }, [statusPageId]);

  const uptimeBars = useMemo(
    () => (selectedMonitor ? buildUptimeBars(monitorLogs, selectedMonitor.status) : Array.from({ length: 90 }, () => 'up' as const)),
    [monitorLogs, selectedMonitor]
  );

  const uptimePercent = useMemo(() => {
    if (!selectedMonitor) return 0;
    if (uptimeBars.length === 0) return selectedMonitor.uptime;
    const upBars = uptimeBars.filter((bar) => bar === 'up').length;
    return (upBars / uptimeBars.length) * 100;
  }, [selectedMonitor, uptimeBars]);

  const uptimeLabel = `${uptimePercent.toFixed(3)}%`;
  const uptime24h = calculateUptimeForHours(monitorLogs, 24);
  const uptime7d = calculateUptimeForHours(monitorLogs, 24 * 7);
  const uptime30d = calculateUptimeForHours(monitorLogs, 24 * 30);
  const uptime90d = calculateUptimeForHours(monitorLogs, 24 * 90);

  const responsePath = useMemo(
    () => buildResponsePath(monitorLogs, selectedMonitor?.responseTime ?? 120),
    [monitorLogs, selectedMonitor]
  );

  const recentEvents = useMemo(() => buildRecentEvents(monitorIncidents), [monitorIncidents]);

  const effectiveLastChecked = useMemo(() => {
    if (monitorLogs.length > 0) return monitorLogs[0].checkedAt;
    return selectedMonitor?.lastChecked ?? null;
  }, [monitorLogs, selectedMonitor]);

  const selectedMonitorHealthLabel =
    selectedMonitor?.status === 'up'
      ? 'operational'
      : selectedMonitor?.status === 'down'
        ? 'degraded'
        : selectedMonitor?.status === 'paused'
          ? 'paused'
          : 'pending';

  return (
    <section className="status-page-public-page">
      {isLoading ? (
        <section className="status-public-card">
          <p>Loading status page data...</p>
        </section>
      ) : loadError ? (
        <section className="status-public-card">
          <p>{loadError}</p>
        </section>
      ) : !selectedMonitor ? (
        <section className="status-public-card">
          <p>No monitor available to publish on this status page.</p>
        </section>
      ) : (
        <>
          <section className="status-public-hero">
            <div className="status-public-hero-inner">
              <div className="status-public-hero-side">
                <p className="status-public-eyebrow">Status pages</p>
                <button type="button" className="status-public-crumb" onClick={onBackToStatusPages}>
                  <span aria-hidden="true">&lsaquo;</span>
                  Status pages
                </button>
              </div>
              <div className="status-public-hero-side status-public-hero-right">
                <h1>Service status</h1>
                <p>
                  Last updated {formatDateTime(effectiveLastChecked)} | next update in {selectedMonitor.interval} min
                </p>
              </div>
            </div>
          </section>

          <section className="status-public-card summary">
            <div className="status-public-summary-icon" aria-hidden="true">
              <span />
            </div>
            <div>
              <h2>
                {selectedMonitor.name} is{' '}
                <span className={`health-${selectedMonitorHealthLabel}`}>{selectedMonitorHealthLabel}</span>
              </h2>
              <p>{selectedMonitor.url}</p>
            </div>
          </section>

          <section className="status-public-card status-public-card-uptime">
            <h3>
              Uptime <span>{selectedMonitor.name} - Last 90 days</span>
            </h3>
            <div className="status-public-card-inner status-public-uptime-inner">
              <p className="status-public-kpi">{uptimeLabel}</p>
              <div className="status-public-bars">
                {uptimeBars.map((state, index) => (
                  <span key={`uptime-${index}`} className={`status-public-bar ${state}`} />
                ))}
              </div>
            </div>
          </section>

          <section className="status-public-card status-public-card-overall">
            <h3>
              Overall Uptime <span>{selectedMonitor.name}</span>
            </h3>
            <div className="status-public-card-inner status-public-overall-inner">
              <div className="status-public-metrics">
                <article>
                  <strong>{(uptime24h ?? uptimePercent).toFixed(3)}%</strong>
                  <span>Last 24 hours</span>
                </article>
                <article>
                  <strong>{(uptime7d ?? uptimePercent).toFixed(3)}%</strong>
                  <span>Last 7 days</span>
                </article>
                <article>
                  <strong>{(uptime30d ?? uptimePercent).toFixed(3)}%</strong>
                  <span>Last 30 days</span>
                </article>
                <article>
                  <strong>{(uptime90d ?? uptimePercent).toFixed(3)}%</strong>
                  <span>Last 90 days</span>
                </article>
              </div>
            </div>
          </section>

          <section className="status-public-card status-public-card-response">
            <h3>
              Response Time <span>{selectedMonitor.name} - Last 90 days</span>
            </h3>
            <div className="status-public-card-inner status-public-response-inner">
              <div className="status-public-chart">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Response time chart">
                  <path d={responsePath} />
                </svg>
              </div>
              <div className="status-public-response-metrics">
                <article>
                  <strong>{(uptime24h ?? uptimePercent).toFixed(3)}%</strong>
                  <span>Last 24 hours</span>
                </article>
                <article>
                  <strong>{(uptime7d ?? uptimePercent).toFixed(3)}%</strong>
                  <span>Last 7 days</span>
                </article>
                <article>
                  <strong>{(uptime30d ?? uptimePercent).toFixed(3)}%</strong>
                  <span>Last 30 days</span>
                </article>
              </div>
            </div>
          </section>

          <section className="status-public-card">
            <h3>
              Recent events <span>{selectedMonitor.name}</span>
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
