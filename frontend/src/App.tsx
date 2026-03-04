import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CiSliderHorizontal } from 'react-icons/ci';
import type { LucideIcon } from 'lucide-react';
import ExclamationHexagonIcon from './ExclamationHexagonIcon';
import monitoringMenuIcon from './images/m1.png';
import EditMonitorPage from './pages/edit-monitor/EditMonitorPage';
import IncidentsPage from './pages/incidents/IncidentsPage';
import IntegrationsApiPage from './pages/integrations-api/IntegrationsApiPage';
import AcceptInvitationPage from './pages/login/AcceptInvitationPage';
import ConfirmationCodePage from './pages/login/ConfirmationCodePage';
import ForgotPasswordPage from './pages/login/ForgotPasswordPage';
import LoginPage from './pages/login/LoginPage';
import MaintenancePage from './pages/maintenance/MaintenancePage';
import MonitorDetailsPage from './pages/monitor-details/MonitorDetailsPage';
import NewMonitorPage from './pages/new-monitor/NewMonitorPage';
import StatusPageInfoPage from './pages/status/StatusPageInfoPage';
import StatusPagePublicPage from './pages/status/StatusPagePublicPage';
import StatusPagesPage from './pages/status/StatusPagesPage';
import InviteTeamMemberPage from './pages/team-members/InviteTeamMemberPage';
import TeamMembersManagePage from './pages/team-members/TeamMembersManagePage';
import TeamMembersPage from './pages/team-members/TeamMembersPage';
import {
  clearStoredAuthToken,
  acceptInvitation,
  checkMonitor,
  createInvitation,
  createMonitor,
  updateMonitor,
  deleteInvitation,
  deleteMonitor,
  deleteUser,
  updateUser,
  fetchInvitationByToken,
  fetchInvitations,
  fetchMe,
  fetchMonitors,
  fetchUsers,
  getStoredAuthToken,
  isApiError,
  login,
  pauseMonitor,
  requestPasswordReset,
  resetPasswordWithCode,
  resumeMonitor,
  saveAuthToken,
  type BackendMonitor,
  type AuthUser,
  type UserRole,
} from './lib/api';
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
  state: 'up' | 'down' | 'paused' | 'pending';
  history: HistoryState[];
  detailsEnabled?: boolean;
}

interface TeamMemberEntry {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

interface TeamInvitationEntry {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
}

type IntegrationsSubPage = 'api' | 'team';
type TeamMembersSubPage = 'overview' | 'invite' | 'manage';
type MaintenanceSubPage = 'overview' | 'windows';
type AuthRoute = 'login' | 'confirmation-code' | 'forgot-password' | 'accept-invitation' | null;
type PasswordResetContext = { email: string; newPassword: string } | null;
type NewMonitorOption = 'single' | 'wizard' | 'bulk';
type MonitorFilterStatus = 'none' | 'up' | 'down' | 'paused';
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

const formatAppError = (error: unknown, fallback: string): string => {
  if (isApiError(error)) {
    return error.message || fallback;
  }

  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return fallback;
};

const formatIntervalLabel = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '5 min';
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
};

const HISTORY_BAR_COUNT = 28;
const HISTORY_WINDOW_MINUTES = 24 * 60;
const MINUTES_PER_HISTORY_BAR = HISTORY_WINDOW_MINUTES / HISTORY_BAR_COUNT;

const parseUptimePercent = (value: string): number => {
  const parsed = Number(value.replace('%', ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
};

const formatHoursAndMinutes = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes < 0) return '0h, 0m';
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const mins = roundedMinutes % 60;
  return `${hours}h, ${mins}m`;
};

const buildHistoryFromUptime = (
  uptime: number,
  status: BackendMonitor['status']
): HistoryState[] => {
  if (status === 'down') {
    return Array.from({ length: HISTORY_BAR_COUNT }, () => 'down');
  }

  if (status === 'paused' || status === 'pending') {
    return Array.from({ length: HISTORY_BAR_COUNT }, () => 'warning');
  }

  const safeUptime = Number.isFinite(uptime) ? Math.min(100, Math.max(0, uptime)) : 0;
  const downtime = 100 - safeUptime;

  let downBars = Math.round((downtime / 100) * HISTORY_BAR_COUNT);
  if (downtime > 0 && downBars === 0) {
    downBars = 1;
  }
  downBars = Math.min(HISTORY_BAR_COUNT, downBars);

  const history = Array.from({ length: HISTORY_BAR_COUNT }, () => 'up' as HistoryState);

  if (downBars === 0) {
    return history;
  }

  // Distribute down bars across the timeline while preserving the exact count.
  let downPlaced = 0;
  for (let index = 0; index < HISTORY_BAR_COUNT; index += 1) {
    const expectedDownPlaced = Math.round(((index + 1) * downBars) / HISTORY_BAR_COUNT);
    if (expectedDownPlaced > downPlaced) {
      history[index] = 'down';
      downPlaced += 1;
    }
  }

  return history;
};

