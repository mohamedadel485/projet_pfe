import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CiSliderHorizontal } from 'react-icons/ci';
import type { LucideIcon } from 'lucide-react';
import ExclamationHexagonIcon from './ExclamationHexagonIcon';
import EditMonitorPage from './pages/edit-monitor/EditMonitorPage';
import IncidentsPage from './pages/incidents/IncidentsPage';
import IntegrationsApiPage from './pages/integrations-api/IntegrationsApiPage';
import MonitorDetailsPage from './pages/monitor-details/MonitorDetailsPage';
import NewMonitorPage from './pages/new-monitor/NewMonitorPage';
import StatusPageInfoPage from './pages/status/StatusPageInfoPage';
import StatusPagesPage from './pages/status/StatusPagesPage';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogOut,
  Menu,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';

type HistoryState = 'up' | 'warning' | 'down';
type MenuLabel = 'Monitoring' | 'Incidents' | 'Status pages' | 'Maintenance' | 'Team members' | 'Integrations & API';

interface MenuItem {
  label: MenuLabel;
  icon?: LucideIcon;
  materialIcon?: string;
  customIcon?: 'incidentHexagon' | 'monitoringRadar';
}

interface MonitorRow {
  id: string;
  name: string;
  protocol: string;
  url?: string;
  uptimeLabel: string;
  interval: string;
  uptime: string;
  state: 'up' | 'down';
  history: HistoryState[];
  detailsEnabled?: boolean;
}

type IntegrationsSubPage = 'api' | 'team';

const menuItems: MenuItem[] = [
  { label: 'Monitoring', customIcon: 'monitoringRadar' },
  { label: 'Incidents', customIcon: 'incidentHexagon' },
  { label: 'Status pages', materialIcon: 'sensors' },
  { label: 'Maintenance', icon: Wrench },
  { label: 'Team members', icon: Users },
  { label: 'Integrations & API', materialIcon: 'graph_1' },
];

const routeByMenuLabel: Record<MenuLabel, string> = {
  Monitoring: '/monitoring',
  Incidents: '/incidents',
  'Status pages': '/status-pages',
  Maintenance: '/maintenance',
  'Team members': '/team-members',
  'Integrations & API': '/integrations-api',
};

