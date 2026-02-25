import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CiSliderHorizontal } from 'react-icons/ci';
import type { LucideIcon } from 'lucide-react';
import ExclamationHexagonIcon from './ExclamationHexagonIcon';
import monitoringMenuIcon from './images/m1.png';
import EditMonitorPage from './pages/edit-monitor/EditMonitorPage';
import IncidentsPage from './pages/incidents/IncidentsPage';
import IntegrationsApiPage from './pages/integrations-api/IntegrationsApiPage';
import ConfirmationCodePage from './pages/login/ConfirmationCodePage';
import ForgotPasswordPage from './pages/login/ForgotPasswordPage';
import LoginPage from './pages/login/LoginPage';
import MonitorDetailsPage from './pages/monitor-details/MonitorDetailsPage';
import NewMonitorPage from './pages/new-monitor/NewMonitorPage';
import StatusPageInfoPage from './pages/status/StatusPageInfoPage';
import StatusPagesPage from './pages/status/StatusPagesPage';
import InviteTeamMemberPage from './pages/team-members/InviteTeamMemberPage';
import TeamMembersPage from './pages/team-members/TeamMembersPage';
import {
  ArrowUpDown,
  Check,
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
  tags: string[];
  uptimeLabel: string;
  interval: string;
  uptime: string;
  state: 'up' | 'down';
  history: HistoryState[];
  detailsEnabled?: boolean;
}

type IntegrationsSubPage = 'api' | 'team';
type TeamMembersSubPage = 'overview' | 'invite';
type AuthRoute = 'login' | 'confirmation-code' | 'forgot-password' | null;
type NewMonitorOption = 'single' | 'wizard' | 'bulk';
type MonitorFilterStatus = 'none' | 'up' | 'down';
type MonitorSortOption = 'down-first' | 'up-first' | 'paused-first' | 'a-z' | 'newest-first';
type BulkActionOption = 'start' | 'pause' | 'resume' | 'delete';

const monitorSortOptionLabels: Record<MonitorSortOption, string> = {
  'down-first': 'Down first',
  'up-first': 'Up first',
  'paused-first': 'Paused first',
  'a-z': 'A -> Z',
  'newest-first': 'Newest first',
};

