import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  EllipsisVertical,
  Copy,
  Radio,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import { fetchIncidents, isApiError, type BackendIncident } from '../../lib/api';
import './incidents-page.css';

interface IncidentRow {
  id: string;
  status: 'Resolved' | 'Ongoing';
  monitor: string;
  monitorId: string | null;
  monitorUrl: string;
  rootCause: string;
  comments: number;
  started: string;
  resolved: string;
  duration: string;
  visibility: string;
  statusCode?: number;
}

type RequestTab = 'url' | 'headers';
type ResponseTab = 'body' | 'headers';
type IncidentFilterId =
  | 'resolved'
  | 'ongoing'
  | 'root-timeout'
  | 'root-2xx'
  | 'root-3xx'
  | 'root-4xx'
  | 'root-5xx'
  | 'root-dns'
  | 'root-assertion'
  | 'root-invalid-json'
  | 'slow-response';
type IncidentSortOption = 'down-first' | 'up-first' | 'paused-first' | 'a-z' | 'newest-first';
type IncidentTagOption = 'All tags' | 'Website' | 'API' | 'Core' | 'Interface';

interface IncidentFilterOption {
  id: IncidentFilterId;
  label: string;
  matches: (incident: IncidentRow) => boolean;
}

const rootCauseIncludes = (incident: IncidentRow, terms: string[]): boolean => {
  const normalizedRootCause = incident.rootCause.toLowerCase();
  return terms.some((term) => normalizedRootCause.includes(term));
};

const incidentFilterOptions: IncidentFilterOption[] = [
  { id: 'resolved', label: 'Resolved', matches: (incident) => incident.status === 'Resolved' },
  { id: 'ongoing', label: 'Ongoing', matches: (incident) => incident.status === 'Ongoing' },
  {
    id: 'root-timeout',
    label: 'Root cause: Time/Out',
    matches: (incident) => rootCauseIncludes(incident, ['timeout', 'time out']),
  },
  { id: 'root-2xx', label: 'Root cause: 2xx', matches: (incident) => rootCauseIncludes(incident, ['2xx']) },
  { id: 'root-3xx', label: 'Root cause: 3xx', matches: (incident) => rootCauseIncludes(incident, ['3xx']) },
  { id: 'root-4xx', label: 'Root cause: 4xx', matches: (incident) => rootCauseIncludes(incident, ['4xx']) },
  {
    id: 'root-5xx',
    label: 'Root cause: 5xx',
    matches: (incident) => rootCauseIncludes(incident, ['5xx', 'server error', 'internal server error']),
  },
  {
    id: 'root-dns',
    label: 'Root cause: DNS resolving issue',
    matches: (incident) => rootCauseIncludes(incident, ['dns']),
  },
  {
    id: 'root-assertion',
    label: 'Root cause: Assertion failed',
    matches: (incident) => rootCauseIncludes(incident, ['assertion']),
  },
  {
    id: 'root-invalid-json',
    label: 'Root cause: Invalid JSON response',
    matches: (incident) => rootCauseIncludes(incident, ['invalid json']),
  },
  { id: 'slow-response', label: 'Slow response', matches: (incident) => rootCauseIncludes(incident, ['slow']) },
];
const incidentSortOptionLabels: Record<IncidentSortOption, string> = {
  'down-first': 'Down first',
  'up-first': 'Up first',
  'paused-first': 'Paused first',
  'a-z': 'A -> Z',
  'newest-first': 'Newest first',
};
const incidentSortOptions: IncidentSortOption[] = ['down-first', 'up-first', 'paused-first', 'a-z', 'newest-first'];
const incidentTagOptions: IncidentTagOption[] = ['All tags', 'Website', 'API', 'Core', 'Interface'];
const incidentStatusRank: Record<IncidentRow['status'], number> = {
  Ongoing: 0,
  Resolved: 1,
};

