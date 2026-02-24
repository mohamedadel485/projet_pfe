import { useEffect, useMemo, useState } from 'react';
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
  Search,
  SlidersHorizontal,
  Tag,
  Upload,
} from 'lucide-react';
import './incidents-page.css';

interface IncidentRow {
  id: string;
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

const incidentRows: IncidentRow[] = Array.from({ length: 13 }, (_, index) => ({
  id: `incident-${index + 1}`,
  monitor: 'Metal 2000 website',
  rootCause: 'Internal server error',
  comments: 0,
  started: 'Mar 28, 2025, 10:50AM',
  resolved: 'Mar 28, 2025, 10:50AM',
  duration: '0h 23m 12s',
  visibility: 'Included',
}));

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
  const [requestTab, setRequestTab] = useState<RequestTab>('url');
  const [responseTab, setResponseTab] = useState<ResponseTab>('body');

  const selectedIncident = useMemo(
    () => incidentRows.find((incident) => incident.id === selectedIncidentId) ?? null,
    [selectedIncidentId]
  );
  const requestHeadersText = useMemo(() => JSON.stringify(requestHeaders, null, 2), []);
  const responseHeadersText = useMemo(() => JSON.stringify(responseHeaders, null, 2), []);
  const requestCopyContent = requestTab === 'url' ? requestUrl : requestHeadersText;

  useEffect(() => {
    setRequestTab('url');
    setResponseTab('body');
  }, [selectedIncidentId]);

  const handleCopyRequest = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(requestCopyContent);
    } catch {
      // Clipboard can fail in restricted browser contexts; fail silently by design.
    }
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

          <button className="incidents-filter-button incidents-filter-tags" type="button">
            <span className="incidents-filter-content">
              <Tag size={14} />
              All tags
            </span>
            <ChevronDown size={14} />
          </button>

          <button className="incidents-filter-button incidents-filter-order" type="button">
            <span className="incidents-filter-content">
              <ArrowUpDown size={14} />
              Down first
            </span>
            <ChevronDown size={14} />
          </button>

          <button className="incidents-filter-button incidents-filter-panel" type="button">
            <SlidersHorizontal size={14} />
            Filter
          </button>

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
            {incidentRows.map((incident) => (
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
                    Resolved
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
