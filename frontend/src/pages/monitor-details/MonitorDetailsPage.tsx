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
import './MonitorDetailsPage.css';

interface MonitorDetails {
  id: string;
  name: string;
  protocol: string;
  url?: string;
  uptimeLabel: string;
  interval: string;
  uptime: string;
  state: 'up' | 'down';
}

interface MonitorDetailsPageProps {
  monitor: MonitorDetails;
  onBack: () => void;
  onEdit: () => void;
}

const last24HistoryBars = Array.from({ length: 32 }, (_, index) => (index === 24 ? 'warning' : 'up'));

const latestIncidents = [
  {
    id: 'incident-1',
    status: 'Resolved',
    rootCause: 'Internal server error',
    started: 'Mar 25, 2025, 09:34AM GMT+1',
    duration: '0h 5m 5s',
  },
  {
    id: 'incident-2',
    status: 'Resolved',
    rootCause: 'Internal server error',
    started: 'Mar 25, 2025, 09:34AM GMT+1',
    duration: '0h 5m 5s',
  },
  {
    id: 'incident-3',
    status: 'Resolved',
    rootCause: 'Internal server error',
    started: 'Mar 25, 2025, 09:34AM GMT+1',
    duration: '0h 5m 5s',
  },
  {
    id: 'incident-4',
    status: 'Resolved',
    rootCause: 'Internal server error',
    started: 'Mar 25, 2025, 09:34AM GMT+1',
    duration: '0h 5m 5s',
  },
];

function MonitorDetailsPage({ monitor, onBack, onEdit }: MonitorDetailsPageProps) {
  const linkLabel = monitor.url ?? 'No website configured';

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
          <button type="button" className="monitor-action-button">
            <Bell size={13} />
            Test Notification
          </button>
          <button type="button" className="monitor-action-button">
            <span className="material-symbols-outlined monitor-pause-icon" aria-hidden="true">
              pause_circle
            </span>
            Pause
          </button>
          <button type="button" className="monitor-action-button" onClick={onEdit}>
            <span className="material-symbols-outlined monitor-edit-icon" aria-hidden="true">
              settings
            </span>
            Edit
          </button>
          <button type="button" className="monitor-details-more-button" aria-label="More options">
            <MoreVertical size={13} />
          </button>
        </div>
      </header>

      <div className="monitor-details-content-grid">
        <div className="monitor-details-main-column">
          <div className="monitor-details-stats-grid">
            <article>
              <h3>Current status</h3>
              <p className={monitor.state === 'up' ? 'status-up' : 'status-down'}>
                {monitor.state === 'up' ? 'Up' : 'Down'}
              </p>
              <span>Currently {monitor.uptimeLabel.toLowerCase()}</span>
            </article>
            <article>
              <h3>Last check</h3>
              <p>Coming soon</p>
              <span>Checked every {monitor.interval}</span>
            </article>
            <article className="monitor-last24-card">
              <div className="stat-row-head">
                <h3>Last 24 hours</h3>
                <strong>99.295%</strong>
              </div>
              <div className="mini-history" aria-hidden="true">
                {last24HistoryBars.map((state, index) => (
                  <span key={`last24-${monitor.id}-${index}`} className={`mini-history-bar ${state}`} />
                ))}
              </div>
              <span>2 incidents, 10m, 9s down</span>
            </article>
          </div>

          <section className="monitor-details-ranges-card">
            <article className="range-cell">
              <h3>Last 7 days</h3>
              <p>99.396%</p>
              <span>9 incidents, 1h, 50s down</span>
            </article>
            <article className="range-cell">
              <h3>Last 30 days</h3>
              <p>99.150%</p>
              <span>50 incidents, 8h, 50s down</span>
            </article>
            <article className="range-cell">
              <h3>Last 365 days</h3>
              <p>{monitor.uptime}</p>
              <a href={monitor.url ?? '#'} target="_blank" rel="noreferrer" className="range-inline-link">
                Unlock with paid plans
              </a>
            </article>
            <article className="range-cell">
              <button type="button" className="range-picker-button">
                <CalendarClock size={12} />
                <span>Pick a date range</span>
                <ChevronDown size={13} />
              </button>
              <p>- - -%</p>
              <span>- incidents, - down</span>
            </article>
          </section>

          <section className="monitor-details-response">
            <div className="response-header">
              <h3>Response time</h3>
              <button type="button">
                Last 24 hours
                <ChevronDown size={13} />
              </button>
            </div>
            <div className="response-chart-layout">
              <div className="response-y-axis" aria-hidden="true">
                <span>20000 ms</span>
                <span>10000 ms</span>
                <span>0 ms</span>
              </div>
              <div className="response-chart-wrap">
                <div className="response-chart" aria-hidden="true">
                  <svg viewBox="0 0 620 120" preserveAspectRatio="none">
                    <polyline
                      points="0,98 45,98 85,85 120,85 155,108 190,108 230,85 265,85 305,72 350,72 390,45 430,45 470,72 510,72 545,85 620,85"
                      fill="none"
                      stroke="#08a7f3"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="response-x-axis" aria-hidden="true">
                  <span>Mar 24, 2025</span>
                  <span>Mar 24, 2025</span>
                  <span>Mar 25, 2025</span>
                </div>
              </div>
            </div>
            <div className="response-metrics">
              <article className="metric-average">
                <div className="metric-value">
                  <Minus size={14} />
                  <strong>1679 ms</strong>
                </div>
                <span>Average</span>
              </article>
              <article className="metric-min">
                <div className="metric-value">
                  <ArrowDownLeft size={14} />
                  <strong>1679 ms</strong>
                </div>
                <span>Minimum</span>
              </article>
              <article className="metric-max">
                <div className="metric-value">
                  <ArrowUpLeft size={14} />
                  <strong>9150 ms</strong>
                </div>
                <span>Maximum</span>
              </article>
            </div>
          </section>

          <section className="monitor-details-incidents">
            <div className="incidents-header">
              <h3>Latest incidents</h3>
              <button type="button">
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
              {latestIncidents.map((incident) => (
                <div className="incidents-row" key={incident.id}>
                  <span className="resolved-pill">
                    <span className="resolved-dot" aria-hidden="true" />
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
            <p>Domain valid until: 25/12/2025</p>
            <p>SSL certificate valid until: 25/12/2025</p>
          </article>
          <article className="monitor-side-card">
            <div className="monitor-side-card-head">
              <h3>Next maintenance</h3>
              <span className="material-symbols-outlined side-card-settings-icon" aria-hidden="true">
                settings
              </span>
            </div>
            <p>No maintenance planned</p>
            <button type="button">
              Set up maintenance
            </button>
          </article>
          <article className="monitor-side-card">
            <div className="monitor-side-card-head">
              <h3>To be notified</h3>
              <span className="material-symbols-outlined side-card-settings-icon" aria-hidden="true">
                settings
              </span>
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