const normalizePathname = (pathname: string): string => {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

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
    url: 'https://www.metal2000.fr/',
    uptimeLabel: 'Up 2 hr, 26 min',
    interval: '5 min',
    uptime: '100%',
    state: 'up',
    history: buildHistory('uuuuuuuuuuuuuuuuuuuuuuuuuuuu'),
    detailsEnabled: true,
  },
  {
    id: 'metal',
    name: 'Metal 2000 Website',
    protocol: 'HTTP',
    url: 'https://www.metal2000.fr/',
    uptimeLabel: 'Up 2 hr, 26 min',
    interval: '5 min',
    uptime: '99.205%',
    state: 'up',
    history: buildHistory('uuuuuuuuuuuwuuuuuuuuuuuuuuuu'),
    detailsEnabled: true,
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
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);
  const [selectedStatusPageId, setSelectedStatusPageId] = useState<string | null>(null);
  const [isCreatingMonitor, setIsCreatingMonitor] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMenuLabel, setActiveMenuLabel] = useState(menuItems[0].label);
  const [integrationsSubPage, setIntegrationsSubPage] = useState<IntegrationsSubPage>('api');
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

  const selectedMonitor = useMemo(
    () => monitorRows.find((monitor) => monitor.id === selectedMonitorId) ?? null,
    [selectedMonitorId],
  );
  const editingMonitor = useMemo(
    () => monitorRows.find((monitor) => monitor.id === editingMonitorId) ?? null,
    [editingMonitorId],
  );
  const defaultTeamMonitor = useMemo(() => monitorRows.find((monitor) => monitor.id === 'metal') ?? null, []);
  const teamMonitor = editingMonitor ?? defaultTeamMonitor;
  const isIntegrationsPage = activeMenuLabel === 'Integrations & API';
  const isIncidentsPage = activeMenuLabel === 'Incidents';
  const isStatusPagesPage = activeMenuLabel === 'Status pages';
  const appShellClasses = [
    'app-shell',
    isIncidentsPage ? 'incidents-view' : '',
    isStatusPagesPage ? 'status-pages-view' : '',
    mobileMenuOpen ? 'menu-open' : '',
    sidebarCollapsed ? 'sidebar-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const applyRoute = useCallback((rawPathname: string) => {
    const pathname = normalizePathname(rawPathname);
    const segments = pathname.split('/').filter(Boolean);
    const hasMonitorId = (id: string) => monitorRows.some((monitor) => monitor.id === id);

    let nextMenuLabel: MenuLabel = 'Monitoring';
    let nextIntegrationsSubPage: IntegrationsSubPage = 'api';
    let nextSelectedMonitorId: string | null = null;
    let nextEditingMonitorId: string | null = null;
    let nextSelectedStatusPageId: string | null = null;
    let nextIsCreatingMonitor = false;

    if (pathname === '/' || pathname === '/monitoring') {
      nextMenuLabel = 'Monitoring';
    } else if (pathname === '/monitoring/new') {
      nextMenuLabel = 'Monitoring';
      nextIsCreatingMonitor = true;
    } else if (segments.length === 3 && segments[0] === 'monitoring' && segments[2] === 'edit' && hasMonitorId(segments[1])) {
      nextMenuLabel = 'Monitoring';
      nextEditingMonitorId = segments[1];
    } else if (segments.length === 3 && segments[0] === 'monitoring' && segments[2] === 'integrations-team' && hasMonitorId(segments[1])) {
      nextMenuLabel = 'Monitoring';
      nextIntegrationsSubPage = 'team';
      nextEditingMonitorId = segments[1];
    } else if (segments.length === 2 && segments[0] === 'monitoring' && hasMonitorId(segments[1])) {
      nextMenuLabel = 'Monitoring';
      nextSelectedMonitorId = segments[1];
    } else if (pathname === '/integrations-api') {
      nextMenuLabel = 'Integrations & API';
      nextIntegrationsSubPage = 'api';
    } else if (pathname === '/integrations-team') {
      nextMenuLabel = 'Monitoring';
      nextIntegrationsSubPage = 'team';
    } else if (pathname === '/incidents') {
      nextMenuLabel = 'Incidents';
    } else if (segments.length === 2 && segments[0] === 'status-pages') {
      nextMenuLabel = 'Status pages';
      nextSelectedStatusPageId = segments[1];
    } else if (pathname === '/status-pages') {
      nextMenuLabel = 'Status pages';
    } else if (pathname === '/maintenance') {
      nextMenuLabel = 'Maintenance';
    } else if (pathname === '/team-members') {
      nextMenuLabel = 'Team members';
    }

    setActiveMenuLabel(nextMenuLabel);
    setIntegrationsSubPage(nextIntegrationsSubPage);
    setSelectedMonitorId(nextSelectedMonitorId);
    setEditingMonitorId(nextEditingMonitorId);
    setSelectedStatusPageId(nextSelectedStatusPageId);
    setIsCreatingMonitor(nextIsCreatingMonitor);
  }, []);

  const navigateTo = useCallback(
    (pathname: string, options?: { replace?: boolean }) => {
      const normalizedPathname = normalizePathname(pathname);
      const currentPathname = normalizePathname(window.location.pathname);

      if (normalizedPathname !== currentPathname) {
        if (options?.replace) {
          window.history.replaceState({}, '', normalizedPathname);
        } else {
          window.history.pushState({}, '', normalizedPathname);
        }
      }

      applyRoute(normalizedPathname);
    },
    [applyRoute],
  );

  useEffect(() => {
    return () => {
      if (sidebarToggleTimerRef.current !== null) {
        clearTimeout(sidebarToggleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const pathname = normalizePathname(window.location.pathname);

    if (pathname === '/') {
      navigateTo('/monitoring', { replace: true });
    } else {
      applyRoute(pathname);
    }

    const handlePopState = () => {
      applyRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyRoute, navigateTo]);

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
    <div className={appShellClasses}>
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
                  navigateTo(routeByMenuLabel[item.label]);
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

      {integrationsSubPage === 'team' && teamMonitor ? (
        <EditMonitorPage
          monitor={teamMonitor}
          initialSection="integrations"
          onBack={() => {
            navigateTo('/monitoring');
          }}
          onOpenMonitorDetails={() => {
            navigateTo('/monitoring/new');
          }}
          onOpenIntegrationsTeam={() => {
            navigateTo(`/monitoring/${teamMonitor.id}/integrations-team`);
          }}
        />
      ) : isIntegrationsPage ? (
        <IntegrationsApiPage
          onOpenIntegrationsTeam={() => {
            navigateTo('/integrations-team');
          }}
        />
      ) : editingMonitor ? (
        <EditMonitorPage
          monitor={editingMonitor}
          initialSection="details"
          onBack={() => {
            navigateTo(`/monitoring/${editingMonitor.id}`);
          }}
          onOpenMonitorDetails={() => {
            navigateTo(`/monitoring/${editingMonitor.id}`);
          }}
          onOpenIntegrationsTeam={() => {
            navigateTo(`/monitoring/${editingMonitor.id}/integrations-team`);
          }}
        />
      ) : selectedMonitor ? (
        <MonitorDetailsPage
          monitor={selectedMonitor}
          onBack={() => {
            navigateTo('/monitoring');
          }}
          onEdit={() => {
            navigateTo(`/monitoring/${selectedMonitor.id}/edit`);
          }}
        />
      ) : isCreatingMonitor ? (
        <NewMonitorPage
          onBack={() => {
            navigateTo('/monitoring');
          }}
          onOpenIntegrationsTeam={() => {
            navigateTo('/integrations-team');
          }}
        />
      ) : isIncidentsPage ? (
        <div className="panel-main">
          <IncidentsPage />
        </div>
      ) : isStatusPagesPage ? selectedStatusPageId ? (
        <StatusPageInfoPage
          statusPageId={selectedStatusPageId}
          onBackToMonitoring={() => {
            navigateTo('/monitoring');
          }}
          onBackToStatusPages={() => {
            navigateTo('/status-pages');
          }}
        />
      ) : (
        <div className="panel-main">
          <StatusPagesPage
            onOpenStatusPage={(statusPageId) => {
              navigateTo(`/status-pages/${statusPageId}`);
            }}
          />
        </div>
      ) : (
        <>
          {/* --- Header (spans center + right columns) --- */}

          {/* --- Main Panel (center column) --- */}
          <div className="panel-main">
            <header className="workspace-top">
              <h1>Monitors</h1>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  navigateTo('/monitoring/new');
                }}
              >
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
                  <button className="action-button" type="button">
                    <span className="action-icon-circle" aria-hidden="true">
                      <Play size={11} />
                    </span>
                    <span>Start</span>
                  </button>
                  <button className="action-button" type="button">
                    <span className="action-icon-circle" aria-hidden="true">
                      <Pause size={11} />
                    </span>
                    <span>Pause</span>
                  </button>
                  <button className="action-button" type="button">
                    <span className="action-icon-circle" aria-hidden="true">
                      <Trash2 size={11} />
                    </span>
                    <span>Delete</span>
                  </button>
                  <button className="action-button" type="button">
                    <span className="action-icon-circle" aria-hidden="true">
                      <RotateCcw size={11} />
                    </span>
                    <span>Resume</span>
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
                        {monitor.detailsEnabled ? (
                          <button
                            type="button"
                            className="monitor-name-button"
                            onClick={() => {
                              navigateTo(`/monitoring/${monitor.id}`);
                            }}
                          >
                            {monitor.name}
                          </button>
                        ) : (
                          <strong>{monitor.name}</strong>
                        )}
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
        </>
      )}
    </div>
  );
}

export default App;