const mapBackendMonitorToRow = (monitor: BackendMonitor): MonitorRow => {
  const state: MonitorRow['state'] = monitor.status;
  const statusLabel =
    monitor.status === 'up'
      ? 'Up'
      : monitor.status === 'down'
        ? 'Down'
        : monitor.status === 'paused'
          ? 'Paused'
          : 'Pending';
  const uptimeValue = Number.isFinite(monitor.uptime) ? monitor.uptime : 0;

  return {
    id: monitor._id,
    name: monitor.name,
    protocol: monitor.type.toUpperCase(),
    url: monitor.url,
    tags: monitor.type === 'ws' || monitor.type === 'wss' ? ['API'] : ['Website'],
    uptimeLabel: statusLabel,
    interval: formatIntervalLabel(monitor.interval),
    uptime: `${uptimeValue.toFixed(3)}%`,
    state,
    history: buildHistoryFromUptime(uptimeValue, monitor.status),
    detailsEnabled: true,
  };
};

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
  const [isStatusPagePublicView, setIsStatusPagePublicView] = useState(false);
  const [isCreatingMonitor, setIsCreatingMonitor] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMenuLabel, setActiveMenuLabel] = useState(menuItems[0].label);
  const [integrationsSubPage, setIntegrationsSubPage] = useState<IntegrationsSubPage>('api');
  const [teamMembersSubPage, setTeamMembersSubPage] = useState<TeamMembersSubPage>('overview');
  const [maintenanceSubPage, setMaintenanceSubPage] = useState<MaintenanceSubPage>('overview');
  const [authRoute, setAuthRoute] = useState<AuthRoute>(null);
  const [passwordResetContext, setPasswordResetContext] = useState<PasswordResetContext>(null);
  const [newMonitorMenuOpen, setNewMonitorMenuOpen] = useState(false);
  const [isMonitorFilterOpen, setIsMonitorFilterOpen] = useState(false);
  const [appliedMonitorFilterStatus, setAppliedMonitorFilterStatus] = useState<MonitorFilterStatus>('none');
  const [appliedMonitorTagQuery, setAppliedMonitorTagQuery] = useState('');
  const [draftMonitorFilterStatus, setDraftMonitorFilterStatus] = useState<MonitorFilterStatus>('none');
  const [draftMonitorTagQuery, setDraftMonitorTagQuery] = useState('');
  const [monitorSearchQuery, setMonitorSearchQuery] = useState('');
  const [sidebarTogglePending, setSidebarTogglePending] = useState(false);
  const sidebarToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newMonitorMenuRef = useRef<HTMLDivElement | null>(null);
  const monitorSortMenuRef = useRef<HTMLDivElement | null>(null);
  const monitorTagMenuRef = useRef<HTMLDivElement | null>(null);
  const bulkActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredAuthToken());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [monitorRows, setMonitorRows] = useState<MonitorRow[]>([]);
  const [isMonitorsLoading, setIsMonitorsLoading] = useState(false);
  const [monitorLoadError, setMonitorLoadError] = useState<string | null>(null);
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);
  const [monitorActionFeedback, setMonitorActionFeedback] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberEntry[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitationEntry[]>([]);

  const currentStatus = useMemo(() => {
    const down = monitorRows.filter((monitor) => monitor.state === 'down').length;
    const up = monitorRows.filter((monitor) => monitor.state === 'up').length;
    const paused = monitorRows.filter((monitor) => monitor.state === 'paused' || monitor.state === 'pending').length;

    return {
      total: monitorRows.length,
      up,
      down,
      paused,
    };
  }, [monitorRows]);

  const last24HoursStats = useMemo(() => {
    if (monitorRows.length === 0) {
      return {
        overallUptime: '-',
        incidents: 0,
        withoutIncident: '-',
        affectedMonitors: 0,
      };
    }

    const overallUptimeValue =
      monitorRows.reduce((sum, monitor) => sum + parseUptimePercent(monitor.uptime), 0) / monitorRows.length;

    let incidents = 0;
    let affectedMonitors = 0;

    for (const monitor of monitorRows) {
      let hadDown = false;
      let previousWasDown = false;

      for (const state of monitor.history) {
        const isDown = state === 'down';
        if (isDown && !previousWasDown) {
          incidents += 1;
        }
        if (isDown) hadDown = true;
        previousWasDown = isDown;
      }

      if (hadDown) affectedMonitors += 1;
    }

    let barsWithoutIncident = 0;
    for (let index = HISTORY_BAR_COUNT - 1; index >= 0; index -= 1) {
      const anyDownAtBar = monitorRows.some((monitor) => monitor.history[index] === 'down');
      if (anyDownAtBar) break;
      barsWithoutIncident += 1;
    }

    const withoutIncident = formatHoursAndMinutes(barsWithoutIncident * MINUTES_PER_HISTORY_BAR);

    return {
      overallUptime: `${overallUptimeValue.toFixed(3)}%`,
      incidents,
      withoutIncident,
      affectedMonitors,
    };
  }, [monitorRows]);

  const displayedMonitors = useMemo(() => {
    const statusFilteredRows =
      appliedMonitorFilterStatus === 'none'
        ? monitorRows
        : monitorRows.filter((monitor) =>
            appliedMonitorFilterStatus === 'paused'
              ? monitor.state === 'paused' || monitor.state === 'pending'
              : monitor.state === appliedMonitorFilterStatus,
          );

    const tagFilteredRows = appliedMonitorTagQuery.trim()
      ? statusFilteredRows.filter((monitor) =>
          monitor.name.toLowerCase().includes(appliedMonitorTagQuery.trim().toLowerCase()),
        )
      : statusFilteredRows;

    const tagMenuFilteredRows =
      selectedMonitorTag === 'All tags'
        ? tagFilteredRows
        : tagFilteredRows.filter((monitor) => monitor.tags.includes(selectedMonitorTag));

    const normalizedSearchQuery = monitorSearchQuery.trim().toLowerCase();
    const searchFilteredRows =
      normalizedSearchQuery.length === 0
        ? tagMenuFilteredRows
        : tagMenuFilteredRows.filter((monitor) => {
            const searchableName = monitor.name.toLowerCase();
            const searchableUrl = monitor.url?.toLowerCase() ?? '';
            return searchableName.includes(normalizedSearchQuery) || searchableUrl.includes(normalizedSearchQuery);
          });

    if (monitorSortOption === 'down-first') {
      const sortRank: Record<MonitorRow['state'], number> = { down: 0, pending: 1, paused: 2, up: 3 };
      return [...searchFilteredRows].sort((a, b) => {
        const rankDelta = sortRank[a.state] - sortRank[b.state];
        if (rankDelta !== 0) return rankDelta;
        return a.name.localeCompare(b.name);
      });
    }

    if (monitorSortOption === 'up-first') {
      const sortRank: Record<MonitorRow['state'], number> = { up: 0, pending: 1, paused: 2, down: 3 };
      return [...searchFilteredRows].sort((a, b) => {
        const rankDelta = sortRank[a.state] - sortRank[b.state];
        if (rankDelta !== 0) return rankDelta;
        return a.name.localeCompare(b.name);
      });
    }

    if (monitorSortOption === 'a-z') {
      return [...searchFilteredRows].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (monitorSortOption === 'newest-first') {
      return [...searchFilteredRows].reverse();
    }

    const sortRank: Record<MonitorRow['state'], number> = { paused: 0, pending: 1, down: 2, up: 3 };
    return [...searchFilteredRows].sort((a, b) => {
      const rankDelta = sortRank[a.state] - sortRank[b.state];
      if (rankDelta !== 0) return rankDelta;
      return a.name.localeCompare(b.name);
    });
  }, [monitorRows, monitorSortOption, selectedMonitorTag, appliedMonitorFilterStatus, appliedMonitorTagQuery, monitorSearchQuery]);

  const hasPendingMonitorFilterChanges =
    draftMonitorFilterStatus !== appliedMonitorFilterStatus || draftMonitorTagQuery.trim() !== appliedMonitorTagQuery.trim();

  const hasActiveMonitorFilters =
    appliedMonitorFilterStatus !== 'none' || appliedMonitorTagQuery.trim().length > 0 || selectedMonitorTag !== 'All tags';
  const selectedMonitorsCount = selectedMonitorIds.length;
  const areAllMonitorsSelected = selectedMonitorIds.length === monitorRows.length && monitorRows.length > 0;

  const selectedMonitor = useMemo(
    () => monitorRows.find((monitor) => monitor.id === selectedMonitorId) ?? null,
    [monitorRows, selectedMonitorId],
  );
  const editingMonitor = useMemo(
    () => monitorRows.find((monitor) => monitor.id === editingMonitorId) ?? null,
    [monitorRows, editingMonitorId],
  );
  const teamMonitor = editingMonitor;
  const isIntegrationsPage = activeMenuLabel === 'Integrations & API';
  const isIncidentsPage = activeMenuLabel === 'Incidents';
  const isMaintenancePage = activeMenuLabel === 'Maintenance';
  const isStatusPagesPage = activeMenuLabel === 'Status pages';
  const isTeamMembersPage = activeMenuLabel === 'Team members';
  const isCurrentUserAdmin = currentUser?.role === 'admin';
  const userInitials = useMemo(() => {
    if (!currentUser?.name) return '??';
    return currentUser.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((value) => value.charAt(0).toUpperCase())
      .join('');
  }, [currentUser]);
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

    let nextMenuLabel: MenuLabel = 'Monitoring';
    let nextIntegrationsSubPage: IntegrationsSubPage = 'api';
    let nextTeamMembersSubPage: TeamMembersSubPage = 'overview';
    let nextMaintenanceSubPage: MaintenanceSubPage = 'overview';
    let nextAuthRoute: AuthRoute = null;
    let nextSelectedMonitorId: string | null = null;
    let nextEditingMonitorId: string | null = null;
    let nextSelectedStatusPageId: string | null = null;
    let nextIsStatusPagePublicView = false;
    let nextIsCreatingMonitor = false;

    if (pathname === '/login') {
      nextAuthRoute = 'login';
    } else if (pathname === '/confirmation-code') {
      nextAuthRoute = 'confirmation-code';
    } else if (pathname === '/forgot-password') {
      nextAuthRoute = 'forgot-password';
    } else if (pathname === '/accept-invitation') {
      nextAuthRoute = 'accept-invitation';
    } else if (pathname === '/' || pathname === '/monitoring') {
      nextMenuLabel = 'Monitoring';
    } else if (pathname === '/monitoring/new') {
      nextMenuLabel = 'Monitoring';
      nextIsCreatingMonitor = true;
    } else if (segments.length === 3 && segments[0] === 'monitoring' && segments[2] === 'edit') {
      nextMenuLabel = 'Monitoring';
      nextEditingMonitorId = segments[1];
    } else if (segments.length === 3 && segments[0] === 'monitoring' && segments[2] === 'integrations-team') {
      nextMenuLabel = 'Monitoring';
      nextIntegrationsSubPage = 'team';
      nextEditingMonitorId = segments[1];
    } else if (segments.length === 2 && segments[0] === 'monitoring') {
      nextMenuLabel = 'Monitoring';
      nextSelectedMonitorId = segments[1];
    } else if (pathname === '/integrations-api') {
      nextMenuLabel = 'Integrations & API';
      nextIntegrationsSubPage = 'api';
    } else if (pathname === '/integrations-team') {
      nextMenuLabel = 'Integrations & API';
      nextIntegrationsSubPage = 'api';
    } else if (pathname === '/incidents') {
      nextMenuLabel = 'Incidents';
    } else if (segments.length === 3 && segments[0] === 'status-pages' && segments[2] === 'public') {
      nextMenuLabel = 'Status pages';
      nextSelectedStatusPageId = segments[1];
      nextIsStatusPagePublicView = true;
    } else if (segments.length === 2 && segments[0] === 'status-pages') {
      nextMenuLabel = 'Status pages';
      nextSelectedStatusPageId = segments[1];
    } else if (pathname === '/status-pages') {
      nextMenuLabel = 'Status pages';
    } else if (pathname === '/maintenance/windows') {
      nextMenuLabel = 'Maintenance';
      nextMaintenanceSubPage = 'windows';
    } else if (pathname === '/maintenance') {
      nextMenuLabel = 'Maintenance';
    } else if (pathname === '/team-members/invite') {
      nextMenuLabel = 'Team members';
      nextTeamMembersSubPage = 'invite';
    } else if (pathname === '/team-members/manage') {
      nextMenuLabel = 'Team members';
      nextTeamMembersSubPage = 'manage';
    } else if (pathname === '/team-members') {
      nextMenuLabel = 'Team members';
    }

    setActiveMenuLabel(nextMenuLabel);
    setIntegrationsSubPage(nextIntegrationsSubPage);
    setTeamMembersSubPage(nextTeamMembersSubPage);
    setMaintenanceSubPage(nextMaintenanceSubPage);
    setAuthRoute(nextAuthRoute);
    setNewMonitorMenuOpen(false);
    setIsMonitorSortMenuOpen(false);
    setIsMonitorTagMenuOpen(false);
    setIsBulkActionsMenuOpen(false);
    setIsMonitorFilterOpen(false);
    setSelectedMonitorId(nextSelectedMonitorId);
    setEditingMonitorId(nextEditingMonitorId);
    setSelectedStatusPageId(nextSelectedStatusPageId);
    setIsStatusPagePublicView(nextIsStatusPagePublicView);
    setIsCreatingMonitor(nextIsCreatingMonitor);
    setMonitorActionFeedback(null);
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

  const clearSessionAndRedirectToLogin = useCallback(() => {
    clearStoredAuthToken();
    setAuthToken(null);
    setCurrentUser(null);
    setMonitorRows([]);
    setTeamMembers([]);
    setTeamInvitations([]);
    setMonitorLoadError(null);
    setSelectedMonitorIds([]);
    setSelectedMonitorId(null);
    setEditingMonitorId(null);
    setPasswordResetContext(null);
    navigateTo('/login', { replace: true });
  }, [navigateTo]);

  const refreshMonitors = useCallback(
    async (token: string) => {
      setIsMonitorsLoading(true);
      setMonitorLoadError(null);

      try {
        const response = await fetchMonitors(token);
        setMonitorRows(response.monitors.map(mapBackendMonitorToRow));
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return;
        }
        setMonitorLoadError(formatAppError(error, 'Impossible de charger les monitors.'));
      } finally {
        setIsMonitorsLoading(false);
      }
    },
    [clearSessionAndRedirectToLogin],
  );

  const refreshTeamSummary = useCallback(
    async (token: string, role: AuthUser['role']) => {
      if (role !== 'admin') {
        setTeamMembers([]);
        setTeamInvitations([]);
        return;
      }

      try {
        const [usersResponse, invitationsResponse] = await Promise.all([fetchUsers(token), fetchInvitations(token)]);

        const mappedUsers = usersResponse.users.map((user) => ({
          id: user._id ?? user.id ?? user.email,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive ?? true,
        }));

        const mapInvitationEntry = (invitation: {
          _id?: string;
          id?: string;
          email: string;
          status: 'pending' | 'accepted' | 'expired';
          createdAt: string;
          expiresAt: string;
        }) => ({
          id: invitation._id ?? invitation.id ?? invitation.email,
          email: invitation.email,
          status: invitation.status,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
        });

        const isExpiredInvitation = (invitation: {
          status: 'pending' | 'accepted' | 'expired';
          expiresAt: string;
        }): boolean => {
          const expiresAtTimestamp = Date.parse(invitation.expiresAt);
          const expiredByDate = !Number.isNaN(expiresAtTimestamp) && expiresAtTimestamp <= Date.now();
          return invitation.status === 'expired' || expiredByDate;
        };

        let mappedInvitations = invitationsResponse.invitations.map(mapInvitationEntry);

        const expiredInvitationIds = mappedInvitations
          .filter((invitation) => isExpiredInvitation(invitation))
          .map((invitation) => invitation.id);

        // Clean stale expired invitations immediately so the UI stays in sync
        // even if an old backend process is still running without scheduler cleanup.
        if (expiredInvitationIds.length > 0) {
          await Promise.allSettled(expiredInvitationIds.map((invitationId) => deleteInvitation(invitationId, token)));

          const refreshedInvitationsResponse = await fetchInvitations(token);
          mappedInvitations = refreshedInvitationsResponse.invitations.map(mapInvitationEntry);
        }

        mappedInvitations = mappedInvitations.filter((invitation) => !isExpiredInvitation(invitation));

        setTeamMembers(mappedUsers);
        setTeamInvitations(mappedInvitations);
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return;
        }
        setTeamMembers([]);
        setTeamInvitations([]);
      }
    },
    [clearSessionAndRedirectToLogin],
  );

  const handleSignIn = useCallback(
    async ({ email, password, rememberMe }: { email: string; password: string; rememberMe: boolean }) => {
      try {
        const response = await login(email, password);
        saveAuthToken(response.token, rememberMe);
        setAuthToken(response.token);
        setCurrentUser(response.user);
        setMonitorLoadError(null);
        navigateTo('/monitoring', { replace: true });
        return null;
      } catch (error) {
        return formatAppError(error, 'Impossible de se connecter.');
      }
    },
    [navigateTo],
  );

  const handleAcceptInvitation = useCallback(
    async ({
      token,
      password,
      rememberMe,
    }: {
      token: string;
      password: string;
      rememberMe: boolean;
    }) => {
      try {
        let fallbackNameForLegacyApi = 'User';
        try {
          const invitationResponse = await fetchInvitationByToken(token);
          const invitationName = invitationResponse.invitation.name?.trim();
          const invitationEmail = invitationResponse.invitation.email?.trim();
          if (invitationName) {
            fallbackNameForLegacyApi = invitationName;
          } else if (invitationEmail) {
            const localPart = invitationEmail.split('@')[0]?.trim();
            if (localPart) {
              fallbackNameForLegacyApi = localPart;
            }
          }
        } catch {
          // Ignore: accept endpoint will return a clear error if token is invalid/expired.
        }

        const response = await acceptInvitation(token, password, fallbackNameForLegacyApi);
        saveAuthToken(response.token, rememberMe);
        setAuthToken(response.token);
        setCurrentUser(response.user);
        setMonitorLoadError(null);
        navigateTo('/monitoring', { replace: true });
        return null;
      } catch (error) {
        return formatAppError(error, "Impossible d'accepter l'invitation.");
      }
    },
    [navigateTo],
  );

  const handleRequestPasswordReset = useCallback(
    async ({
      email,
      newPassword,
      confirmPassword,
    }: {
      email: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      if (newPassword !== confirmPassword) {
        return 'Les mots de passe ne correspondent pas.';
      }

      try {
        await requestPasswordReset(email);
        setPasswordResetContext({
          email,
          newPassword,
        });
        navigateTo('/confirmation-code');
        return null;
      } catch (error) {
        return formatAppError(error, 'Impossible d envoyer le code de verification.');
      }
    },
    [navigateTo],
  );

  const handleResendPasswordResetCode = useCallback(async () => {
    if (!passwordResetContext) {
      return 'Recommencez la procedure de reinitialisation.';
    }

    try {
      await requestPasswordReset(passwordResetContext.email);
      return null;
    } catch (error) {
      return formatAppError(error, 'Impossible de renvoyer le code.');
    }
  }, [passwordResetContext]);

  const handleConfirmPasswordReset = useCallback(
    async (code: string) => {
      if (!passwordResetContext) {
        return 'Recommencez la procedure de reinitialisation.';
      }

      try {
        await resetPasswordWithCode(passwordResetContext.email, code, passwordResetContext.newPassword);
        setPasswordResetContext(null);
        navigateTo('/login', { replace: true });
        return null;
      } catch (error) {
        return formatAppError(error, 'Impossible de reinitialiser le mot de passe.');
      }
    },
    [navigateTo, passwordResetContext],
  );

  const handleCreateMonitor = useCallback(
    async (payload: {
      name: string;
      url: string;
      type: 'http' | 'https' | 'ws' | 'wss';
      interval: number;
      timeout: number;
      httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
    }) => {
      if (!authToken) {
        return 'Authentification requise.';
      }

      try {
        await createMonitor(payload, authToken);
        await refreshMonitors(authToken);
        navigateTo('/monitoring');
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return 'Session expiree. Reconnectez-vous.';
        }
        return formatAppError(error, 'Impossible de creer le monitor.');
      }
    },
    [authToken, clearSessionAndRedirectToLogin, navigateTo, refreshMonitors],
  );

  const handleUpdateMonitor = useCallback(
    async (monitorId: string, payload: { name: string; url: string }) => {
      if (!authToken) {
        return 'Authentification requise.';
      }

      try {
        await updateMonitor(monitorId, payload, authToken);
        await refreshMonitors(authToken);
        navigateTo(`/monitoring/${monitorId}`);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return 'Session expiree. Reconnectez-vous.';
        }
        return formatAppError(error, 'Impossible de modifier le monitor.');
      }
    },
    [authToken, clearSessionAndRedirectToLogin, navigateTo, refreshMonitors],
  );

  const handleInviteTeamMember = useCallback(
    async ({
      name,
      email,
      monitorIds,
    }: {
      name: string;
      email: string;
      role: 'admin' | 'member';
      monitorIds: string[];
    }) => {
      if (!authToken) {
        return 'Authentification requise.';
      }
      if (!currentUser || currentUser.role !== 'admin') {
        return 'Acces reserve aux admins.';
      }

      try {
        const response = await createInvitation(name, email, monitorIds, authToken);
        const appliedMonitorIds = response.invitation.monitorIds ?? [];
        if (monitorIds.length > 0 && appliedMonitorIds.length === 0) {
          return "Invitation creee sans droits monitors. Redemarrez le backend sur le code actuel puis reinvitez l'utilisateur.";
        }
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return 'Session expiree. Reconnectez-vous.';
        }
        return formatAppError(error, "Impossible d'envoyer l'invitation.");
      }
    },
    [authToken, clearSessionAndRedirectToLogin, currentUser, refreshTeamSummary],
  );

  const handleDeleteTeamUser = useCallback(
    async (userId: string) => {
      if (!authToken) {
        return 'Authentification requise.';
      }
      if (!currentUser || currentUser.role !== 'admin') {
        return 'Acces reserve aux admins.';
      }
      if (userId === currentUser.id) {
        return 'Vous ne pouvez pas vous supprimer vous-meme.';
      }

      try {
        await deleteUser(userId, authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return 'Session expiree. Reconnectez-vous.';
        }
        return formatAppError(error, "Impossible de supprimer l'utilisateur.");
      }
    },
    [authToken, clearSessionAndRedirectToLogin, currentUser, refreshTeamSummary],
  );

  const handleTeamUserRoleChange = useCallback(
    async (userId: string, nextRole: UserRole) => {
      if (!authToken) {
        return 'Authentification requise.';
      }
      if (!currentUser || currentUser.role !== 'admin') {
        return 'Acces reserve aux admins.';
      }
      if (userId === currentUser.id) {
        return 'Vous ne pouvez pas modifier votre propre role.';
      }

      try {
        await updateUser(userId, { role: nextRole }, authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return 'Session expiree. Reconnectez-vous.';
        }
        return formatAppError(error, "Impossible de modifier le role de l'utilisateur.");
      }
    },
    [authToken, clearSessionAndRedirectToLogin, currentUser, refreshTeamSummary],
  );

  const handleTeamUserActiveToggle = useCallback(
    async (userId: string, nextIsActive: boolean) => {
      if (!authToken) {
        return 'Authentification requise.';
      }
      if (!currentUser || currentUser.role !== 'admin') {
        return 'Acces reserve aux admins.';
      }
      if (userId === currentUser.id && nextIsActive === false) {
        return 'Vous ne pouvez pas vous desactiver vous-meme.';
      }

      try {
        await updateUser(userId, { isActive: nextIsActive }, authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return 'Session expiree. Reconnectez-vous.';
        }
        return formatAppError(error, "Impossible de modifier le statut de l'utilisateur.");
      }
    },
    [authToken, clearSessionAndRedirectToLogin, currentUser, refreshTeamSummary],
  );

  const handleDeleteInvitation = useCallback(
    async (invitationId: string) => {
      if (!authToken) {
        return 'Authentification requise.';
      }
      if (!currentUser || currentUser.role !== 'admin') {
        return 'Acces reserve aux admins.';
      }

      try {
        await deleteInvitation(invitationId, authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return 'Session expiree. Reconnectez-vous.';
        }
        return formatAppError(error, "Impossible de supprimer l'invitation.");
      }
    },
    [authToken, clearSessionAndRedirectToLogin, currentUser, refreshTeamSummary],
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
    const isAuthPath =
      pathname === '/login' ||
      pathname === '/confirmation-code' ||
      pathname === '/forgot-password' ||
      pathname === '/accept-invitation';

    if (!authToken && !isAuthPath) {
      navigateTo('/login', { replace: true });
    } else if (authToken && (pathname === '/' || isAuthPath)) {
      navigateTo('/monitoring', { replace: true });
    } else if (pathname === '/') {
      navigateTo('/login', { replace: true });
    } else {
      applyRoute(pathname);
    }

    const handlePopState = () => {
      applyRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyRoute, authToken, navigateTo]);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;
    if (!isTeamMembersPage || teamMembersSubPage === 'overview') return;
    navigateTo('/team-members', { replace: true });
  }, [currentUser, isTeamMembersPage, navigateTo, teamMembersSubPage]);

  useEffect(() => {
    if (!authToken || !currentUser || currentUser.role !== 'admin') return;
    if (!isTeamMembersPage) return;
    void refreshTeamSummary(authToken, currentUser.role);
  }, [authToken, currentUser, isTeamMembersPage, teamMembersSubPage, refreshTeamSummary]);

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      setMonitorRows([]);
      setTeamMembers([]);
      setTeamInvitations([]);
      return;
    }

    let cancelled = false;

    const bootstrapSession = async () => {
      try {
        const meResponse = await fetchMe(authToken);
        if (cancelled) return;
        setCurrentUser(meResponse.user);
        await Promise.all([
          refreshMonitors(authToken),
          refreshTeamSummary(authToken, meResponse.user.role),
        ]);
      } catch (error) {
        if (cancelled) return;
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return;
        }
        setMonitorLoadError(formatAppError(error, 'Impossible de charger la session.'));
      }
    };

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [authToken, clearSessionAndRedirectToLogin, refreshMonitors, refreshTeamSummary]);

  useEffect(() => {
    setSelectedMonitorIds((previousIds) =>
      previousIds.filter((monitorId) => monitorRows.some((monitor) => monitor.id === monitorId))
    );
  }, [monitorRows]);

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

  const runBulkMonitorAction = useCallback(
    async (option: BulkActionOption, monitorIds: string[]) => {
      if (!bulkActionOptions.includes(option)) return;
      if (!authToken) {
        setMonitorActionFeedback('Authentification requise.');
        return;
      }
      if (monitorIds.length === 0) {
        setMonitorActionFeedback('Selectionnez au moins un monitor.');
        return;
      }

      setIsBulkActionRunning(true);
      setMonitorActionFeedback(null);

      const actionRunner = async (monitorId: string): Promise<void> => {
        if (option === 'pause') {
          await pauseMonitor(monitorId, authToken);
          return;
        }
        if (option === 'resume') {
          await resumeMonitor(monitorId, authToken);
          return;
        }
        if (option === 'delete') {
          await deleteMonitor(monitorId, authToken);
          return;
        }

        await checkMonitor(monitorId, authToken);
      };

      const results = await Promise.allSettled(monitorIds.map((monitorId) => actionRunner(monitorId)));
      const rejectedResults = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      const successfulCount = results.length - rejectedResults.length;
      const failedCount = rejectedResults.length;
      const hasUnauthorizedError = rejectedResults.some(
        (result) => isApiError(result.reason) && result.reason.status === 401,
      );

      if (hasUnauthorizedError) {
        setIsBulkActionRunning(false);
        clearSessionAndRedirectToLogin();
        return;
      }

      if (option === 'delete' && successfulCount > 0) {
        setSelectedMonitorIds((previousIds) => previousIds.filter((monitorId) => !monitorIds.includes(monitorId)));
      }

      await refreshMonitors(authToken);
      setIsBulkActionsMenuOpen(false);
      setIsBulkActionRunning(false);

      if (failedCount === 0) {
        const optionLabel = bulkActionOptionLabels[option].toLowerCase();
        setMonitorActionFeedback(`${successfulCount} monitor(s) ${optionLabel} avec succes.`);
        return;
      }

      setMonitorActionFeedback(
        `${successfulCount}/${monitorIds.length} action(s) reussie(s), ${failedCount} echec(s).`,
      );
    },
    [authToken, clearSessionAndRedirectToLogin, refreshMonitors],
  );

  const handleBulkActionOptionSelect = useCallback(
    async (option: BulkActionOption) => {
      const uniqueMonitorIds = Array.from(new Set(selectedMonitorIds));
      await runBulkMonitorAction(option, uniqueMonitorIds);
    },
    [runBulkMonitorAction, selectedMonitorIds],
  );

  const handleTopActionClick = useCallback(
    async (option: BulkActionOption) => {
      const sourceIds = selectedMonitorIds.length > 0 ? selectedMonitorIds : displayedMonitors.map((monitor) => monitor.id);
      const uniqueMonitorIds = Array.from(new Set(sourceIds));
      await runBulkMonitorAction(option, uniqueMonitorIds);
    },
    [displayedMonitors, runBulkMonitorAction, selectedMonitorIds],
  );

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
        onSignIn={handleSignIn}
        onForgotPassword={() => {
          setPasswordResetContext(null);
          navigateTo('/forgot-password');
        }}
      />
    );
  }

  if (authRoute === 'confirmation-code') {
    return (
      <ConfirmationCodePage
        email={passwordResetContext?.email}
        onBack={() => {
          navigateTo('/forgot-password');
        }}
        onContinue={handleConfirmPasswordReset}
        onResend={handleResendPasswordResetCode}
      />
    );
  }

  if (authRoute === 'forgot-password') {
    return (
      <ForgotPasswordPage
        onResetPassword={handleRequestPasswordReset}
      />
    );
  }

  if (authRoute === 'accept-invitation') {
    const invitationToken = new URLSearchParams(window.location.search).get('token');
    return (
      <AcceptInvitationPage
        token={invitationToken}
        onAcceptInvitation={handleAcceptInvitation}
        onBackToLogin={() => {
          navigateTo('/login');
        }}
      />
    );
  }

  // Public status page is rendered outside the app shell (no sidebar/navbar).
  if (isStatusPagesPage && selectedStatusPageId && isStatusPagePublicView) {
    return (
      <StatusPagePublicPage
        statusPageId={selectedStatusPageId}
        onBackToStatusPages={() => {
          navigateTo('/status-pages');
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
          <div className="profile-avatar">{userInitials}</div>
          <div className="profile-copy">
            <strong>{currentUser?.name ?? 'Guest'}</strong>
            {currentUser?.email ? <span>{currentUser.email}</span> : null}
          </div>
          <button
            className="logout-button"
            aria-label="Go to login"
            onClick={() => {
              clearSessionAndRedirectToLogin();
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
          key={`edit-${teamMonitor.id}-integrations`}
          monitor={teamMonitor}
          initialSection="integrations"
          onBack={() => {
            navigateTo('/monitoring');
          }}
          onOpenMonitorDetails={() => {
            navigateTo(`/monitoring/${teamMonitor.id}/edit`);
          }}
          onOpenIntegrationsTeam={() => {
            navigateTo(`/monitoring/${teamMonitor.id}/integrations-team`);
          }}
          onManageTeam={() => {
            navigateTo('/team-members');
          }}
          onSaveChanges={(payload) => handleUpdateMonitor(teamMonitor.id, payload)}
          onOpenMaintenanceInfo={() => {
            navigateTo('/maintenance');
          }}
        />
      ) : isIntegrationsPage ? (
        <IntegrationsApiPage />
      ) : editingMonitor ? (
        <EditMonitorPage
          key={`edit-${editingMonitor.id}-details`}
          monitor={editingMonitor}
          initialSection="details"
          onBack={() => {
            navigateTo(`/monitoring/${editingMonitor.id}`);
          }}
          onOpenMonitorDetails={() => {
            navigateTo(`/monitoring/${editingMonitor.id}/edit`);
          }}
          onOpenIntegrationsTeam={() => {
            navigateTo(`/monitoring/${editingMonitor.id}/integrations-team`);
          }}
          onManageTeam={() => {
            navigateTo('/team-members');
          }}
          onSaveChanges={(payload) => handleUpdateMonitor(editingMonitor.id, payload)}
          onOpenMaintenanceInfo={() => {
            navigateTo('/maintenance');
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
          isActionPending={isBulkActionRunning}
          onRunCheck={() => {
            void runBulkMonitorAction('start', [selectedMonitor.id]);
          }}
          onPause={() => {
            void runBulkMonitorAction('pause', [selectedMonitor.id]);
          }}
          onResume={() => {
            void runBulkMonitorAction('resume', [selectedMonitor.id]);
          }}
          onDelete={() => {
            void (async () => {
              await runBulkMonitorAction('delete', [selectedMonitor.id]);
              navigateTo('/monitoring');
            })();
          }}
          onExportLogs={() => {
            navigateTo('/incidents');
          }}
          onOpenNotificationSettings={() => {
            navigateTo(`/monitoring/${selectedMonitor.id}/integrations-team`);
          }}
          onOpenMaintenanceInfo={() => {
            navigateTo('/maintenance');
          }}
        />
      ) : isCreatingMonitor ? (
        <NewMonitorPage
          onBack={() => {
            navigateTo('/monitoring');
          }}
          onCreateMonitor={handleCreateMonitor}
        />
      ) : isIncidentsPage ? (
        <div className="panel-main">
          <IncidentsPage
            onOpenMonitor={(monitorId) => {
              navigateTo(`/monitoring/${monitorId}`);
            }}
          />
        </div>
      ) : isStatusPagesPage ? selectedStatusPageId ? (
        (
          <StatusPageInfoPage
            statusPageId={selectedStatusPageId}
            onBackToMonitoring={() => {
              navigateTo('/monitoring');
            }}
            onBackToStatusPages={() => {
              navigateTo('/status-pages');
            }}
            onCreateMonitor={() => {
              navigateTo('/monitoring/new');
            }}
            onOpenIntegrationsTeam={() => {
              navigateTo('/integrations-team');
            }}
            onOpenMaintenanceInfo={() => {
              navigateTo('/maintenance');
            }}
          />
        )
      ) : (
        <div className="panel-main">
          <StatusPagesPage
            onCreateStatusPage={() => {
              navigateTo('/status-pages/new');
            }}
            onOpenStatusPage={(statusPageId) => {
              navigateTo(`/status-pages/${statusPageId}`);
            }}
            onPreviewStatusPage={(statusPageId) => {
              navigateTo(`/status-pages/${statusPageId}/public`);
            }}
          />
        </div>
      ) : isTeamMembersPage ? (
        teamMembersSubPage === 'invite' && isCurrentUserAdmin ? (
          <InviteTeamMemberPage
            monitorOptions={monitorRows.map((monitor) => ({ id: monitor.id, name: monitor.name }))}
            onInviteTeam={handleInviteTeamMember}
          />
        ) : teamMembersSubPage === 'manage' && isCurrentUserAdmin ? (
          <TeamMembersManagePage
            users={teamMembers}
            invitations={teamInvitations}
            currentUserId={currentUser?.id}
            onBack={() => {
              navigateTo('/team-members');
            }}
            onInviteTeam={() => {
              navigateTo('/team-members/invite');
            }}
            onDeleteUser={handleDeleteTeamUser}
            onChangeUserRole={handleTeamUserRoleChange}
            onToggleUserActive={handleTeamUserActiveToggle}
            onDeleteInvitation={handleDeleteInvitation}
          />
        ) : (
          <TeamMembersPage
            canManageMembers={isCurrentUserAdmin}
            onInviteTeam={
              isCurrentUserAdmin
                ? () => {
                    navigateTo('/team-members/invite');
                  }
                : undefined
            }
            onManageUsers={
              isCurrentUserAdmin
                ? () => {
                    navigateTo('/team-members/manage');
                  }
                : undefined
            }
          />
        )
      ) : isMaintenancePage ? (
        <MaintenancePage
          onCreateMonitor={() => {
            navigateTo('/monitoring/new');
          }}
          onOpenMaintenanceWindows={() => {
            navigateTo('/maintenance/windows');
          }}
          onBackToMaintenanceOverview={() => {
            navigateTo('/maintenance');
          }}
          showWindowsOnly={maintenanceSubPage === 'windows'}
        />
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
                          onClick={() => void handleBulkActionOptionSelect(bulkOption)}
                          className={bulkOption === 'delete' ? 'delete' : ''}
                          disabled={isBulkActionRunning}
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
                  <input
                    type="text"
                    placeholder="Search by name or url"
                    value={monitorSearchQuery}
                    onChange={(event) => setMonitorSearchQuery(event.target.value)}
                  />
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
                  <button className="action-button" type="button" onClick={() => void handleTopActionClick('start')} disabled={isBulkActionRunning}>
                    <span className="action-icon-circle" aria-hidden="true">
                      <Play size={11} />
                    </span>
                    <span>Start</span>
                  </button>
                  <button className="action-button" type="button" onClick={() => void handleTopActionClick('pause')} disabled={isBulkActionRunning}>
                    <span className="action-icon-circle" aria-hidden="true">
                      <Pause size={11} />
                    </span>
                    <span>Pause</span>
                  </button>
                  <button className="action-button" type="button" onClick={() => void handleTopActionClick('delete')} disabled={isBulkActionRunning}>
                    <span className="action-icon-circle" aria-hidden="true">
                      <Trash2 size={11} />
                    </span>
                    <span>Delete</span>
                  </button>
                  <button className="action-button" type="button" onClick={() => void handleTopActionClick('resume')} disabled={isBulkActionRunning}>
                    <span className="action-icon-circle" aria-hidden="true">
                      <RotateCcw size={11} />
                    </span>
                    <span>Resume</span>
                  </button>
                </div>
              </div>

              {monitorActionFeedback ? <p className="monitor-table-feedback">{monitorActionFeedback}</p> : null}

              <div className="monitor-table">
                {isMonitorsLoading ? (
                  <p className="monitor-table-feedback">Chargement des monitors...</p>
                ) : monitorLoadError ? (
                  <p className="monitor-table-feedback error">{monitorLoadError}</p>
                ) : displayedMonitors.length === 0 ? (
                  <p className="monitor-table-feedback">Aucun monitor disponible.</p>
                ) : (
                  displayedMonitors.map((monitor) => (
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
                  ))
                )}
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
              <p className="status-hint">Using {monitorRows.length} of 50 monitors</p>
            </section>

            <section className="status-card">
              <h3>Last 24 hours</h3>
              <div className="hours-row">
                <div className="hours-col">
                  <p className="hours-uptime">{last24HoursStats.overallUptime}</p>
                  <span className="hours-label">Overall uptime</span>
                </div>
                <div className="hours-col">
                  <p className="hours-value">{last24HoursStats.incidents}</p>
                  <span className="hours-label">Incidents</span>
                </div>
              </div>
              <div className="hours-row">
                <div className="hours-col">
                  <p className="hours-meta">{last24HoursStats.withoutIncident}</p>
                  <span className="hours-label">Without incid.</span>
                </div>
                <div className="hours-col">
                  <p className="hours-value">{last24HoursStats.affectedMonitors}</p>
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
                    <option value="paused">Paused / Pending</option>
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
