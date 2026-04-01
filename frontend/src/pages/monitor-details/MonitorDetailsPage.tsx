import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpLeft,
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minus,
  MoreVertical,
  Upload,
  Users,
} from 'lucide-react';
import {
  fetchIncidents,
  fetchMaintenances,
  fetchMonitorLogs,
  isApiError,
  type BackendIncident,
  type BackendMaintenance,
  type BackendMonitorLog,
} from '../../lib/api';
import {
  HISTORY_BAR_COUNT,
  buildMonitorHistoryBars,
  parseUptimePercent,
  type HistoryBarState,
} from '../../lib/monitorHistory';
import './MonitorDetailsPage.css';

interface MonitorDetails {
  id: string;
  name: string;
  protocol: string;
  url?: string;
  domainExpiryMode?: 'enabled' | 'disabled';
  domainExpiryAt?: string;
  domainExpiryCheckedAt?: string;
  domainExpiryError?: string;
  sslExpiryMode?: 'enabled' | 'disabled';
  sslExpiryAt?: string;
  sslExpiryCheckedAt?: string;
  sslExpiryError?: string;
  uptimeLabel: string;
  interval: string;
  uptime: string;
  state: 'up' | 'down' | 'paused' | 'pending';
}

interface MonitorDetailsPageProps {
  monitor: MonitorDetails;
  onBack: () => void;
  onEdit: () => void;
  onRunCheck?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  onExportLogs?: () => void;
  onOpenMaintenanceInfo?: () => void;
  onOpenNotificationSettings?: () => void;
  actionFeedback?: string | null;
  refreshSignal?: number;
  isActionPending?: boolean;
}

type ResponseStats = {
  average: number | null;
  minimum: number | null;
  maximum: number | null;
};

