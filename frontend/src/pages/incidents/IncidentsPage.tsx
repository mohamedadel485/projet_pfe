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
  Upload,
} from 'lucide-react';
import './incidents-page.css';

interface IncidentRow {
  id: string;
  status: 'Resolved' | 'Ongoing';
  monitor: string;
  rootCause: string;
  comments: number;
  started: string;
  resolved: string;
  duration: string;
  visibility: string;
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

const incidentRows: IncidentRow[] = Array.from({ length: 13 }, (_, index) => ({
  id: `incident-${index + 1}`,
  status: 'Resolved',
  monitor: 'Metal 2000 website',
  rootCause: 'Internal server error',
  comments: 0,
  started: 'Mar 28, 2025, 10:50AM',
  resolved: 'Mar 28, 2025, 10:50AM',
  duration: '0h 23m 12s',
  visibility: 'Included',
}));

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

function IncidentsPage() {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [activeFilterIds, setActiveFilterIds] = useState<IncidentFilterId[]>([]);
  const [incidentSortOption, setIncidentSortOption] = useState<IncidentSortOption>('down-first');
  const [selectedTag, setSelectedTag] = useState<IncidentTagOption>('All tags');
  const [requestTab, setRequestTab] = useState<RequestTab>('url');
  const [responseTab, setResponseTab] = useState<ResponseTab>('body');
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedIncident = useMemo(
    () => incidentRows.find((incident) => incident.id === selectedIncidentId) ?? null,
    [selectedIncidentId]
  );
  const filteredIncidentRows = useMemo(() => {
    if (activeFilterIds.length === 0) return incidentRows;
    return incidentRows.filter((incident) =>
      incidentFilterOptions.some((option) => activeFilterIds.includes(option.id) && option.matches(incident))
    );
  }, [activeFilterIds]);
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
  const requestCopyContent = requestTab === 'url' ? requestUrl : requestHeadersText;

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
              <h2>Resolved incident on metal 2000 website</h2>
              <p>
                HTTP/S monitor for{' '}
                <a href="https://www.metal2000.fr/" target="_blank" rel="noreferrer">
                  https://www.metal2000.fr/
                </a>
              </p>
              <span>Included</span>
            </div>
          </div>

          <div className="incident-detail-actions">
            <button type="button">
              <Download size={14} />
              Download response
            </button>
            <button type="button">
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
              <h3 className="incident-detail-root-cause">500 Internal server error</h3>
            </section>

            <div className="incident-detail-two-cards">
              <section className="incident-detail-card incident-detail-status-card">
                <p className="incident-detail-label">Status</p>
                <p className="incident-detail-value status">Resolved</p>
                <p className="incident-detail-meta">Started at Mar 25, 2025, 09:34AM</p>
              </section>

              <section className="incident-detail-card">
                <p className="incident-detail-label">Duration</p>
                <p className="incident-detail-value">0h 5m 5s</p>
                <p className="incident-detail-meta">Resolved at Mar 25, 2025, 09:39AM</p>
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
                  <span>{requestUrl}</span>
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
                  <div className="incident-detail-code">{responseBody}</div>
                  <p className="incident-detail-note">
                    HTML tags are stripped in preview. Download full response <a href="#">here</a>.
                  </p>
                </>
              ) : (
                <div className="incident-detail-code incident-detail-code-json">
                  <pre>
                    <code>{responseHeadersText}</code>
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
            <input type="text" placeholder="Search by name or url" />
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
          >
            <Upload size={14} />
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
            {sortedIncidentRows.map((incident) => (
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
                  <span className="incidents-status">
                    <span className="incidents-status-icon" aria-hidden="true">
                      <Check size={9} />
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
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default IncidentsPage;
