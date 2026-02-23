import { useEffect, useMemo, useRef, useState } from 'react';
import { CiSliderHorizontal } from 'react-icons/ci';
import type { LucideIcon } from 'lucide-react';
import ExclamationHexagonIcon from './ExclamationHexagonIcon';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,

  Clock3,
  LogOut,
  Menu,
  Plus,
  Search,
  Tag,
  Users,
  Wrench,
  X,
} from 'lucide-react';

type HistoryState = 'up' | 'warning' | 'down';

interface MenuItem {
  label: string;
  icon?: LucideIcon;
  materialIcon?: string;
  customIcon?: 'incidentHexagon' | 'monitoringRadar';
}

interface MonitorRow {
  id: string;
  name: string;
  protocol: string;
  uptimeLabel: string;
  interval: string;
  uptime: string;
  state: 'up' | 'down';
  history: HistoryState[];
}

const menuItems: MenuItem[] = [
  { label: 'Monitoring', customIcon: 'monitoringRadar' },
  { label: 'Incidents', customIcon: 'incidentHexagon' },
  { label: 'Status pages', materialIcon: 'sensors' },
  { label: 'Maintenance', icon: Wrench },
  { label: 'Team members', icon: Users },
  { label: 'Integrations & API', materialIcon: 'graph_1' },
];

const buildHistory = (pattern: string): HistoryState[] =>
  pattern.split('').map((value) => {
    if (value === 'w') return 'warning';
    if (value === 'd') return 'down';
    return 'up';
  });