const RESPONSE_POINT_COUNT = 16;
const RESPONSE_CHART_WIDTH = 620;
const RESPONSE_CHART_HEIGHT = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateTime = (value?: string | null): string => {
  const timestamp = toTimestamp(value);
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

const formatShortDate = (value?: string | null): string => {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return '-';

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDurationFromMs = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) {
    return '0h 00m 00s';
  }

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

const formatCompactDuration = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0m, 0s';

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h, ${minutes}m`;
  return `${minutes}m, ${seconds}s`;
};

const formatPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '- - -%';
  return `${value.toFixed(3)}%`;
};

const formatMs = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '- - ms';
  return `${Math.round(value)} ms`;
};

const parseIntervalToMinutes = (intervalLabel: string): number => {
  const hourMatch = intervalLabel.match(/(\d+)\s*h/i);
  if (hourMatch) {
    return Math.max(1, Number(hourMatch[1]) * 60);
  }

  const minuteMatch = intervalLabel.match(/(\d+)\s*min/i);
  if (minuteMatch) {
    return Math.max(1, Number(minuteMatch[1]));
  }

  return 5;
};

const mapErrorMessage = (reason: unknown): string => {
  if (isApiError(reason)) {
    return reason.message || `API error (${reason.status})`;
  }
  if (reason instanceof Error && reason.message.trim() !== '') {
    return reason.message;
  }
  return 'Impossible de charger les details du monitor.';
};

function MonitorDetailsPage({
  monitor,
  onBack,
  onEdit,
  onRunCheck,
  onPause,
  onResume,
  onDelete,
  onExportLogs,
  onOpenMaintenanceInfo,
  onOpenNotificationSettings,
  actionFeedback,
  refreshSignal = 0,
  isActionPending = false,
}: MonitorDetailsPageProps) {
  const [logs, setLogs] = useState<BackendMonitorLog[]>([]);
  const [incidents, setIncidents] = useState<BackendIncident[]>([]);
  const [maintenances, setMaintenances] = useState<BackendMaintenance[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMoreMenuOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMoreMenuOpen]);

  useEffect(() => {
    let isDisposed = false;

    const loadMonitorDetails = async (): Promise<void> => {
      setIsDataLoading(true);
      setDataError(null);

      const [logsResult, incidentsResult, maintenancesResult] = await Promise.allSettled([
        fetchMonitorLogs(monitor.id, undefined, { limit: 500 }),
        fetchIncidents(undefined, { limit: 500 }),
        fetchMaintenances(undefined, { monitorId: monitor.id }),
      ]);

      if (isDisposed) return;

      if (logsResult.status === 'fulfilled') {
        setLogs(logsResult.value.logs);
      } else {
        setLogs([]);
      }

      if (incidentsResult.status === 'fulfilled') {
        setIncidents(incidentsResult.value.incidents);
      } else {
        setIncidents([]);
      }

      if (maintenancesResult.status === 'fulfilled') {
        setMaintenances(maintenancesResult.value.maintenances);
      } else {
        setMaintenances([]);
      }

      const firstError =
        logsResult.status === 'rejected'
          ? logsResult.reason
          : incidentsResult.status === 'rejected'
            ? incidentsResult.reason
            : maintenancesResult.status === 'rejected'
              ? maintenancesResult.reason
              : null;

      setDataError(firstError ? mapErrorMessage(firstError) : null);
      setIsDataLoading(false);
    };

    void loadMonitorDetails();

    return () => {
      isDisposed = true;
    };
  }, [monitor.id, refreshSignal]);

  const linkLabel = monitor.url ?? 'No website configured';
  const isPausedOrPending = monitor.state === 'paused' || monitor.state === 'pending';
  const statusLabel = monitor.state === 'up' ? 'Up' : monitor.state === 'down' ? 'Down' : monitor.state === 'paused' ? 'Paused' : 'Pending';
  const intervalMinutes = parseIntervalToMinutes(monitor.interval);
  const onOpenNotificationConfig = onOpenNotificationSettings ?? onOpenMaintenanceInfo;

  const monitorLogs = useMemo(
    () => [...logs].sort((a, b) => toTimestamp(a.checkedAt) - toTimestamp(b.checkedAt)),
    [logs],
  );

  const monitorIncidents = useMemo(
    () =>
      incidents
        .filter((incident) => incident.monitor?._id === monitor.id)
        .sort((a, b) => {
          const aTimestamp = toTimestamp(a.startedAt ?? a.checkedAt);
          const bTimestamp = toTimestamp(b.startedAt ?? b.checkedAt);
          return bTimestamp - aTimestamp;
        }),
    [incidents, monitor.id],
  );

  const now = Date.now();
  const last24Start = now - DAY_MS;
  const logsLast24 = useMemo(
    () => monitorLogs.filter((log) => toTimestamp(log.checkedAt) >= last24Start),
    [monitorLogs, last24Start],
  );

  const lastCheckLabel = useMemo(() => {
    const lastLog = monitorLogs[monitorLogs.length - 1];
    return lastLog ? formatDateTime(lastLog.checkedAt) : 'No check yet';
  }, [monitorLogs]);

  const last24HistoryBars = useMemo<HistoryBarState[]>(() => {
    const sourceLogs = logsLast24.length > 0 ? logsLast24 : monitorLogs;
    return buildMonitorHistoryBars({
      uptime: parseUptimePercent(monitor.uptime),
      status: monitor.state,
      logsNewestFirst: [...sourceLogs].reverse(),
      barCount: HISTORY_BAR_COUNT,
    });
  }, [logsLast24, monitor.state, monitor.uptime, monitorLogs]);

  const last24Summary = useMemo(() => {
    if (logsLast24.length === 0) {
      return {
        uptime: monitor.uptime,
        incidents: 0,
        downtime: '0m, 0s down',
      };
    }

    const upChecks = logsLast24.filter((log) => log.status === 'up').length;
    const downChecks = logsLast24.length - upChecks;
    const uptime = (upChecks / logsLast24.length) * 100;
    const incidentsCount = monitorIncidents.filter(
      (incident) => toTimestamp(incident.startedAt ?? incident.checkedAt) >= last24Start,
    ).length;
    const downtimeMs = downChecks * intervalMinutes * 60 * 1000;

    return {
      uptime: formatPercent(uptime),
      incidents: incidentsCount,
      downtime: `${formatCompactDuration(downtimeMs)} down`,
    };
  }, [intervalMinutes, last24Start, logsLast24, monitor.uptime, monitorIncidents]);

  const windowStats = useMemo(() => {
    const buildStats = (days: number): { uptime: string; summary: string } => {
      const windowStart = now - days * DAY_MS;
      const scopedLogs = monitorLogs.filter((log) => toTimestamp(log.checkedAt) >= windowStart);
      const scopedIncidents = monitorIncidents.filter(
        (incident) => toTimestamp(incident.startedAt ?? incident.checkedAt) >= windowStart,
      );

      if (scopedLogs.length === 0) {
        return {
          uptime: '- - -%',
          summary: 'No checks yet',
        };
      }

      const upChecks = scopedLogs.filter((log) => log.status === 'up').length;
      const downChecks = scopedLogs.length - upChecks;
      const uptime = (upChecks / scopedLogs.length) * 100;
      const downtimeMs = downChecks * intervalMinutes * 60 * 1000;

      return {
        uptime: formatPercent(uptime),
        summary: `${scopedIncidents.length} incident(s), ${formatCompactDuration(downtimeMs)} down`,
      };
    };

    return {
      sevenDays: buildStats(7),
      thirtyDays: buildStats(30),
      year: buildStats(365),
    };
  }, [intervalMinutes, monitorIncidents, monitorLogs, now]);

  const responseLogs = useMemo(() => {
    const source = logsLast24.length > 0 ? logsLast24 : monitorLogs;
    return source.slice(-RESPONSE_POINT_COUNT);
  }, [logsLast24, monitorLogs]);

  const responseStats = useMemo<ResponseStats>(() => {
    if (responseLogs.length === 0) {
      return { average: null, minimum: null, maximum: null };
    }

    const values = responseLogs.map((log) => Math.max(0, log.responseTime));
    const sum = values.reduce((acc, value) => acc + value, 0);

    return {
      average: sum / values.length,
      minimum: Math.min(...values),
      maximum: Math.max(...values),
    };
  }, [responseLogs]);

  const responseChartMax = useMemo(() => {
    if (responseStats.maximum === null) return 20000;
    if (responseStats.maximum <= 2000) return 2000;
    if (responseStats.maximum <= 10000) return 10000;
    return Math.ceil(responseStats.maximum / 5000) * 5000;
  }, [responseStats.maximum]);

  const responsePolylinePoints = useMemo(() => {
    if (responseLogs.length === 0) return '';

    const denominator = Math.max(1, responseLogs.length - 1);
    return responseLogs
      .map((log, index) => {
        const x = (index / denominator) * RESPONSE_CHART_WIDTH;
        const normalized = Math.min(1, Math.max(0, log.responseTime / responseChartMax));
        const y = RESPONSE_CHART_HEIGHT - normalized * RESPONSE_CHART_HEIGHT;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [responseChartMax, responseLogs]);

  const responseXAxisLabels = useMemo(() => {
    if (responseLogs.length === 0) {
      return ['-', '-', '-'];
    }

    const middleIndex = Math.floor(responseLogs.length / 2);
    return [
      formatShortDate(responseLogs[0].checkedAt),
      formatShortDate(responseLogs[middleIndex].checkedAt),
      formatShortDate(responseLogs[responseLogs.length - 1].checkedAt),
    ];
  }, [responseLogs]);

  const latestIncidentRows = useMemo(
    () =>
      monitorIncidents.slice(0, 4).map((incident) => {
        const startedAt = incident.startedAt ?? incident.checkedAt;
        const durationMs = incident.durationMs ?? 0;
        const isOngoing = incident.status === 'down';
        const rootCause = incident.errorMessage || (incident.statusCode ? `HTTP ${incident.statusCode}` : 'Unknown error');

        return {
          id: incident._id,
          status: isOngoing ? 'Ongoing' : 'Resolved',
          isOngoing,
          rootCause,
          started: formatDateTime(startedAt),
          duration: formatDurationFromMs(durationMs),
        };
      }),
    [monitorIncidents],
  );

  const nextMaintenance = useMemo(() => {
    const activeStatuses = new Set(['scheduled', 'ongoing', 'paused']);
    return (
      maintenances
        .filter((maintenance) => maintenance.monitor?._id === monitor.id)
        .filter(
          (maintenance) =>
            activeStatuses.has(maintenance.status) && toTimestamp(maintenance.endAt) >= Date.now(),
        )
        .sort((a, b) => toTimestamp(a.startAt) - toTimestamp(b.startAt))[0] ?? null
    );
  }, [maintenances, monitor.id]);

  const domainAndSsl = useMemo(() => {
    try {
      const parsedUrl = new URL(monitor.url ?? '');
      const isTls = parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:';
      return {
        domain: parsedUrl.host,
        ssl: isTls ? 'TLS/SSL check active' : 'TLS/SSL not applicable',
      };
    } catch {
      return {
        domain: 'Unavailable',
        ssl: 'Unavailable',
      };
    }
  }, [monitor.url]);

  const domainExpiryLabel = useMemo(() => {
    if (monitor.domainExpiryMode !== 'enabled') {
      return 'Disabled';
    }
    if (!monitor.domainExpiryCheckedAt) {
      return 'Checking...';
    }
    if (!monitor.domainExpiryAt) {
      return 'Unavailable';
    }
    return formatShortDate(monitor.domainExpiryAt);
  }, [monitor.domainExpiryAt, monitor.domainExpiryCheckedAt, monitor.domainExpiryMode]);

  const sslExpiryLabel = useMemo(() => {
    if (monitor.sslExpiryMode !== 'enabled') {
      return 'Disabled';
    }
    if (!monitor.sslExpiryCheckedAt) {
      return 'Checking...';
    }
    if (!monitor.sslExpiryAt) {
      return 'Unavailable';
    }
    return formatShortDate(monitor.sslExpiryAt);
  }, [monitor.sslExpiryAt, monitor.sslExpiryCheckedAt, monitor.sslExpiryMode]);

  return (
    <section className="monitor-details-page">
      <div className="monitor-details-breadcrumb">
        <button type="button" className="monitor-details-back" onClick={onBack}>
          <ChevronLeft size={14} />
          <span>Monitoring</span>
        </button>
        <ChevronRight size={14} className="monitor-details-separator" />
        <span>{monitor.name}</span>
      </div>

      <header className="monitor-details-header-card">
        <div className="monitor-details-title-wrap">
          <div className="monitor-details-logo">
            <span />
          </div>
          <div className="monitor-details-copy">
            <h2>{monitor.name}</h2>
            {monitor.url ? (
              <p className="monitor-details-subline">
                <span>{monitor.protocol}/s monitor for </span>
                <a href={monitor.url} target="_blank" rel="noreferrer" className="monitor-details-link">
                  {linkLabel}
                </a>
                <ExternalLink size={12} />
              </p>
            ) : (
              <p>{monitor.protocol}/s monitor for {linkLabel}</p>
            )}
          </div>
        </div>

        <div className="monitor-details-actions">
          <button type="button" className="monitor-action-button" onClick={onRunCheck} disabled={isActionPending}>
            <Bell size={13} />
            Test Notification
          </button>
          <button
            type="button"
            className="monitor-action-button"
            onClick={isPausedOrPending ? onResume : onPause}
            disabled={isActionPending}
          >
            <span className="material-symbols-outlined monitor-pause-icon" aria-hidden="true">
              {isPausedOrPending ? 'play_circle' : 'pause_circle'}
            </span>
            {isPausedOrPending ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="monitor-action-button" onClick={onEdit}>
            <span className="material-symbols-outlined monitor-edit-icon" aria-hidden="true">
              settings
            </span>
            Edit
          </button>
          <div className="monitor-details-more-menu" ref={moreMenuRef}>
            <button
              type="button"
              className="monitor-details-more-button"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={isMoreMenuOpen}
              onClick={() => setIsMoreMenuOpen((previousOpen) => !previousOpen)}
              disabled={isActionPending}
            >
              <MoreVertical size={13} />
            </button>
            {isMoreMenuOpen ? (
              <div className="monitor-details-more-menu-popover" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onDelete?.();
                  }}
                  disabled={isActionPending || !onDelete}
                  className="danger"
                >
                  Delete monitor
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {actionFeedback ? <p className="monitor-details-action-feedback">{actionFeedback}</p> : null}
      {dataError ? <p className="monitor-details-data-error">{dataError}</p> : null}

      <div className="monitor-details-content-grid">
        <div className="monitor-details-main-column">
          <div className="monitor-details-stats-grid">
            <article>
              <h3>Current status</h3>
              <p className={monitor.state === 'up' ? 'status-up' : 'status-down'}>
                {statusLabel}
              </p>
              <span>Currently {monitor.uptimeLabel.toLowerCase()}</span>
            </article>
            <article>
              <h3>Last check</h3>
              <p>{isDataLoading ? 'Loading...' : lastCheckLabel}</p>
              <span>Checked every {monitor.interval}</span>
            </article>
            <article className="monitor-last24-card">
              <div className="stat-row-head">
                <h3>Last 24 hours</h3>
                <strong>{last24Summary.uptime}</strong>
              </div>
              <div className="mini-history" aria-hidden="true">
                {last24HistoryBars.map((state, index) => (
                  <span key={`last24-${monitor.id}-${index}`} className={`mini-history-bar ${state}`} />
                ))}
              </div>
              <span>{last24Summary.incidents} incidents, {last24Summary.downtime}</span>
            </article>
          </div>

          <section className="monitor-details-ranges-card">
            <article className="range-cell">
              <h3>Last 7 days</h3>
              <p>{windowStats.sevenDays.uptime}</p>
              <span>{windowStats.sevenDays.summary}</span>
            </article>
            <article className="range-cell">
              <h3>Last 30 days</h3>
              <p>{windowStats.thirtyDays.uptime}</p>
              <span>{windowStats.thirtyDays.summary}</span>
            </article>
            <article className="range-cell">
              <h3>Last 365 days</h3>
              <p>{windowStats.year.uptime}</p>
              <span>{windowStats.year.summary}</span>
            </article>
            <article className="range-cell">
              <button type="button" className="range-picker-button" onClick={onExportLogs}>
                <CalendarClock size={12} />
                <span>Open incidents</span>
                <ChevronDown size={13} />
              </button>
              <p>{monitor.uptime}</p>
              <span>{monitorIncidents.length} incidents total</span>
            </article>
          </section>

          <section className="monitor-details-response">
            <div className="response-header">
              <h3>Response time</h3>
              <button type="button" onClick={onRunCheck} disabled={isActionPending}>
                Last 24 hours
                <ChevronDown size={13} />
              </button>
            </div>
            <div className="response-chart-layout">
              <div className="response-y-axis" aria-hidden="true">
                <span>{responseChartMax} ms</span>
                <span>{Math.round(responseChartMax / 2)} ms</span>
                <span>0 ms</span>
              </div>
              <div className="response-chart-wrap">
                <div className="response-chart" aria-hidden="true">
                  <svg viewBox={`0 0 ${RESPONSE_CHART_WIDTH} ${RESPONSE_CHART_HEIGHT}`} preserveAspectRatio="none">
                    <polyline
                      points={responsePolylinePoints}
                      fill="none"
                      stroke="#08a7f3"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="response-x-axis" aria-hidden="true">
                  {responseXAxisLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="response-metrics">
              <article className="metric-average">
                <div className="metric-value">
                  <Minus size={14} />
                  <strong>{formatMs(responseStats.average)}</strong>
                </div>
                <span>Average</span>
              </article>
              <article className="metric-min">
                <div className="metric-value">
                  <ArrowDownLeft size={14} />
                  <strong>{formatMs(responseStats.minimum)}</strong>
                </div>
                <span>Minimum</span>
              </article>
              <article className="metric-max">
                <div className="metric-value">
                  <ArrowUpLeft size={14} />
                  <strong>{formatMs(responseStats.maximum)}</strong>
                </div>
                <span>Maximum</span>
              </article>
            </div>
          </section>

          <section className="monitor-details-incidents">
            <div className="incidents-header">
              <h3>Latest incidents</h3>
              <button type="button" onClick={onExportLogs}>
                <Upload size={13} />
                Export logs
              </button>
            </div>
            <div className="incidents-table">
              <div className="incidents-table-head">
                <span>Status</span>
                <span>Root Cause</span>
                <span>Started</span>
                <span>Duration</span>
              </div>
              {latestIncidentRows.length === 0 ? (
                <div className="incidents-row">
                  <span>No incidents</span>
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                </div>
              ) : null}
              {latestIncidentRows.map((incident) => (
                <div className="incidents-row" key={incident.id}>
                  <span className={`resolved-pill ${incident.isOngoing ? 'ongoing' : ''}`}>
                    <span className={`resolved-dot ${incident.isOngoing ? 'ongoing' : ''}`} aria-hidden="true" />
                    {incident.status}
                  </span>
                  <span>{incident.rootCause}</span>
                  <span>{incident.started}</span>
                  <span>{incident.duration}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="monitor-details-side">
          <article className="monitor-side-card">
            <h3>Domain & SSL</h3>
            <p>Domain: {domainAndSsl.domain}</p>
            <p>SSL: {domainAndSsl.ssl}</p>
            <p>SSL expiry: {sslExpiryLabel}</p>
            {monitor.sslExpiryMode === 'enabled' && monitor.sslExpiryCheckedAt ? (
              <p>SSL checked: {formatDateTime(monitor.sslExpiryCheckedAt)}</p>
            ) : null}
            {monitor.sslExpiryMode === 'enabled' && monitor.sslExpiryError ? (
              <p>SSL error: {monitor.sslExpiryError}</p>
            ) : null}
            <p>Domain expiry: {domainExpiryLabel}</p>
            {monitor.domainExpiryMode === 'enabled' && monitor.domainExpiryCheckedAt ? (
              <p>WHOIS checked: {formatDateTime(monitor.domainExpiryCheckedAt)}</p>
            ) : null}
            {monitor.domainExpiryMode === 'enabled' && monitor.domainExpiryError ? (
              <p>WHOIS error: {monitor.domainExpiryError}</p>
            ) : null}
          </article>
          <article className="monitor-side-card">
            <div className="monitor-side-card-head">
              <h3>Next maintenance</h3>
              <button
                type="button"
                className="side-card-settings-button"
                aria-label="Open maintenance settings"
                onClick={onOpenMaintenanceInfo}
                disabled={!onOpenMaintenanceInfo}
              >
                <span className="material-symbols-outlined side-card-settings-icon" aria-hidden="true">
                  settings
                </span>
              </button>
            </div>
            {nextMaintenance ? (
              <>
                <p>
                  {nextMaintenance.status.toUpperCase()} - {formatDateTime(nextMaintenance.startAt)}
                </p>
                <p>{nextMaintenance.name}</p>
              </>
            ) : (
              <p>No maintenance planned</p>
            )}
            <button type="button" onClick={onOpenMaintenanceInfo}>
              Set up maintenance
            </button>
          </article>
          <article className="monitor-side-card">
            <div className="monitor-side-card-head">
              <h3>To be notified</h3>
              <button
                type="button"
                className="side-card-settings-button"
                aria-label="Open notification settings"
                onClick={onOpenNotificationConfig}
                disabled={!onOpenNotificationConfig}
              >
                <span className="material-symbols-outlined side-card-settings-icon" aria-hidden="true">
                  settings
                </span>
              </button>
            </div>
            <div className="notify-row">
              <span className="avatar">A</span>
              <span className="avatar">B</span>
              <span className="avatar users-icon">
                <Users size={12} />
              </span>
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

export default MonitorDetailsPage;