const monitorSortOptions: MonitorSortOption[] = ['down-first', 'up-first', 'paused-first', 'a-z', 'newest-first'];
const monitorTagOptions = ['All tags', 'Website', 'API', 'Core', 'Interface'];
const bulkActionOptions: BulkActionOption[] = ['start', 'pause', 'resume', 'delete'];
const bulkActionOptionLabels: Record<BulkActionOption, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  delete: 'Delete',
};

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
    tags: ['Website', 'Core'],
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
    tags: ['Website'],
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
    tags: ['API'],
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
    tags: ['Interface', 'Core'],
    uptimeLabel: 'Up 2 hr, 26 min',
    interval: '5 min',
    uptime: '100%',
    state: 'up',
    history: buildHistory('uuuuuuuuuuuuuuuuuuuuuuuuuuuu'),
  },
];

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [monitorSortOption, setMonitorSortOption] = useState<MonitorSortOption>('down-first');
  const [isMonitorSortMenuOpen, setIsMonitorSortMenuOpen] = useState(false);
  const [selectedMonitorTag, setSelectedMonitorTag] = useState('All tags');
  const [isMonitorTagMenuOpen, setIsMonitorTagMenuOpen] = useState(false);
  const [isBulkActionsMenuOpen, setIsBulkActionsMenuOpen] = useState(false);
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);
  const [selectedStatusPageId, setSelectedStatusPageId] = useState<string | null>(null);
  const [isCreatingMonitor, setIsCreatingMonitor] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMenuLabel, setActiveMenuLabel] = useState(menuItems[0].label);
  const [integrationsSubPage, setIntegrationsSubPage] = useState<IntegrationsSubPage>('api');
  const [teamMembersSubPage, setTeamMembersSubPage] = useState<TeamMembersSubPage>('overview');
  const [authRoute, setAuthRoute] = useState<AuthRoute>(null);
  const [newMonitorMenuOpen, setNewMonitorMenuOpen] = useState(false);
  const [isMonitorFilterOpen, setIsMonitorFilterOpen] = useState(false);
  const [appliedMonitorFilterStatus, setAppliedMonitorFilterStatus] = useState<MonitorFilterStatus>('none');
  const [appliedMonitorTagQuery, setAppliedMonitorTagQuery] = useState('');
  const [draftMonitorFilterStatus, setDraftMonitorFilterStatus] = useState<MonitorFilterStatus>('none');
  const [draftMonitorTagQuery, setDraftMonitorTagQuery] = useState('');
  const [sidebarTogglePending, setSidebarTogglePending] = useState(false);
  const sidebarToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newMonitorMenuRef = useRef<HTMLDivElement | null>(null);
  const monitorSortMenuRef = useRef<HTMLDivElement | null>(null);
  const monitorTagMenuRef = useRef<HTMLDivElement | null>(null);
  const bulkActionsMenuRef = useRef<HTMLDivElement | null>(null);

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
    const statusFilteredRows =
      appliedMonitorFilterStatus === 'none'
        ? monitorRows
        : monitorRows.filter((monitor) => monitor.state === appliedMonitorFilterStatus);

    const tagFilteredRows = appliedMonitorTagQuery.trim()
      ? statusFilteredRows.filter((monitor) =>
          monitor.name.toLowerCase().includes(appliedMonitorTagQuery.trim().toLowerCase()),
        )
      : statusFilteredRows;

    const tagMenuFilteredRows =
      selectedMonitorTag === 'All tags'
        ? tagFilteredRows
        : tagFilteredRows.filter((monitor) => monitor.tags.includes(selectedMonitorTag));

    if (monitorSortOption === 'down-first') {
      return [...tagMenuFilteredRows].sort((a, b) => {
        if (a.state === b.state) return 0;
        return a.state === 'down' ? -1 : 1;
      });
    }

    if (monitorSortOption === 'up-first') {
      return [...tagMenuFilteredRows].sort((a, b) => {
        if (a.state === b.state) return 0;
        return a.state === 'up' ? -1 : 1;
      });
    }

    if (monitorSortOption === 'a-z') {
      return [...tagMenuFilteredRows].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (monitorSortOption === 'newest-first') {
      return [...tagMenuFilteredRows].reverse();
    }

    // Placeholder behavior until a paused monitor state is introduced.
    return tagMenuFilteredRows;
  }, [monitorSortOption, selectedMonitorTag, appliedMonitorFilterStatus, appliedMonitorTagQuery]);

  const hasPendingMonitorFilterChanges =
    draftMonitorFilterStatus !== appliedMonitorFilterStatus || draftMonitorTagQuery.trim() !== appliedMonitorTagQuery.trim();

  const hasActiveMonitorFilters =
    appliedMonitorFilterStatus !== 'none' || appliedMonitorTagQuery.trim().length > 0 || selectedMonitorTag !== 'All tags';
  const selectedMonitorsCount = selectedMonitorIds.length;
  const areAllMonitorsSelected = selectedMonitorIds.length === monitorRows.length && monitorRows.length > 0;

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
  const isTeamMembersPage = activeMenuLabel === 'Team members';
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
    let nextTeamMembersSubPage: TeamMembersSubPage = 'overview';
    let nextAuthRoute: AuthRoute = null;
    let nextSelectedMonitorId: string | null = null;
    let nextEditingMonitorId: string | null = null;
    let nextSelectedStatusPageId: string | null = null;
    let nextIsCreatingMonitor = false;

    if (pathname === '/login') {
      nextAuthRoute = 'login';
    } else if (pathname === '/confirmation-code') {
      nextAuthRoute = 'confirmation-code';
    } else if (pathname === '/forgot-password') {
      nextAuthRoute = 'forgot-password';
    } else if (pathname === '/' || pathname === '/monitoring') {
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
    } else if (pathname === '/team-members/invite') {
      nextMenuLabel = 'Team members';
      nextTeamMembersSubPage = 'invite';
    } else if (pathname === '/team-members') {
      nextMenuLabel = 'Team members';
    }

    setActiveMenuLabel(nextMenuLabel);
    setIntegrationsSubPage(nextIntegrationsSubPage);
    setTeamMembersSubPage(nextTeamMembersSubPage);
    setAuthRoute(nextAuthRoute);
    setNewMonitorMenuOpen(false);
    setIsMonitorSortMenuOpen(false);
    setIsMonitorTagMenuOpen(false);
    setIsBulkActionsMenuOpen(false);
    setIsMonitorFilterOpen(false);
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

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (newMonitorMenuRef.current && !newMonitorMenuRef.current.contains(target)) {
        setNewMonitorMenuOpen(false);
      }

      if (monitorSortMenuRef.current && !monitorSortMenuRef.current.contains(target)) {
        setIsMonitorSortMenuOpen(false);
      }

      if (monitorTagMenuRef.current && !monitorTagMenuRef.current.contains(target)) {
        setIsMonitorTagMenuOpen(false);
      }

      if (bulkActionsMenuRef.current && !bulkActionsMenuRef.current.contains(target)) {
        setIsBulkActionsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setNewMonitorMenuOpen(false);
      setIsMonitorSortMenuOpen(false);
      setIsMonitorTagMenuOpen(false);
      setIsBulkActionsMenuOpen(false);
      setIsMonitorFilterOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
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

  const handleNewMonitorOptionSelect = (option: NewMonitorOption) => {
    setNewMonitorMenuOpen(false);

    if (option === 'single') {
      navigateTo('/monitoring/new');
      return;
    }

    // Wizard and bulk upload currently share the same creation entry page.
    navigateTo('/monitoring/new');
  };

  const openMonitorFilterPanel = () => {
    setDraftMonitorFilterStatus(appliedMonitorFilterStatus);
    setDraftMonitorTagQuery(appliedMonitorTagQuery);
    setIsMonitorFilterOpen(true);
  };

  const closeMonitorFilterPanel = () => {
    setIsMonitorFilterOpen(false);
  };

  const handleApplyMonitorFilter = () => {
    setAppliedMonitorFilterStatus(draftMonitorFilterStatus);
    setAppliedMonitorTagQuery(draftMonitorTagQuery.trim());
    setIsMonitorFilterOpen(false);
  };

  const handleResetMonitorFilter = () => {
    setDraftMonitorFilterStatus('none');
    setDraftMonitorTagQuery('');
  };

  const handleBulkActionOptionSelect = (option: BulkActionOption) => {
    if (!bulkActionOptions.includes(option)) return;
    setIsBulkActionsMenuOpen(false);
  };

  const toggleMonitorSelection = (monitorId: string) => {
    setSelectedMonitorIds((prev) =>
      prev.includes(monitorId) ? prev.filter((id) => id !== monitorId) : [...prev, monitorId],
    );
  };

  const toggleAllMonitorSelections = () => {
    setSelectedMonitorIds(areAllMonitorsSelected ? [] : monitorRows.map((monitor) => monitor.id));
  };

  if (authRoute === 'login') {
    return (
      <LoginPage
        onSignIn={() => {
          navigateTo('/monitoring');
        }}
        onForgotPassword={() => {
          navigateTo('/forgot-password');
        }}
      />
    );
  }

  if (authRoute === 'confirmation-code') {
    return (
      <ConfirmationCodePage
        onBack={() => {
          navigateTo('/forgot-password');
        }}
        onContinue={() => {
          navigateTo('/login');
        }}
      />
    );
  }

  if (authRoute === 'forgot-password') {
    return (
      <ForgotPasswordPage
        onResetPassword={() => {
          navigateTo('/confirmation-code');
        }}
      />
    );
  }

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
                className={[
                  'menu-link',
                  item.customIcon === 'monitoringRadar' ? 'menu-link-monitoring' : '',
                  isActive ? 'active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  navigateTo(routeByMenuLabel[item.label]);
                  setMobileMenuOpen(false);
                }}
              >
                <span className="menu-icon-slot" aria-hidden="true">
                  {item.customIcon === 'monitoringRadar' ? (
                    <img src={monitoringMenuIcon} alt="" className="menu-monitoring-image" />
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
          <button
            className="logout-button"
            aria-label="Go to login"
            onClick={() => {
              navigateTo('/login');
              setMobileMenuOpen(false);
            }}
          >
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
      ) : isTeamMembersPage ? (
        teamMembersSubPage === 'invite' ? (
          <InviteTeamMemberPage />
        ) : (
          <TeamMembersPage
            onInviteTeam={() => {
              navigateTo('/team-members/invite');
            }}
          />
        )
      ) : (
        <>
          {/* --- Header (spans center + right columns) --- */}

          {/* --- Main Panel (center column) --- */}
          <div className="panel-main">
            <header className="workspace-top">
              <h1>Monitors</h1>
              <div className="primary-button-wrap" ref={newMonitorMenuRef}>
                <button
                  className="primary-button primary-button-main"
                  type="button"
                  onClick={() => {
                    setNewMonitorMenuOpen(false);
                    navigateTo('/monitoring/new');
                  }}
                >
                  <Plus size={14} />
                  <span>New monitor</span>
                </button>
                <button
                  className="primary-button-menu-toggle"
                  type="button"
                  aria-label="Open new monitor options"
                  aria-haspopup="menu"
                  aria-expanded={newMonitorMenuOpen}
                  onClick={() => setNewMonitorMenuOpen((prev) => !prev)}
                >
                  <ChevronDown size={14} />
                </button>

                {newMonitorMenuOpen && (
                  <div className="primary-button-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => handleNewMonitorOptionSelect('single')}>
                      <span className="primary-button-menu-item-icon" aria-hidden="true">
                        <Plus size={14} />
                      </span>
                      <span>Single monitor</span>
                    </button>
                    <button type="button" role="menuitem" onClick={() => handleNewMonitorOptionSelect('wizard')}>
                      <span className="primary-button-menu-item-icon" aria-hidden="true">
                        <Wrench size={14} />
                      </span>
                      <span>Monitor Wizard</span>
                    </button>
                    <button type="button" role="menuitem" onClick={() => handleNewMonitorOptionSelect('bulk')}>
                      <span className="primary-button-menu-item-icon" aria-hidden="true">
                        <ArrowUpDown size={14} />
                      </span>
                      <span>Bulk upload</span>
                    </button>
                  </div>
                )}
              </div>
            </header>
            <div className="filter-bar">
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip-button chip-counter ${areAllMonitorsSelected ? 'active' : ''}`}
                  onClick={toggleAllMonitorSelections}
                >
                  <span className="counter-dot" aria-hidden="true" />
                  {selectedMonitorsCount}/{monitorRows.length}
                </button>
                <div className="bulk-actions-wrap" ref={bulkActionsMenuRef}>
                  <button
                    className={`chip-button bulk-actions-trigger ${isBulkActionsMenuOpen ? 'active' : ''}`}
                    type="button"
                    onClick={() => setIsBulkActionsMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isBulkActionsMenuOpen}
                  >
                    Bulk actions
                    <ChevronDown size={16} />
                  </button>

                  {isBulkActionsMenuOpen && (
                    <div className="bulk-actions-menu" role="menu">
                      {bulkActionOptions.map((bulkOption) => (
                        <button
                          key={bulkOption}
                          type="button"
                          role="menuitem"
                          onClick={() => handleBulkActionOptionSelect(bulkOption)}
                          className={bulkOption === 'delete' ? 'delete' : ''}
                        >
                          <span className="bulk-actions-menu-icon" aria-hidden="true">
                            {bulkOption === 'start' ? (
                              <Play size={14} />
                            ) : bulkOption === 'pause' ? (
                              <Pause size={14} />
                            ) : bulkOption === 'resume' ? (
                              <RotateCcw size={14} />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </span>
                          <span>{bulkActionOptionLabels[bulkOption]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="monitor-tag-wrap" ref={monitorTagMenuRef}>
                  <button
                    className={`chip-button monitor-tag-trigger ${isMonitorTagMenuOpen || selectedMonitorTag !== 'All tags' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setIsMonitorTagMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isMonitorTagMenuOpen}
                  >
                    <Tag size={20} />
                    <span className="monitor-tag-label">{selectedMonitorTag}</span>
                    <ChevronDown size={16} />
                  </button>

                  {isMonitorTagMenuOpen && (
                    <div className="monitor-tag-menu" role="menu">
                      {monitorTagOptions.map((tagOption) => (
                        <button
                          key={tagOption}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selectedMonitorTag === tagOption}
                          className={selectedMonitorTag === tagOption ? 'selected' : ''}
                          onClick={() => {
                            setSelectedMonitorTag(tagOption);
                            setIsMonitorTagMenuOpen(false);
                          }}
                        >
                          <span>{tagOption}</span>
                          {selectedMonitorTag === tagOption ? <Check size={16} aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="search-row">
                <label className="search-box">
                  <Search size={20} />
                  <input type="text" placeholder="Search by name or url" />
                </label>
                <div className="monitor-sort-wrap" ref={monitorSortMenuRef}>
                  <button
                    className={`chip-button monitor-sort-trigger ${isMonitorSortMenuOpen ? 'active' : ''}`}
                    type="button"
                    onClick={() => setIsMonitorSortMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isMonitorSortMenuOpen}
                  >
                    <ArrowUpDown size={20} />
                    <span className="monitor-sort-label">{monitorSortOptionLabels[monitorSortOption]}</span>
                    <ChevronDown size={16} />
                  </button>

                  {isMonitorSortMenuOpen && (
                    <div className="monitor-sort-menu" role="menu">
                      {monitorSortOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="menuitemradio"
                          aria-checked={monitorSortOption === option}
                          className={monitorSortOption === option ? 'selected' : ''}
                          onClick={() => {
                            setMonitorSortOption(option);
                            setIsMonitorSortMenuOpen(false);
                          }}
                        >
                          <span>{monitorSortOptionLabels[option]}</span>
                          {monitorSortOption === option ? <Check size={16} aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className={`chip-button monitor-filter-trigger ${isMonitorFilterOpen || hasActiveMonitorFilters ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    if (isMonitorFilterOpen) {
                      closeMonitorFilterPanel();
                    } else {
                      openMonitorFilterPanel();
                    }
                  }}
                >
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
                  <article className={`monitor-row ${selectedMonitorIds.includes(monitor.id) ? 'selected' : ''}`} key={monitor.id}>
                    <div className="monitor-main">
                      <button
                        type="button"
                        className={`monitor-checkbox ${selectedMonitorIds.includes(monitor.id) ? 'selected' : ''}`}
                        aria-label={selectedMonitorIds.includes(monitor.id) ? `Unselect ${monitor.name}` : `Select ${monitor.name}`}
                        onClick={() => toggleMonitorSelection(monitor.id)}
                      />
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

          <div className={`monitor-filter-overlay ${isMonitorFilterOpen ? 'show' : ''}`} onClick={closeMonitorFilterPanel} />

          <aside className={`monitor-filter-panel ${isMonitorFilterOpen ? 'show' : ''}`} aria-hidden={!isMonitorFilterOpen}>
            <header className="monitor-filter-header">
              <h3>Filter</h3>
              <button type="button" onClick={closeMonitorFilterPanel} aria-label="Close filter">
                <X size={16} />
              </button>
            </header>

            <div className="monitor-filter-body">
              <div className="monitor-filter-group">
                <label htmlFor="monitor-filter-status">Status</label>
                <div className="monitor-filter-select-shell">
                  <select
                    id="monitor-filter-status"
                    value={draftMonitorFilterStatus}
                    onChange={(event) => setDraftMonitorFilterStatus(event.target.value as MonitorFilterStatus)}
                  >
                    <option value="none">None</option>
                    <option value="up">Up</option>
                    <option value="down">Down</option>
                  </select>
                  <ChevronDown size={14} aria-hidden="true" />
                </div>
              </div>

              <div className="monitor-filter-group">
                <label htmlFor="monitor-filter-tags">Tags</label>
                <input
                  id="monitor-filter-tags"
                  type="text"
                  placeholder="Search for a tag..."
                  value={draftMonitorTagQuery}
                  onChange={(event) => setDraftMonitorTagQuery(event.target.value)}
                />
                <div className="monitor-filter-empty">
                  <p className="monitor-filter-empty-title">You don&apos;t have any tags yet.</p>
                  <p className="monitor-filter-empty-copy">
                    To filter monitors based on tags create and attach tag to some monitor.
                  </p>
                </div>
              </div>
            </div>

            <footer className="monitor-filter-footer">
              <button type="button" className="monitor-filter-reset" onClick={handleResetMonitorFilter}>
                Reset
              </button>
              <button
                type="button"
                className="monitor-filter-apply"
                onClick={handleApplyMonitorFilter}
                disabled={!hasPendingMonitorFilterChanges}
              >
                Apply
              </button>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}

export default App;