const monitorRows: MonitorRow[] = [
  {
    id: 'hbhs',
    name: 'HBHS',
    protocol: 'HTTP',
    uptimeLabel: 'Up 2 hr, 26 min',
    interval: '5 min',
    uptime: '100%',
    state: 'up',
    history: buildHistory('uuuuuuuuuuuuuuuuuuuuuuuuuuuu'),
  },
  {
    id: 'metal',
    name: 'Metal 2000 Website',
    protocol: 'HTTP',
    uptimeLabel: 'Up 2 hr, 26 min',
    interval: '5 min',
    uptime: '99.205%',
    state: 'up',
    history: buildHistory('uuuuuuuuuuuwuuuuuuuuuuuuuuuu'),
  },
  {
    id: 'odf-api',
    name: 'ODF API',
    protocol: 'HTTP',
    uptimeLabel: 'Up 2 hr, 26 min',
    interval: '5 min',
    uptime: '100%',
    state: 'up',
    history: buildHistory('uuuuuuuuuuuuuuuuuuuuuuuuuuuu'),
  },
  {
    id: 'odf-interface',
    name: 'ODF Interface',
    protocol: 'HTTP',
    uptimeLabel: 'Up 2 hr, 26 min',
    interval: '5 min',
    uptime: '100%',
    state: 'up',
    history: buildHistory('uuuuuuuuuuuuuuuuuuuuuuuuuuuu'),
  },
];

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [downFirst, setDownFirst] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMenuLabel, setActiveMenuLabel] = useState(menuItems[0].label);
  const [sidebarTogglePending, setSidebarTogglePending] = useState(false);
  const sidebarToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStatus = useMemo(() => {
    const down = monitorRows.filter((monitor) => monitor.state === 'down').length;
    const up = monitorRows.length - down;

    return {
      total: monitorRows.length,
      up,
      down,
      paused: 0,
    };
  }, []);

  const displayedMonitors = useMemo(() => {
    if (!downFirst) return monitorRows;
    return [...monitorRows].sort((a, b) => {
      if (a.state === b.state) return 0;
      return a.state === 'down' ? -1 : 1;
    });
  }, [downFirst]);

  useEffect(() => {
    return () => {
      if (sidebarToggleTimerRef.current !== null) {
        clearTimeout(sidebarToggleTimerRef.current);
      }
    };
  }, []);

  const handleSidebarToggleClick = () => {
    if (sidebarTogglePending) return;
    setSidebarTogglePending(true);
    sidebarToggleTimerRef.current = setTimeout(() => {
      setSidebarCollapsed((prev) => !prev);
      setSidebarTogglePending(false);
      sidebarToggleTimerRef.current = null;
    }, 300);
  };

  return (
    <div className={`app-shell ${mobileMenuOpen ? 'menu-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="mobile-toggle" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
        <Menu size={18} />
      </button>

      {/* --- Sidebar --- */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-head">
          <button
            className={`sidebar-collapse-toggle ${sidebarTogglePending ? 'pending' : ''}`}
            type="button"
            onClick={handleSidebarToggleClick}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            disabled={sidebarTogglePending}
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <div className="brand-copy">
            <h2>{sidebarCollapsed ? 'M' : 'Monitoring'}</h2>
          </div>
          <button className="mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const isActive = item.label === activeMenuLabel;
            return (
              <button
                key={item.label}
                className={`menu-link ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenuLabel(item.label);
                  if (item.label === 'Monitoring') {
                    setSidebarCollapsed((prev) => !prev);
                  }
                  setMobileMenuOpen(false);
                }}
              >
                <span className="menu-icon-slot" aria-hidden="true">
                  {item.customIcon === 'monitoringRadar' ? (
                    <span className="material-symbols-outlined menu-monitoring-radar">radar</span>
                  ) : item.customIcon === 'incidentHexagon' ? (
                    <ExclamationHexagonIcon size={16} className="menu-custom-icon" />
                  ) : item.materialIcon ? (
                    <span className="material-symbols-outlined menu-material-icon">{item.materialIcon}</span>
                  ) : (
                    item.icon && <item.icon size={15} />
                  )}
                </span>
                <span className="menu-text">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-avatar">NB</div>
          <div className="profile-copy">
            <strong>admin</strong>
          </div>
          <button className="logout-button" aria-label="Settings">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <div className={`sidebar-overlay ${mobileMenuOpen ? 'show' : ''}`} onClick={() => setMobileMenuOpen(false)} />

      {/* --- Header (spans center + right columns) --- */}


      {/* --- Main Panel (center column) --- */}
      <div className="panel-main">
        <header className="workspace-top">
          <h1>Monitors</h1>
          <button className="primary-button">
            <Plus size={14} />
            <span>New monitor</span>
            <span className="primary-button-chevron" aria-hidden="true">
              <ChevronDown size={14} />
            </span>
          </button>
        </header>
        <div className="filter-bar">
          <div className="chip-row">
            <span className="chip-button chip-counter">
              <span className="counter-dot" aria-hidden="true" />
              0/4
            </span>
            <button className="chip-button">
              Bulk actions
              <ChevronDown size={16} />
            </button>
            <button className="chip-button">
              <Tag size={20} />
              All tags
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="search-row">
            <label className="search-box">
              <Search size={20} />
              <input type="text" placeholder="Search by name or url" />
            </label>
            <button
              className={`chip-button ${downFirst ? 'active' : ''}`}
              type="button"
              onClick={() => setDownFirst((prev) => !prev)}
            >
              <ArrowUpDown size={20} />
              Down first
              <ChevronDown size={16} />
            </button>
            <button className="chip-button">
              <CiSliderHorizontal size={20} />
              Filter
            </button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-head">
            <span>Actions</span>
            <div className="action-row">
              <button>
                <span className="material-symbols-outlined action-material-icon" aria-hidden="true">
                  play_circle
                </span>
                Start
              </button>
              <button>
                <span className="material-symbols-outlined action-material-icon" aria-hidden="true">
                  pause_circle
                </span>
                Pause
              </button>
              <button>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1f4b8f"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="action-delete-icon"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M9 11h6" />
                  <path d="M9 15h6" />
                </svg>
                Delete
              </button>
              <button>
                <span className="material-symbols-outlined action-material-icon" aria-hidden="true">
                  circle_circle
                </span>
                Resume
              </button>
            </div>
          </div>

          <div className="monitor-table">
            {displayedMonitors.map((monitor) => (
              <article className="monitor-row" key={monitor.id}>
                <div className="monitor-main">
                  <span className="monitor-checkbox" />
                  <span className={`state-dot ${monitor.state}`} />
                  <span className="monitor-node" aria-hidden="true" />
                  <div className="monitor-copy">
                    <strong>{monitor.name}</strong>
                    <div className="monitor-meta">
                      <span className="protocol">{monitor.protocol}</span>
                      <span>{monitor.uptimeLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="monitor-interval">
                  <Clock3 size={12} />
                  {monitor.interval}
                </div>

                <div className="history-bars">
                  {monitor.history.map((barState, index) => (
                    <span key={`${monitor.id}-${index}`} className={`history-bar ${barState}`} />
                  ))}
                </div>

                <div className="monitor-uptime">{monitor.uptime}</div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* --- Status Panel (right column) --- */}
      <aside className="status-panel">
        <section className="status-card">
          <h3>Current status</h3>
          <div className="status-ring-wrap">
            <div className="status-ring">
              <span className="status-ring-icon status-ring-triangle" aria-hidden="true" />
            </div>
          </div>
          <div className="status-grid">
            <article>
              <strong>{currentStatus.down}</strong>
              <span>Down</span>
            </article>
            <article>
              <strong>{currentStatus.up}</strong>
              <span>Up</span>
            </article>
            <article>
              <strong>{currentStatus.paused}</strong>
              <span>Paused</span>
            </article>
          </div>
          <p className="status-hint">Using 4 of 50 monitors</p>
        </section>

        <section className="status-card">
          <h3>Last 24 hours</h3>
          <div className="hours-row">
            <div className="hours-col">
              <p className="hours-uptime">99.824%</p>
              <span className="hours-label">Overall uptime</span>
            </div>
            <div className="hours-col">
              <p className="hours-value">2</p>
              <span className="hours-label">Incidents</span>
            </div>
          </div>
          <div className="hours-row">
            <div className="hours-col">
              <p className="hours-meta">23h, 49m</p>
              <span className="hours-label">Without incid.</span>
            </div>
            <div className="hours-col">
              <p className="hours-value">1</p>
              <span className="hours-label">Affected mon.</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default App;