const parseIncidentDate = (dateText: string): number => {
  const normalizedDateText = dateText.replace(/(\d)(AM|PM)$/i, '$1 $2');
  const timestamp = Date.parse(normalizedDateText);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getIncidentNumericId = (incidentId: string): number => {
  const numericPart = Number(incidentId.replace(/\D+/g, ''));
  return Number.isNaN(numericPart) ? 0 : numericPart;
};

const formatIncidentDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date
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

const formatCsvDateTime = (value: string): string => {
  if (value === '-') return '';

  const timestamp = parseIncidentDate(value);
  if (timestamp === 0) return '';

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const durationLabelToSeconds = (value: string): string => {
  const match = value.match(/^(\d+)h\s+(\d{2})m\s+(\d{2})s$/);
  if (!match) return '';

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) return '';
  return String(hours * 3600 + minutes * 60 + seconds);
};

const parseCheckedAtMs = (incident: BackendIncident): number => {
  const timestamp = Date.parse(incident.checkedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const deriveRootCause = (incident: BackendIncident): string => {
  if (typeof incident.errorMessage === 'string' && incident.errorMessage.trim() !== '') {
    return incident.errorMessage;
  }

  if (typeof incident.statusCode === 'number') {
    if (incident.statusCode >= 500) return `${incident.statusCode} Internal server error`;
    if (incident.statusCode >= 400) return `${incident.statusCode} Client error`;
    if (incident.statusCode >= 300) return `${incident.statusCode} Redirect response`;
    if (incident.statusCode >= 200) return `${incident.statusCode} Success response`;
  }

  return incident.status === 'up' ? 'Recovered' : 'Unknown error';
};

const buildResolvedIncidentRow = (
  startedLog: BackendIncident,
  resolvedLog: BackendIncident,
  rootCauseLog: BackendIncident
): IncidentRow => {
  const monitorName = startedLog.monitor?.name ?? resolvedLog.monitor?.name ?? 'Unknown monitor';
  const monitorId = startedLog.monitor?._id ?? resolvedLog.monitor?._id ?? null;
  const monitorUrl = startedLog.monitor?.url ?? resolvedLog.monitor?.url ?? '';
  const startedMs = parseCheckedAtMs(startedLog);
  const resolvedMs = parseCheckedAtMs(resolvedLog);
  const durationMs = resolvedMs > startedMs ? resolvedMs - startedMs : rootCauseLog.responseTime;

  return {
    id: `incident-${monitorId ?? 'unknown'}-${startedMs}-${resolvedMs}`,
    status: 'Resolved',
    monitor: monitorName,
    monitorId,
    monitorUrl,
    rootCause: deriveRootCause(rootCauseLog),
    comments: 0,
    started: formatIncidentDate(startedLog.checkedAt),
    resolved: formatIncidentDate(resolvedLog.checkedAt),
    duration: formatDurationFromMs(durationMs),
    visibility: 'Included',
    statusCode: rootCauseLog.statusCode,
  };
};

const buildOngoingIncidentRow = (startedLog: BackendIncident, rootCauseLog: BackendIncident): IncidentRow => {
  const monitorName = startedLog.monitor?.name ?? 'Unknown monitor';
  const monitorId = startedLog.monitor?._id ?? null;
  const monitorUrl = startedLog.monitor?.url ?? '';
  const startedMs = parseCheckedAtMs(startedLog);

  return {
    id: `incident-${monitorId ?? 'unknown'}-${startedMs}-ongoing`,
    status: 'Ongoing',
    monitor: monitorName,
    monitorId,
    monitorUrl,
    rootCause: deriveRootCause(rootCauseLog),
    comments: 0,
    started: formatIncidentDate(startedLog.checkedAt),
    resolved: '-',
    duration: 'Ongoing',
    visibility: 'Included',
    statusCode: rootCauseLog.statusCode,
  };
};

const buildIncidentRowsFromLogs = (logs: BackendIncident[]): IncidentRow[] => {
  const rows: IncidentRow[] = [];
  const groupedByMonitor = new Map<string, BackendIncident[]>();

  for (const log of logs) {
    const groupKey = log.monitor?._id ?? `unknown-${log._id ?? log.checkedAt}`;
    const group = groupedByMonitor.get(groupKey);
    if (group) {
      group.push(log);
    } else {
      groupedByMonitor.set(groupKey, [log]);
    }
  }

  for (const monitorLogs of groupedByMonitor.values()) {
    monitorLogs.sort((a, b) => parseCheckedAtMs(a) - parseCheckedAtMs(b));

    let openedIncidentStart: BackendIncident | null = null;
    let latestDownLog: BackendIncident | null = null;

    for (const log of monitorLogs) {
      if (log.status === 'down') {
        if (!openedIncidentStart) {
          openedIncidentStart = log;
        }
        latestDownLog = log;
        continue;
      }

      // A true "Resolved" incident exists only when a previous "down" sequence ends with an "up".
      if (openedIncidentStart && latestDownLog) {
        rows.push(buildResolvedIncidentRow(openedIncidentStart, log, latestDownLog));
        openedIncidentStart = null;
        latestDownLog = null;
      }
    }

    if (openedIncidentStart && latestDownLog) {
      rows.push(buildOngoingIncidentRow(openedIncidentStart, latestDownLog));
    }
  }

  rows.sort((a, b) => {
    const dateDelta = parseIncidentDate(b.started) - parseIncidentDate(a.started);
    if (dateDelta !== 0) return dateDelta;
    return getIncidentNumericId(b.id) - getIncidentNumericId(a.id);
  });

  return rows;
};

const escapeCsvValue = (value: string | number): string => {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildIncidentsCsv = (rows: IncidentRow[]): string => {
  const headers = [
    'start date-time',
    'end date-time',
    'reason',
    'duration',
    'duration (seconds)',
    'monitor URL',
    'monitor name',
  ];

  const lines = rows.map((row) =>
    [
      formatCsvDateTime(row.started),
      formatCsvDateTime(row.resolved),
      row.rootCause,
      row.duration === 'Ongoing' ? '' : row.duration,
      row.duration === 'Ongoing' ? '' : durationLabelToSeconds(row.duration),
      row.monitorUrl,
      row.monitor,
    ]
      .map(escapeCsvValue)
      .join(',')
  );

  return [headers.join(','), ...lines].join('\r\n');
};

const requestUrl = 'HEAD http://www.metal2000.fr/';
const requestHeaders = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.8',
  'Cache-Control': 'no-cache',
  Connection: 'close',
  Referer: 'https://yyy.com',
  'User-Agent': 'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
};
const responseBody = '<empty>';
const responseHeaders = {
  'Content-Type': 'text/html; charset=UTF-8',
  'Content-Length': '0',
  Server: 'nginx',
  Date: 'Tue, 25 Mar 2025 09:39:05 GMT',
  Connection: 'close',
};

interface IncidentsPageProps {
  onOpenMonitor?: (monitorId: string) => void;
}

function IncidentsPage({ onOpenMonitor }: IncidentsPageProps) {
  const [incidentRows, setIncidentRows] = useState<IncidentRow[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [isIncidentsLoading, setIsIncidentsLoading] = useState(false);
  const [incidentsLoadError, setIncidentsLoadError] = useState<string | null>(null);
  const [activeFilterIds, setActiveFilterIds] = useState<IncidentFilterId[]>([]);
  const [incidentSortOption, setIncidentSortOption] = useState<IncidentSortOption>('down-first');
  const [selectedTag, setSelectedTag] = useState<IncidentTagOption>('All tags');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestTab, setRequestTab] = useState<RequestTab>('url');
  const [responseTab, setResponseTab] = useState<ResponseTab>('body');
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedIncident = useMemo(
    () => incidentRows.find((incident) => incident.id === selectedIncidentId) ?? null,
    [incidentRows, selectedIncidentId]
  );
  const filteredIncidentRows = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    return incidentRows.filter((incident) => {
      const matchesActiveFilters =
        activeFilterIds.length === 0 ||
        incidentFilterOptions.some((option) => activeFilterIds.includes(option.id) && option.matches(incident));

      const normalizedTag = selectedTag.toLowerCase();
      const matchesTag =
        selectedTag === 'All tags' ||
        incident.monitor.toLowerCase().includes(normalizedTag) ||
        incident.rootCause.toLowerCase().includes(normalizedTag);

      const matchesSearch =
        normalizedSearchQuery.length === 0 ||
        incident.monitor.toLowerCase().includes(normalizedSearchQuery) ||
        incident.monitorUrl.toLowerCase().includes(normalizedSearchQuery) ||
        incident.rootCause.toLowerCase().includes(normalizedSearchQuery);

      return matchesActiveFilters && matchesTag && matchesSearch;
    });
  }, [activeFilterIds, incidentRows, searchQuery, selectedTag]);
  const sortedIncidentRows = useMemo(() => {
    const rows = [...filteredIncidentRows];

    if (incidentSortOption === 'a-z') {
      rows.sort((a, b) => a.monitor.localeCompare(b.monitor));
      return rows;
    }

    if (incidentSortOption === 'newest-first') {
      rows.sort((a, b) => {
        const dateDelta = parseIncidentDate(b.started) - parseIncidentDate(a.started);
        if (dateDelta !== 0) return dateDelta;
        return getIncidentNumericId(b.id) - getIncidentNumericId(a.id);
      });
      return rows;
    }

    if (incidentSortOption === 'up-first') {
      rows.sort((a, b) => {
        const statusDelta = incidentStatusRank[b.status] - incidentStatusRank[a.status];
        if (statusDelta !== 0) return statusDelta;
        return a.monitor.localeCompare(b.monitor);
      });
      return rows;
    }

    if (incidentSortOption === 'paused-first') {
      rows.sort((a, b) => a.monitor.localeCompare(b.monitor));
      return rows;
    }

    rows.sort((a, b) => {
      const statusDelta = incidentStatusRank[a.status] - incidentStatusRank[b.status];
      if (statusDelta !== 0) return statusDelta;
      return a.monitor.localeCompare(b.monitor);
    });
    return rows;
  }, [filteredIncidentRows, incidentSortOption]);
  const requestHeadersText = useMemo(() => JSON.stringify(requestHeaders, null, 2), []);
  const responseHeadersText = useMemo(() => JSON.stringify(responseHeaders, null, 2), []);
  const requestUrlText = selectedIncident?.monitorUrl ? `HEAD ${selectedIncident.monitorUrl}` : requestUrl;
  const requestCopyContent = requestTab === 'url' ? requestUrlText : requestHeadersText;
  const responseBodyText = selectedIncident ? selectedIncident.rootCause : responseBody;
  const responseHeadersForSelectedIncident = useMemo(() => {
    if (!selectedIncident) return responseHeadersText;

    const dynamicResponseHeaders: Record<string, string> = {
      ...responseHeaders,
      'X-Incident-Status': selectedIncident.status,
    };

    if (typeof selectedIncident.statusCode === 'number') {
      dynamicResponseHeaders['Status-Code'] = String(selectedIncident.statusCode);
    }

    return JSON.stringify(dynamicResponseHeaders, null, 2);
  }, [selectedIncident, responseHeadersText]);

  useEffect(() => {
    let cancelled = false;

    const loadIncidents = async () => {
      setIsIncidentsLoading(true);
      setIncidentsLoadError(null);

      try {
        const response = await fetchIncidents(undefined, { limit: 500 });
        if (cancelled) return;

        const rows = buildIncidentRowsFromLogs(response.incidents);
        setIncidentRows(rows);
        setSelectedIncidentId((previousId) =>
          previousId && rows.some((incident) => incident.id === previousId) ? previousId : null
        );
      } catch (error) {
        if (cancelled) return;

        if (isApiError(error)) {
          setIncidentsLoadError(error.message || 'Impossible de charger les incidents.');
        } else if (error instanceof Error && error.message.trim() !== '') {
          setIncidentsLoadError(error.message);
        } else {
          setIncidentsLoadError('Impossible de charger les incidents.');
        }

        setIncidentRows([]);
      } finally {
        if (!cancelled) {
          setIsIncidentsLoading(false);
        }
      }
    };

    void loadIncidents();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRequestTab('url');
    setResponseTab('body');
  }, [selectedIncidentId]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideFilterMenu = filterMenuRef.current?.contains(target) ?? false;
      const insideSortMenu = sortMenuRef.current?.contains(target) ?? false;
      const insideTagMenu = tagMenuRef.current?.contains(target) ?? false;

      if (!insideFilterMenu) {
        setIsFilterMenuOpen(false);
      }
      if (!insideSortMenu) {
        setIsSortMenuOpen(false);
      }
      if (!insideTagMenu) {
        setIsTagMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsFilterMenuOpen(false);
      setIsSortMenuOpen(false);
      setIsTagMenuOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const handleCopyRequest = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(requestCopyContent);
    } catch {
      // Clipboard can fail in restricted browser contexts; fail silently by design.
    }
  };

  const toggleFilterOption = (filterId: IncidentFilterId) => {
    setActiveFilterIds((prev) =>
      prev.includes(filterId) ? prev.filter((id) => id !== filterId) : [...prev, filterId]
    );
  };

  const resetFilters = () => {
    setActiveFilterIds([]);
  };

  const handleExportIncidentsCsv = () => {
    if (sortedIncidentRows.length === 0 || typeof document === 'undefined') return;

    const csvContent = buildIncidentsCsv(sortedIncidentRows);
    const csvBlob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(csvBlob);

    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const filename = `incidents-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  const handleDownloadSelectedIncidentResponse = () => {
    if (!selectedIncident || typeof document === 'undefined') return;

    const responseContent = [
      `Monitor: ${selectedIncident.monitor}`,
      `Status: ${selectedIncident.status}`,
      `Started: ${selectedIncident.started}`,
      `Root cause: ${selectedIncident.rootCause}`,
      '',
      responseBodyText,
    ].join('\n');

    const responseBlob = new Blob([responseContent], { type: 'text/plain;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(responseBlob);

    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const filename = `incident-response-${selectedIncident.id}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  const handleOpenSelectedIncidentMonitor = () => {
    if (!selectedIncident?.monitorId) return;
    onOpenMonitor?.(selectedIncident.monitorId);
  };

  if (selectedIncident) {
    return (
      <section className="incident-detail-view">
        <div className="incident-detail-breadcrumb">
          <button
            className="incident-detail-breadcrumb-link"
            type="button"
            onClick={() => setSelectedIncidentId(null)}
          >
            Incidents
          </button>
          <ChevronRight size={14} />
          <span>{selectedIncident.monitor}</span>
        </div>

        <div className="incident-detail-header">
          <div className="incident-detail-title-wrap">
            <span className="incident-detail-status-badge" aria-hidden="true">
              <span className="incident-detail-status-badge-core" />
            </span>

            <div className="incident-detail-title-copy">
              <h2>
                {selectedIncident.status} incident on {selectedIncident.monitor}
              </h2>
              <p>
                HTTP/S monitor for{' '}
                {selectedIncident.monitorUrl ? (
                  <a href={selectedIncident.monitorUrl} target="_blank" rel="noreferrer">
                    {selectedIncident.monitorUrl}
                  </a>
                ) : (
                  <span>{selectedIncident.monitor}</span>
                )}
              </p>
              <span>Included</span>
            </div>
          </div>

          <div className="incident-detail-actions">
            <button type="button" onClick={handleDownloadSelectedIncidentResponse}>
              <Download size={14} />
              Download response
            </button>
            <button type="button" onClick={handleOpenSelectedIncidentMonitor} disabled={!selectedIncident.monitorId}>
              <Radio size={14} />
              Go to monitor
            </button>
            <button className="incident-detail-more-button" type="button" aria-label="More actions">
              <EllipsisVertical size={15} />
            </button>
          </div>
        </div>

        <div className="incident-detail-content">
          <div className="incident-detail-main">
            <section className="incident-detail-card incident-detail-root-cause-card">
              <p className="incident-detail-label">Root cause</p>
              <h3 className="incident-detail-root-cause">{selectedIncident.rootCause}</h3>
            </section>

            <div className="incident-detail-two-cards">
              <section className="incident-detail-card incident-detail-status-card">
                <p className="incident-detail-label">Status</p>
                <p className="incident-detail-value status">{selectedIncident.status}</p>
                <p className="incident-detail-meta">Started at {selectedIncident.started}</p>
              </section>

              <section className="incident-detail-card">
                <p className="incident-detail-label">Duration</p>
                <p className="incident-detail-value">{selectedIncident.duration}</p>
                <p className="incident-detail-meta">
                  {selectedIncident.resolved === '-'
                    ? 'Not resolved yet'
                    : `Resolved at ${selectedIncident.resolved}`}
                </p>
              </section>
            </div>

            <section className="incident-detail-card incident-detail-activity-card">
              <h3>Activity log</h3>
              <ul className="incident-detail-log">
                <li>
                  <span className="incident-detail-log-icon">
                    <Bell size={18} />
                  </span>
                  Email sent to your email
                </li>
                <li>
                  <span className="incident-detail-log-icon">
                    <Bell size={18} />
                  </span>
                  Discord notification sent to discord integration #1
                </li>
                <li>
                  <span className="incident-detail-log-icon">
                    <Bell size={18} />
                  </span>
                  Incident resolved, confirmed by metal 2000
                </li>
              </ul>
            </section>
          </div>

          <aside className="incident-detail-side">
            <section className="incident-detail-card side">
              <div className="incident-detail-side-header">
                <h3>Request</h3>
                <div className="incident-detail-tabs">
                  <button
                    className={requestTab === 'url' ? 'active' : undefined}
                    type="button"
                    aria-pressed={requestTab === 'url'}
                    onClick={() => setRequestTab('url')}
                  >
                    URL
                  </button>
                  <button
                    className={requestTab === 'headers' ? 'active' : undefined}
                    type="button"
                    aria-pressed={requestTab === 'headers'}
                    onClick={() => setRequestTab('headers')}
                  >
                    Headers
                  </button>
                </div>
              </div>
              {requestTab === 'url' ? (
                <div className="incident-detail-code has-action">
                  <span>{requestUrlText}</span>
                  <button
                    type="button"
                    aria-label="Copy request URL"
                    onClick={() => {
                      void handleCopyRequest();
                    }}
                  >
                    <Copy size={12} />
                  </button>
                </div>
              ) : (
                <div className="incident-detail-code incident-detail-code-json has-action">
                  <pre>
                    <code>{requestHeadersText}</code>
                  </pre>
                  <button
                    type="button"
                    aria-label="Copy request headers"
                    onClick={() => {
                      void handleCopyRequest();
                    }}
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}
            </section>

            <section className="incident-detail-card side">
              <div className="incident-detail-side-header">
                <h3>Response</h3>
                <div className="incident-detail-tabs">
                  <button
                    className={responseTab === 'body' ? 'active' : undefined}
                    type="button"
                    aria-pressed={responseTab === 'body'}
                    onClick={() => setResponseTab('body')}
                  >
                    Body
                  </button>
                  <button
                    className={responseTab === 'headers' ? 'active' : undefined}
                    type="button"
                    aria-pressed={responseTab === 'headers'}
                    onClick={() => setResponseTab('headers')}
                  >
                    Headers
                  </button>
                </div>
              </div>
              {responseTab === 'body' ? (
                <>
                  <div className="incident-detail-code">{responseBodyText}</div>
                  <p className="incident-detail-note">
                    HTML tags are stripped in preview. Download full response{' '}
                    <button type="button" className="incident-detail-note-link" onClick={handleDownloadSelectedIncidentResponse}>
                      here
                    </button>
                    .
                  </p>
                </>
              ) : (
                <div className="incident-detail-code incident-detail-code-json">
                  <pre>
                    <code>{responseHeadersForSelectedIncident}</code>
                  </pre>
                </div>
              )}
            </section>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <>
      <header className="incidents-header-row">
        <h1>Incidents</h1>
        <div className="incidents-toolbar">
          <label className="incidents-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or url"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <div className="incidents-filter-tags-wrap" ref={tagMenuRef}>
            <button
              className={`incidents-filter-button incidents-filter-tags ${isTagMenuOpen || selectedTag !== 'All tags' ? 'active' : ''}`}
              type="button"
              onClick={() => setIsTagMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isTagMenuOpen}
            >
              <span className="incidents-filter-content">
                <Tag size={14} />
                {selectedTag}
              </span>
              <ChevronDown size={14} />
            </button>

            {isTagMenuOpen && (
              <div className="incidents-tag-menu" role="menu">
                {incidentTagOptions.map((tagOption) => (
                  <button
                    key={tagOption}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedTag === tagOption}
                    className={selectedTag === tagOption ? 'selected' : ''}
                    onClick={() => {
                      setSelectedTag(tagOption);
                      setIsTagMenuOpen(false);
                    }}
                  >
                    <span>{tagOption}</span>
                    {selectedTag === tagOption ? <Check size={15} aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="incidents-filter-order-wrap" ref={sortMenuRef}>
            <button
              className={`incidents-filter-button incidents-filter-order ${isSortMenuOpen ? 'active' : ''}`}
              type="button"
              onClick={() => setIsSortMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isSortMenuOpen}
            >
              <span className="incidents-filter-content">
                <ArrowUpDown size={14} />
                {incidentSortOptionLabels[incidentSortOption]}
              </span>
              <ChevronDown size={14} />
            </button>

            {isSortMenuOpen && (
              <div className="incidents-sort-menu" role="menu">
                {incidentSortOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    aria-checked={incidentSortOption === option}
                    className={incidentSortOption === option ? 'selected' : ''}
                    onClick={() => {
                      setIncidentSortOption(option);
                      setIsSortMenuOpen(false);
                    }}
                  >
                    <span>{incidentSortOptionLabels[option]}</span>
                    {incidentSortOption === option ? <Check size={15} aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="incidents-filter-panel-wrap" ref={filterMenuRef}>
            <button
              className={`incidents-filter-button incidents-filter-panel ${isFilterMenuOpen || activeFilterIds.length > 0 ? 'active' : ''}`}
              type="button"
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isFilterMenuOpen}
            >
              <SlidersHorizontal size={14} />
              Filter
            </button>

            {isFilterMenuOpen && (
              <div className="incidents-filter-menu" role="menu">
                <div className="incidents-filter-options">
                  {incidentFilterOptions.map((option) => (
                    <label key={option.id} className="incidents-filter-option">
                      <input
                        type="checkbox"
                        checked={activeFilterIds.includes(option.id)}
                        onChange={() => toggleFilterOption(option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>

                <button type="button" className="incidents-filter-reset-button" onClick={resetFilters}>
                  <RotateCcw size={14} />
                  Reset
                </button>
              </div>
            )}
          </div>

          <button
            className="incidents-icon-button"
            type="button"
            aria-label="Export incidents"
            onClick={handleExportIncidentsCsv}
            disabled={isIncidentsLoading || sortedIncidentRows.length === 0}
          >
            <Download size={14} />
          </button>
        </div>
      </header>

      <div className="incidents-table-card">
        <table className="incidents-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Monitor</th>
              <th>Roots cause</th>
              <th>Comments</th>
              <th>Started</th>
              <th>Resolved</th>
              <th>Duration</th>
              <th>Visibility</th>
            </tr>
          </thead>
          <tbody>
            {isIncidentsLoading ? (
              <tr>
                <td colSpan={8} className="incidents-empty-row">
                  Loading incidents...
                </td>
              </tr>
            ) : incidentsLoadError ? (
              <tr>
                <td colSpan={8} className="incidents-empty-row">
                  {incidentsLoadError}
                </td>
              </tr>
            ) : sortedIncidentRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="incidents-empty-row">
                  No incidents found.
                </td>
              </tr>
            ) : (
              sortedIncidentRows.map((incident) => (
                <tr
                  key={incident.id}
                  className="incidents-row-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedIncidentId(incident.id);
                    }
                  }}
                >
                  <td>
                    <span className={`incidents-status ${incident.status === 'Ongoing' ? 'ongoing' : ''}`}>
                      <span className="incidents-status-icon" aria-hidden="true">
                        {incident.status === 'Resolved' ? <Check size={9} /> : <Radio size={9} />}
                      </span>
                      {incident.status}
                    </span>
                  </td>
                  <td>{incident.monitor}</td>
                  <td>{incident.rootCause}</td>
                  <td>{incident.comments}</td>
                  <td>{incident.started}</td>
                  <td>{incident.resolved}</td>
                  <td>{incident.duration}</td>
                  <td>{incident.visibility}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default IncidentsPage;
