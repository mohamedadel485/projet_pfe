import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CiSliderHorizontal } from "react-icons/ci";
import type { LucideIcon } from "lucide-react";
import ExclamationHexagonIcon from "./ExclamationHexagonIcon";
import monitoringMenuIcon from "./images/m1.png";
import AssistantChatbot from "./components/assistant-chat/AssistantChatbot";
import ChatbotPage from "./pages/chatbot/ChatbotPage";
import EditMonitorPage from "./pages/edit-monitor/EditMonitorPage";
import EditProfilePage from "./pages/profile/EditProfilePage";
import SettingsPage from "./pages/settings/SettingsPage";
import IncidentsPage from "./pages/incidents/IncidentsPage";
import IntegrationsApiPage from "./pages/integrations-api/IntegrationsApiPage";
import AcceptInvitationPage from "./pages/login/AcceptInvitationPage";
import ConfirmationCodePage from "./pages/login/ConfirmationCodePage";
import ForgotPasswordPage from "./pages/login/ForgotPasswordPage";
import LoginPage, { type LoginSubmissionResult } from "./pages/login/LoginPage";
import MaintenancePage from "./pages/maintenance/MaintenancePage";
import MonitorDetailsPage from "./pages/monitor-details/MonitorDetailsPage";
import NewMonitorPage from "./pages/new-monitor/NewMonitorPage";
import MonitorWizardPage, {
  type MonitorWizardSubmission,
} from "./pages/monitor-wizard/MonitorWizardPage";
import BulkUploadPage, {
  type BulkUploadSubmission,
} from "./pages/bulk-upload/BulkUploadPage";
import StatusPageInfoPage from "./pages/status/StatusPageInfoPage";
import StatusPageMonitorsPage from "./pages/status/StatusPageMonitorsPage";
import StatusPagePublicPage from "./pages/status/StatusPagePublicPage";
import StatusPagesPage from "./pages/status/StatusPagesPage";
import InviteTeamMemberPage from "./pages/team-members/InviteTeamMemberPage";
import TeamMembersManagePage from "./pages/team-members/TeamMembersManagePage";
import AccountRequestsPage from "./pages/team-members/AccountRequestsPage";
import TeamMembersManagementPage from "./pages/team-members/TeamMembersManagementPage";
import TeamMembersPage from "./pages/team-members/TeamMembersPage";
import {
  COOKIE_AUTH_SENTINEL,
  clearStoredAuthToken,
  acceptInvitation,
  checkMonitor,
  createInvitation,
  createIntegration,
  createMonitor,
  fetchMonitorLogs,
  logout,
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
  isApiError,
  login,
  pauseMonitor,
  removeMonitorShare,
  requestAccountCreation,
  getAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
  deleteAccountRequests,
  requestPasswordReset,
  resetPasswordWithCode,
  resumeMonitor,
  saveAuthToken,
  shareMonitorWithUser,
  resolveAvatarUrl,
  type CreateIntegrationInput,
  type CreateMonitorInput,
  type BackendMonitor,
  type BackendMonitorLog,
  type AuthUser,
  type EditableUserRole,
  type MonitorIpVersion,
  type UserRole,
} from "./lib/api";
import {
  HISTORY_BAR_COUNT,
  MINUTES_PER_HISTORY_BAR,
  buildMonitorHistoryBars,
  parseUptimePercent,
  type HistoryBarState as SharedHistoryBarState,
} from "./lib/monitorHistory";
import { isAdminRole, isUserRole } from "./lib/roles";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Mail,
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
} from "lucide-react";

type HistoryState = SharedHistoryBarState;
type MenuLabel =
  | "Monitoring"
  | "Incidents"
  | "Status pages"
  | "Maintenance"
  | "Team members"
  | "Integrations & API"
  | "Chatbot";

interface MenuItem {
  label: MenuLabel;
  icon?: LucideIcon;
  materialIcon?: string;
  customIcon?: "incidentHexagon" | "monitoringRadar";
}

interface MonitorRow {
  id: string;
  name: string;
  protocol: string;
  url?: string;
  sharedUserIds?: string[];
  domainExpiryMode?: "enabled" | "disabled";
  domainExpiryAt?: string;
  domainExpiryCheckedAt?: string;
  domainExpiryError?: string;
  sslExpiryMode?: "enabled" | "disabled";
  sslExpiryAt?: string;
  sslExpiryCheckedAt?: string;
  sslExpiryError?: string;
  tags: string[];
  uptimeLabel: string;
  interval: string;
  uptime: string;
  state: "up" | "down" | "paused" | "pending";
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
  name?: string;
  email: string;
  monitorIds: string[];
  status: "pending" | "accepted" | "expired";
  createdAt: string;
  expiresAt: string;
}

type IntegrationsSubPage = "api" | "team";
type TeamMembersSubPage =
  | "overview"
  | "invite"
  | "manage"
  | "management"
  | "requests";
type MaintenanceSubPage = "overview" | "windows";
type StatusPageEditorView = "settings" | "monitors";
type AuthRoute =
  | "login"
  | "confirmation-code"
  | "forgot-password"
  | "accept-invitation"
  | null;
type PasswordResetContext = {
  email: string;
  newPassword?: string;
  code?: string;
  timestamp?: number;
} | null;
type NewMonitorOption = "single" | "wizard" | "bulk";
type MonitorIpVersionUI =
  | "IPv4 / IPv6 (IPv4 Priority)"
  | "IPv6 / IPv4 (IPv6 Priority)"
  | "IPv4 only"
  | "IPv6 only";

// Fonction de conversion des valeurs API vers les valeurs UI
const convertMonitorIpVersionToUI = (
  apiVersion?: MonitorIpVersion | "ipv4" | "ipv6" | "auto",
): MonitorIpVersionUI | undefined => {
  if (!apiVersion) return undefined;
  switch (apiVersion) {
    case "IPv4 / IPv6 (IPv4 Priority)":
    case "ipv4":
      return "IPv4 / IPv6 (IPv4 Priority)";
    case "IPv6 / IPv4 (IPv6 Priority)":
    case "ipv6":
      return "IPv6 / IPv4 (IPv6 Priority)";
    case "IPv4 only":
      return "IPv4 only";
    case "IPv6 only":
      return "IPv6 only";
    case "auto":
      return "IPv4 / IPv6 (IPv4 Priority)";
    default:
      return "IPv4 / IPv6 (IPv4 Priority)";
  }
};

type MonitorDraft = {
  name: string;
  protocol: "http" | "https" | "ws" | "wss";
  url: string;
  intervalSeconds?: number;
  timeoutSeconds?: number;
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  domainExpiryMode?: "enabled" | "disabled";
  sslExpiryMode?: "enabled" | "disabled";
  sslCheckMode?: "enabled" | "disabled";
  tagsText?: string;
  slowResponseAlert?: boolean;
  slowResponseThresholdMs?: number;
  ipVersion?: MonitorIpVersion;
  followRedirections?: boolean;
  authType?: "none" | "basic" | "bearer";
  authUsername?: string;
  authPassword?: string;
  requestBody?: string;
  sendAsJson?: boolean;
  headerKey?: string;
  headerValue?: string;
  upStatusCodeGroups?: Array<"2xx" | "3xx">;
};
type MonitorFilterStatus = "none" | "up" | "down" | "paused";
type MonitorSortOption =
  | "down-first"
  | "up-first"
  | "paused-first"
  | "a-z"
  | "newest-first";
type BulkActionOption = "start" | "pause" | "resume" | "delete";
type MonitorBatchSubmission = {
  monitors: Array<{
    name: string;
    url: string;
    type: CreateMonitorInput["type"];
    interval: number;
    timeout: number;
    httpMethod: NonNullable<CreateMonitorInput["httpMethod"]>;
  }>;
  inviteEmails: string[];
  integration: CreateIntegrationInput | null;
};

const monitorSortOptionLabels: Record<MonitorSortOption, string> = {
  "down-first": "Down first",
  "up-first": "Up first",
  "paused-first": "Paused first",
  "a-z": "A -> Z",
  "newest-first": "Newest first",
};

const monitorSortOptions: MonitorSortOption[] = [
  "down-first",
  "up-first",
  "paused-first",
  "a-z",
  "newest-first",
];
const monitorTagOptions = ["All tags", "Website", "API", "Core", "Interface"];
const bulkActionOptions: BulkActionOption[] = [
  "start",
  "pause",
  "resume",
  "delete",
];
const bulkActionOptionLabels: Record<BulkActionOption, string> = {
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  delete: "Delete",
};

const menuItems: MenuItem[] = [
  { label: "Monitoring", customIcon: "monitoringRadar" },
  { label: "Incidents", customIcon: "incidentHexagon" },
  { label: "Status pages", materialIcon: "sensors" },
  { label: "Maintenance", icon: Wrench },
  { label: "Team members", icon: Users },
  { label: "Integrations & API", materialIcon: "graph_1" },
];

const routeByMenuLabel: Record<MenuLabel, string> = {
  Monitoring: "/monitoring",
  Incidents: "/incidents",
  "Status pages": "/status-pages",
  Maintenance: "/maintenance",
  "Team members": "/team-members",
  "Integrations & API": "/integrations-api",
  Chatbot: "/chatbot",
};

const USER_CACHE_KEY = "uptimewarden_cached_user";
const MONITOR_LOGS_CACHE_TTL_MS = 2 * 60 * 1000;
const MONITOR_LOGS_PREFETCH_LIMIT = 12;

const readCachedUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.id !== "string" || typeof parsed.email !== "string")
      return null;
    if (!isUserRole(parsed.role)) return null;
    const name = typeof parsed.name === "string" ? parsed.name : parsed.email;
    return {
      id: parsed.id,
      email: parsed.email,
      name,
      role: parsed.role,
      avatar: typeof parsed.avatar === "string" ? parsed.avatar : undefined,
    };
  } catch {
    return null;
  }
};

const writeCachedUser = (user: AuthUser | null): void => {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
};

const normalizePathname = (pathname: string): string => {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
};

const isPublicAuthPath = (pathname: string): boolean =>
  pathname === "/login" ||
  pathname === "/confirmation-code" ||
  pathname === "/forgot-password" ||
  pathname === "/accept-invitation";

const isPublicStatusPagePath = (pathname: string): boolean => {
  const normalizedPath = normalizePathname(pathname);
  const segments = normalizedPath.split("/").filter(Boolean);

  return (
    segments.length === 3 &&
    segments[0] === "status-pages" &&
    segments[2] === "public"
  );
};

const getInvitationTokenFromSearch = (): string | null => {
  if (typeof window === "undefined") return null;
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) return null;
  const trimmedToken = token.trim();
  return trimmedToken === "" ? null : trimmedToken;
};

const buildAcceptInvitationPath = (token: string): string =>
  `/accept-invitation?token=${encodeURIComponent(token)}`;

const isInvitationAcceptanceLocation = (pathname: string): boolean => {
  const normalizedPath = normalizePathname(pathname);
  const invitationToken = getInvitationTokenFromSearch();
  return Boolean(
    invitationToken &&
    (normalizedPath === "/accept-invitation" || normalizedPath === "/login"),
  );
};

const getAuthRouteFromLocation = (pathname: string): AuthRoute => {
  const normalizedPath = normalizePathname(pathname);
  const invitationToken = getInvitationTokenFromSearch();

  if (normalizedPath === "/login" && invitationToken) {
    return "accept-invitation";
  }

  if (normalizedPath === "/login") return "login";
  if (normalizedPath === "/confirmation-code") return "confirmation-code";
  if (normalizedPath === "/forgot-password") return "forgot-password";
  if (normalizedPath === "/accept-invitation") return "accept-invitation";

  return null;
};

const isWorkspaceRoute = (pathname: string): boolean =>
  !isPublicAuthPath(pathname) && !isPublicStatusPagePath(pathname);

const formatAppError = (error: unknown, fallback: string): string => {
  if (isApiError(error)) {
    return error.message || fallback;
  }

  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
};

const getApiErrorCode = (error: unknown): string | undefined => {
  if (!isApiError(error)) return undefined;
  if (!error.payload || typeof error.payload !== "object") return undefined;

  const payload = error.payload as Record<string, unknown>;
  const code = payload.code;
  if (typeof code !== "string") return undefined;

  const normalizedCode = code.trim();
  return normalizedCode === "" ? undefined : normalizedCode;
};

const formatIntervalLabel = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "5 min";
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
};

const formatHoursAndMinutes = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes < 0) return "0h, 0m";
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const mins = roundedMinutes % 60;
  return `${hours}h, ${mins}m`;
};

const mapBackendMonitorToRow = (
  monitor: BackendMonitor,
  logsNewestFirst: BackendMonitorLog[] = [],
): MonitorRow => {
  const state: MonitorRow["state"] = monitor.status;
  const statusLabel =
    monitor.status === "up"
      ? "Up"
      : monitor.status === "down"
        ? "Down"
        : monitor.status === "paused"
          ? "Paused"
          : "Pending";
  const uptimeValue = Number.isFinite(monitor.uptime) ? monitor.uptime : 0;

  return {
    id: monitor._id,
    name: monitor.name,
    protocol: monitor.type.toUpperCase(),
    url: monitor.url,
    sharedUserIds: Array.isArray(monitor.sharedWith)
      ? monitor.sharedWith.filter(
          (userId): userId is string => typeof userId === "string",
        )
      : [],
    domainExpiryMode: monitor.domainExpiryMode,
    domainExpiryAt: monitor.domainExpiryAt,
    domainExpiryCheckedAt: monitor.domainExpiryCheckedAt,
    domainExpiryError: monitor.domainExpiryError,
    sslExpiryMode: monitor.sslExpiryMode,
    sslExpiryAt: monitor.sslExpiryAt,
    sslExpiryCheckedAt: monitor.sslExpiryCheckedAt,
    sslExpiryError: monitor.sslExpiryError,
    tags:
      monitor.type === "ws" || monitor.type === "wss" ? ["API"] : ["Website"],
    uptimeLabel: statusLabel,
    interval: formatIntervalLabel(monitor.interval),
    uptime: `${uptimeValue.toFixed(3)}%`,
    state,
    history: buildMonitorHistoryBars({
      uptime: uptimeValue,
      status: monitor.status,
      logsNewestFirst,
      barCount: HISTORY_BAR_COUNT,
    }),
    detailsEnabled: true,
  };
};

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [monitorSortOption, setMonitorSortOption] =
    useState<MonitorSortOption>("down-first");
  const [isMonitorSortMenuOpen, setIsMonitorSortMenuOpen] = useState(false);
  const [selectedMonitorTag, setSelectedMonitorTag] = useState("All tags");
  const [isMonitorTagMenuOpen, setIsMonitorTagMenuOpen] = useState(false);
  const [isBulkActionsMenuOpen, setIsBulkActionsMenuOpen] = useState(false);
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(
    null,
  );
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);
  const [selectedStatusPageId, setSelectedStatusPageId] = useState<
    string | null
  >(null);
  const [isStatusPagePublicView, setIsStatusPagePublicView] = useState(false);
  const [statusPageEditorView, setStatusPageEditorView] =
    useState<StatusPageEditorView>("settings");
  const [isCreatingMonitor, setIsCreatingMonitor] = useState(false);
  const [newMonitorDraft, setNewMonitorDraft] = useState<MonitorDraft | null>(
    null,
  );
  const [isMonitorWizardOpen, setIsMonitorWizardOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMenuLabel, setActiveMenuLabel] = useState(menuItems[0].label);
  const [integrationsSubPage, setIntegrationsSubPage] =
    useState<IntegrationsSubPage>("api");
  const [teamMembersSubPage, setTeamMembersSubPage] =
    useState<TeamMembersSubPage>("overview");
  const [maintenanceSubPage, setMaintenanceSubPage] =
    useState<MaintenanceSubPage>("overview");
  const [authRoute, setAuthRoute] = useState<AuthRoute>(() =>
    typeof window === "undefined"
      ? null
      : getAuthRouteFromLocation(window.location.pathname),
  );
  const [passwordResetContext, setPasswordResetContext] =
    useState<PasswordResetContext>(null);
  const [newMonitorMenuOpen, setNewMonitorMenuOpen] = useState(false);
  const [isMonitorFilterOpen, setIsMonitorFilterOpen] = useState(false);
  const [appliedMonitorFilterStatus, setAppliedMonitorFilterStatus] =
    useState<MonitorFilterStatus>("none");
  const [appliedMonitorTagQuery, setAppliedMonitorTagQuery] = useState("");
  const [draftMonitorFilterStatus, setDraftMonitorFilterStatus] =
    useState<MonitorFilterStatus>("none");
  const [draftMonitorTagQuery, setDraftMonitorTagQuery] = useState("");
  const [monitorSearchQuery, setMonitorSearchQuery] = useState("");
  const [sidebarTogglePending, setSidebarTogglePending] = useState(false);
  const sidebarToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const newMonitorMenuRef = useRef<HTMLDivElement | null>(null);
  const monitorSortMenuRef = useRef<HTMLDivElement | null>(null);
  const monitorTagMenuRef = useRef<HTMLDivElement | null>(null);
  const bulkActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const monitorLogsCacheRef = useRef<
    Map<string, { fetchedAt: number; logs: BackendMonitorLog[] }>
  >(new Map());
  const [authToken, setAuthToken] = useState<string | null>(
    COOKIE_AUTH_SENTINEL,
  );
  const [isAuthBootstrapComplete, setIsAuthBootstrapComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() =>
    readCachedUser(),
  );
  const [monitorRows, setMonitorRows] = useState<MonitorRow[]>([]);
  const [isMonitorsLoading, setIsMonitorsLoading] = useState(false);
  const [monitorLoadError, setMonitorLoadError] = useState<string | null>(null);
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);
  const [monitorActionFeedback, setMonitorActionFeedback] = useState<
    string | null
  >(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberEntry[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitationEntry[]>(
    [],
  );

  const currentStatus = useMemo(() => {
    const down = monitorRows.filter(
      (monitor) => monitor.state === "down",
    ).length;
    const up = monitorRows.filter((monitor) => monitor.state === "up").length;
    const paused = monitorRows.filter(
      (monitor) => monitor.state === "paused" || monitor.state === "pending",
    ).length;

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
        overallUptime: "-",
        incidents: 0,
        withoutIncident: "-",
        affectedMonitors: 0,
      };
    }

    const overallUptimeValue =
      monitorRows.reduce(
        (sum, monitor) => sum + parseUptimePercent(monitor.uptime),
        0,
      ) / monitorRows.length;

    let incidents = 0;
    let affectedMonitors = 0;

    for (const monitor of monitorRows) {
      let hadDown = false;
      let previousWasDown = false;

      for (const state of monitor.history) {
        const isDown = state === "down";
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
      const anyDownAtBar = monitorRows.some(
        (monitor) => monitor.history[index] === "down",
      );
      if (anyDownAtBar) break;
      barsWithoutIncident += 1;
    }

    const withoutIncident = formatHoursAndMinutes(
      barsWithoutIncident * MINUTES_PER_HISTORY_BAR,
    );

    return {
      overallUptime: `${overallUptimeValue.toFixed(3)}%`,
      incidents,
      withoutIncident,
      affectedMonitors,
    };
  }, [monitorRows]);

  const displayedMonitors = useMemo(() => {
    const statusFilteredRows =
      appliedMonitorFilterStatus === "none"
        ? monitorRows
        : monitorRows.filter((monitor) =>
            appliedMonitorFilterStatus === "paused"
              ? monitor.state === "paused" || monitor.state === "pending"
              : monitor.state === appliedMonitorFilterStatus,
          );

    const tagFilteredRows = appliedMonitorTagQuery.trim()
      ? statusFilteredRows.filter((monitor) =>
          monitor.name
            .toLowerCase()
            .includes(appliedMonitorTagQuery.trim().toLowerCase()),
        )
      : statusFilteredRows;

    const tagMenuFilteredRows =
      selectedMonitorTag === "All tags"
        ? tagFilteredRows
        : tagFilteredRows.filter((monitor) =>
            monitor.tags.includes(selectedMonitorTag),
          );

    const normalizedSearchQuery = monitorSearchQuery.trim().toLowerCase();
    const searchFilteredRows =
      normalizedSearchQuery.length === 0
        ? tagMenuFilteredRows
        : tagMenuFilteredRows.filter((monitor) => {
            const searchableName = monitor.name.toLowerCase();
            const searchableUrl = monitor.url?.toLowerCase() ?? "";
            return (
              searchableName.includes(normalizedSearchQuery) ||
              searchableUrl.includes(normalizedSearchQuery)
            );
          });

    if (monitorSortOption === "down-first") {
      const sortRank: Record<MonitorRow["state"], number> = {
        down: 0,
        pending: 1,
        paused: 2,
        up: 3,
      };
      return [...searchFilteredRows].sort((a, b) => {
        const rankDelta = sortRank[a.state] - sortRank[b.state];
        if (rankDelta !== 0) return rankDelta;
        return a.name.localeCompare(b.name);
      });
    }

    if (monitorSortOption === "up-first") {
      const sortRank: Record<MonitorRow["state"], number> = {
        up: 0,
        pending: 1,
        paused: 2,
        down: 3,
      };
      return [...searchFilteredRows].sort((a, b) => {
        const rankDelta = sortRank[a.state] - sortRank[b.state];
        if (rankDelta !== 0) return rankDelta;
        return a.name.localeCompare(b.name);
      });
    }

    if (monitorSortOption === "a-z") {
      return [...searchFilteredRows].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    if (monitorSortOption === "newest-first") {
      return [...searchFilteredRows].reverse();
    }

    const sortRank: Record<MonitorRow["state"], number> = {
      paused: 0,
      pending: 1,
      down: 2,
      up: 3,
    };
    return [...searchFilteredRows].sort((a, b) => {
      const rankDelta = sortRank[a.state] - sortRank[b.state];
      if (rankDelta !== 0) return rankDelta;
      return a.name.localeCompare(b.name);
    });
  }, [
    monitorRows,
    monitorSortOption,
    selectedMonitorTag,
    appliedMonitorFilterStatus,
    appliedMonitorTagQuery,
    monitorSearchQuery,
  ]);

  const hasPendingMonitorFilterChanges =
    draftMonitorFilterStatus !== appliedMonitorFilterStatus ||
    draftMonitorTagQuery.trim() !== appliedMonitorTagQuery.trim();

  const hasActiveMonitorFilters =
    appliedMonitorFilterStatus !== "none" ||
    appliedMonitorTagQuery.trim().length > 0 ||
    selectedMonitorTag !== "All tags";
  const selectedMonitorsCount = selectedMonitorIds.length;
  const areAllMonitorsSelected =
    selectedMonitorIds.length === monitorRows.length && monitorRows.length > 0;

  const selectedMonitor = useMemo(
    () =>
      monitorRows.find((monitor) => monitor.id === selectedMonitorId) ?? null,
    [monitorRows, selectedMonitorId],
  );
  const editingMonitor = useMemo(
    () =>
      monitorRows.find((monitor) => monitor.id === editingMonitorId) ?? null,
    [monitorRows, editingMonitorId],
  );
  const teamMonitor = editingMonitor;
  const isIntegrationsPage = activeMenuLabel === "Integrations & API";
  const isIncidentsPage = activeMenuLabel === "Incidents";
  const isMaintenancePage = activeMenuLabel === "Maintenance";
  const isStatusPagesPage = activeMenuLabel === "Status pages";
  const isTeamMembersPage = activeMenuLabel === "Team members";
  const isChatbotPage = activeMenuLabel === "Chatbot";
  const showAssistantChatbot =
    isAuthBootstrapComplete &&
    Boolean(authToken) &&
    authRoute === null &&
    !isStatusPagePublicView &&
    !isChatbotPage;
  const isCurrentUserAdmin = Boolean(
    isAuthBootstrapComplete && isAdminRole(currentUser?.role),
  );
  const isCurrentUserSuperAdmin = Boolean(
    isAuthBootstrapComplete && currentUser?.role === "super_admin",
  );
  const canCurrentUserInviteTeam = Boolean(authToken && isCurrentUserAdmin);
  const userInitials = useMemo(() => {
    const label = currentUser?.name ?? currentUser?.email ?? "";
    if (!label) return "";
    return label
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((value) => value.charAt(0).toUpperCase())
      .join("");
  }, [currentUser]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // États pour les modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isUsersManageModalOpen, setIsUsersManageModalOpen] = useState(false);

  // État pour les demandes de création de compte
  const [accountRequests, setAccountRequests] = useState<
    Array<{
      id: string;
      email: string;
      name: string;
      message?: string;
      createdAt: string;
      status: "pending" | "approved" | "rejected";
    }>
  >([]);
  const [isLoadingAccountRequests, setIsLoadingAccountRequests] =
    useState(false);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("click", onDocClick);
    // cleanup key listener also
    // (note: return only supports one cleanup, so re-add full cleanup)
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Gestion de la touche Escape pour fermer les modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsUsersManageModalOpen(false);
      }
    };
    if (isProfileModalOpen || isSettingsModalOpen || isUsersManageModalOpen) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [isProfileModalOpen, isSettingsModalOpen, isUsersManageModalOpen]);

  const isUserLoading = Boolean(authToken) && !isAuthBootstrapComplete;
  const profileName = isUserLoading
    ? "Loading..."
    : currentUser?.name || currentUser?.email || "";
  const profileEmail =
    !isUserLoading && currentUser?.email && currentUser?.name
      ? currentUser.email
      : null;
  const profileAvatarUrl = currentUser?.avatar
    ? resolveAvatarUrl(currentUser.avatar)
    : undefined;
  const isTeamMembersManagementPage =
    isTeamMembersPage &&
    (teamMembersSubPage === "management" || teamMembersSubPage === "requests");
  const appShellClasses = [
    "app-shell",
    isIncidentsPage ? "incidents-view" : "",
    isStatusPagesPage ? "status-pages-view" : "",
    isChatbotPage ? "chatbot-view" : "",
    isTeamMembersManagementPage ? "team-members-management-view" : "",
    mobileMenuOpen ? "menu-open" : "",
    sidebarCollapsed ? "sidebar-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const applyRoute = useCallback((rawPathname: string) => {
    const pathname = normalizePathname(rawPathname);
    const segments = pathname.split("/").filter(Boolean);
    const invitationToken = getInvitationTokenFromSearch();

    let nextMenuLabel: MenuLabel = "Monitoring";
    let nextIntegrationsSubPage: IntegrationsSubPage = "api";
    let nextTeamMembersSubPage: TeamMembersSubPage = "overview";
    let nextMaintenanceSubPage: MaintenanceSubPage = "overview";
    let nextAuthRoute: AuthRoute = null;
    let nextSelectedMonitorId: string | null = null;
    let nextEditingMonitorId: string | null = null;
    let nextSelectedStatusPageId: string | null = null;
    let nextIsStatusPagePublicView = false;
    let nextStatusPageEditorView: StatusPageEditorView = "settings";
    let nextIsCreatingMonitor = false;
    let nextIsMonitorWizardOpen = false;
    let nextIsBulkUploadOpen = false;

    if (pathname === "/login" && invitationToken) {
      const canonicalInvitationPath =
        buildAcceptInvitationPath(invitationToken);
      const currentAuthPath = `${pathname}${window.location.search}`;
      if (currentAuthPath !== canonicalInvitationPath) {
        window.history.replaceState({}, "", canonicalInvitationPath);
      }
      nextAuthRoute = "accept-invitation";
    } else if (pathname === "/login") {
      nextAuthRoute = "login";
    } else if (pathname === "/confirmation-code") {
      nextAuthRoute = "confirmation-code";
    } else if (pathname === "/forgot-password") {
      nextAuthRoute = "forgot-password";
    } else if (pathname === "/accept-invitation") {
      nextAuthRoute = "accept-invitation";
    } else if (pathname === "/" || pathname === "/monitoring") {
      nextMenuLabel = "Monitoring";
    } else if (pathname === "/monitoring/new") {
      nextMenuLabel = "Monitoring";
      nextIsCreatingMonitor = true;
    } else if (pathname === "/monitoring/wizard") {
      nextMenuLabel = "Monitoring";
      nextIsMonitorWizardOpen = true;
    } else if (pathname === "/monitoring/bulk") {
      nextMenuLabel = "Monitoring";
      nextIsBulkUploadOpen = true;
    } else if (
      segments.length === 3 &&
      segments[0] === "monitoring" &&
      segments[2] === "edit"
    ) {
      nextMenuLabel = "Monitoring";
      nextEditingMonitorId = segments[1];
    } else if (
      segments.length === 3 &&
      segments[0] === "monitoring" &&
      segments[2] === "integrations-team"
    ) {
      nextMenuLabel = "Monitoring";
      nextIntegrationsSubPage = "team";
      nextEditingMonitorId = segments[1];
    } else if (segments.length === 2 && segments[0] === "monitoring") {
      nextMenuLabel = "Monitoring";
      nextSelectedMonitorId = segments[1];
    } else if (pathname === "/integrations-api") {
      nextMenuLabel = "Integrations & API";
      nextIntegrationsSubPage = "api";
    } else if (pathname === "/integrations-team") {
      nextMenuLabel = "Integrations & API";
      nextIntegrationsSubPage = "api";
    } else if (pathname === "/incidents") {
      nextMenuLabel = "Incidents";
    } else if (
      segments.length === 3 &&
      segments[0] === "status-pages" &&
      segments[2] === "public"
    ) {
      nextMenuLabel = "Status pages";
      nextSelectedStatusPageId = segments[1];
      nextIsStatusPagePublicView = true;
    } else if (
      segments.length === 3 &&
      segments[0] === "status-pages" &&
      segments[2] === "monitors"
    ) {
      nextMenuLabel = "Status pages";
      nextSelectedStatusPageId = segments[1];
      nextStatusPageEditorView = "monitors";
    } else if (segments.length === 2 && segments[0] === "status-pages") {
      nextMenuLabel = "Status pages";
      nextSelectedStatusPageId = segments[1];
      nextStatusPageEditorView = "settings";
    } else if (pathname === "/status-pages") {
      nextMenuLabel = "Status pages";
    } else if (pathname === "/maintenance/windows") {
      nextMenuLabel = "Maintenance";
      nextMaintenanceSubPage = "windows";
    } else if (pathname === "/maintenance") {
      nextMenuLabel = "Maintenance";
    } else if (pathname === "/team-members/invite") {
      nextMenuLabel = "Team members";
      nextTeamMembersSubPage = "invite";
    } else if (pathname === "/team-members/manage") {
      nextMenuLabel = "Team members";
      nextTeamMembersSubPage = "manage";
    } else if (pathname === "/team-members/management") {
      nextMenuLabel = "Team members";
      nextTeamMembersSubPage = "management";
    } else if (pathname === "/team-members/requests") {
      nextMenuLabel = "Team members";
      nextTeamMembersSubPage = "requests";
    } else if (pathname === "/team-members") {
      nextMenuLabel = "Team members";
    } else if (pathname === "/chatbot") {
      nextMenuLabel = "Chatbot";
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
    setStatusPageEditorView(nextStatusPageEditorView);
    setIsCreatingMonitor(nextIsCreatingMonitor);
    setIsMonitorWizardOpen(nextIsMonitorWizardOpen);
    setIsBulkUploadOpen(nextIsBulkUploadOpen);
    setMonitorActionFeedback(null);
  }, []);

  const navigateTo = useCallback(
    (pathname: string, options?: { replace?: boolean; search?: string }) => {
      const normalizedPathname = normalizePathname(pathname);
      const normalizedSearch = options?.search ?? "";
      const nextUrl = `${normalizedPathname}${normalizedSearch}`;
      const currentUrl = `${normalizePathname(window.location.pathname)}${window.location.search}`;

      if (nextUrl !== currentUrl) {
        if (options?.replace) {
          window.history.replaceState({}, "", nextUrl);
        } else {
          window.history.pushState({}, "", nextUrl);
        }
      }

      applyRoute(normalizedPathname);
    },
    [applyRoute],
  );

  const clearLocalSession = useCallback(() => {
    clearStoredAuthToken();
    setIsAuthBootstrapComplete(true);
    setAuthToken(null);
    setCurrentUser(null);
    setMonitorRows([]);
    setTeamMembers([]);
    setTeamInvitations([]);
    setMonitorLoadError(null);
    setSelectedMonitorIds([]);
    setSelectedMonitorId(null);
    setEditingMonitorId(null);
  }, []);

  const clearSessionAndRedirectToLogin = useCallback(() => {
    clearLocalSession();
    setPasswordResetContext(null);
    const pathname = normalizePathname(window.location.pathname);
    const isPublicRoute =
      isPublicAuthPath(pathname) || isPublicStatusPagePath(pathname);

    if (!isPublicRoute) {
      navigateTo("/login", { replace: true });
    }
  }, [clearLocalSession, navigateTo]);

  const refreshMonitors = useCallback(
    async (token: string) => {
      setIsMonitorsLoading(true);
      setMonitorLoadError(null);

      try {
        const response = await fetchMonitors(token);
        const now = Date.now();
        const logsByMonitorId = new Map<string, BackendMonitorLog[]>();
        const monitorIdsInResponse = new Set(
          response.monitors.map((monitor) => monitor._id),
        );

        // Drop stale cache entries for removed monitors.
        for (const monitorId of monitorLogsCacheRef.current.keys()) {
          if (!monitorIdsInResponse.has(monitorId)) {
            monitorLogsCacheRef.current.delete(monitorId);
          }
        }

        // Reuse fresh cached logs to avoid re-requesting each monitor on every refresh.
        for (const monitor of response.monitors) {
          const cachedLogs = monitorLogsCacheRef.current.get(monitor._id);
          if (!cachedLogs) continue;
          if (now - cachedLogs.fetchedAt > MONITOR_LOGS_CACHE_TTL_MS) continue;
          logsByMonitorId.set(monitor._id, cachedLogs.logs);
        }

        const monitorIdsMissingFreshLogs = response.monitors
          .map((monitor) => monitor._id)
          .filter((monitorId) => !logsByMonitorId.has(monitorId))
          .slice(0, MONITOR_LOGS_PREFETCH_LIMIT);

        const logsResults = await Promise.allSettled(
          monitorIdsMissingFreshLogs.map(async (monitorId) => {
            const logsResponse = await fetchMonitorLogs(monitorId, token, {
              limit: HISTORY_BAR_COUNT,
            });
            return [monitorId, logsResponse.logs] as const;
          }),
        );

        logsResults.forEach((result) => {
          if (result.status === "fulfilled") {
            const [monitorId, logs] = result.value;
            logsByMonitorId.set(monitorId, logs);
            monitorLogsCacheRef.current.set(monitorId, {
              fetchedAt: now,
              logs,
            });
          }
        });

        setMonitorRows(
          response.monitors.map((monitor) =>
            mapBackendMonitorToRow(
              monitor,
              logsByMonitorId.get(monitor._id) ?? [],
            ),
          ),
        );
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return;
        }
        setMonitorLoadError(
          formatAppError(error, "Impossible de charger les monitors."),
        );
      } finally {
        setIsMonitorsLoading(false);
      }
    },
    [clearSessionAndRedirectToLogin],
  );

  const refreshTeamSummary = useCallback(
    async (token: string, role: AuthUser["role"]) => {
      if (!isAdminRole(role)) {
        setTeamMembers([]);
        setTeamInvitations([]);
        return;
      }

      try {
        const [usersResponse, invitationsResponse] = await Promise.all([
          fetchUsers(token),
          fetchInvitations(token),
        ]);

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
          name?: string;
          email: string;
          monitorIds?: string[];
          status: "pending" | "accepted" | "expired";
          createdAt: string;
          expiresAt: string;
        }) => ({
          id: invitation._id ?? invitation.id ?? invitation.email,
          name: invitation.name,
          email: invitation.email,
          monitorIds: Array.isArray(invitation.monitorIds)
            ? invitation.monitorIds.filter(
                (monitorId): monitorId is string =>
                  typeof monitorId === "string",
              )
            : [],
          status: invitation.status,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
        });

        const isExpiredInvitation = (invitation: {
          status: "pending" | "accepted" | "expired";
          expiresAt: string;
        }): boolean => {
          const expiresAtTimestamp = Date.parse(invitation.expiresAt);
          const expiredByDate =
            !Number.isNaN(expiresAtTimestamp) &&
            expiresAtTimestamp <= Date.now();
          return invitation.status === "expired" || expiredByDate;
        };

        let mappedInvitations =
          invitationsResponse.invitations.map(mapInvitationEntry);

        const expiredInvitationIds = mappedInvitations
          .filter((invitation) => isExpiredInvitation(invitation))
          .map((invitation) => invitation.id);

        // Clean stale expired invitations immediately so the UI stays in sync
        // even if an old backend process is still running without scheduler cleanup.
        if (expiredInvitationIds.length > 0) {
          await Promise.allSettled(
            expiredInvitationIds.map((invitationId) =>
              deleteInvitation(invitationId, token),
            ),
          );

          const refreshedInvitationsResponse = await fetchInvitations(token);
          mappedInvitations =
            refreshedInvitationsResponse.invitations.map(mapInvitationEntry);
        }

        mappedInvitations = mappedInvitations.filter(
          (invitation) => !isExpiredInvitation(invitation),
        );

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
    async ({
      email,
      password,
      rememberMe,
    }: {
      email: string;
      password: string;
      rememberMe: boolean;
    }): Promise<LoginSubmissionResult> => {
      try {
        const response = await login(email, password, rememberMe);
        saveAuthToken(response.token, rememberMe);
        setIsAuthBootstrapComplete(false);
        setAuthToken(response.token);
        setCurrentUser(response.user);
        setMonitorLoadError(null);
        navigateTo("/monitoring", { replace: true });
        return null;
      } catch (error) {
        const code = getApiErrorCode(error);
        const message = formatAppError(error, "Impossible de se connecter.");
        return code ? { error: message, code } : { error: message };
      }
    },
    [navigateTo],
  );

  // Fonction pour générer un mot de passe temporaire sécurisé
  const refreshAccountRequests = useCallback(async () => {
    if (!authToken || !currentUser || currentUser.role !== "super_admin") {
      setAccountRequests([]);
      return;
    }

    try {
      setIsLoadingAccountRequests(true);
      const response = await getAccountRequests(authToken);
      setAccountRequests(response.requests);
    } catch (error) {
      console.error("Erreur lors du chargement des demandes:", error);
    } finally {
      setIsLoadingAccountRequests(false);
    }
  }, [authToken, currentUser]);

  const generateTempPassword = useCallback(() => {
    const length = 12;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }, []);

  // Fonction pour approuver une demande et créer le compte
  const handleApproveRequest = useCallback(
    async (
      requestId: string,
      role: "user" | "admin" = "user",
      monitorIds: string[] = [],
    ) => {
      if (!authToken)
        return "Vous devez être connecté pour approuver une demande.";

      try {
        // Générer un mot de passe temporaire
        const tempPassword = generateTempPassword();

        // Approuver la demande via l'API (crée l'utilisateur et envoie l'email)
        await approveAccountRequest(
          requestId,
          tempPassword,
          role,
          monitorIds,
          authToken,
        );

        // Rafraîchir la liste des demandes
        await refreshAccountRequests();

        // Rafraîchir la liste des utilisateurs
        await refreshTeamSummary(authToken, currentUser?.role || "user");

        return null;
      } catch (error) {
        return formatAppError(
          error,
          "Impossible d'approuver la demande. Veuillez réessayer.",
        );
      }
    },
    [
      authToken,
      currentUser?.role,
      generateTempPassword,
      refreshAccountRequests,
      refreshTeamSummary,
    ],
  );

  // Fonction pour rejeter une demande
  const handleRejectRequest = useCallback(
    async (requestId: string) => {
      if (!authToken)
        return "Vous devez être connecté pour rejeter une demande.";

      try {
        await rejectAccountRequest(requestId, authToken);

        // Rafraîchir la liste des demandes
        await refreshAccountRequests();

        return null;
      } catch (error) {
        return formatAppError(
          error,
          "Impossible de rejeter la demande. Veuillez réessayer.",
        );
      }
    },
    [authToken, refreshAccountRequests],
  );

  // Fonction pour supprimer les demandes approuvées
  const handleDeleteApprovedRequests = useCallback(async () => {
    if (!authToken)
      return "Vous devez être connecté pour supprimer les demandes.";

    try {
      await deleteAccountRequests("approved", authToken);
      await refreshAccountRequests();
      return null;
    } catch (error) {
      return formatAppError(
        error,
        "Impossible de supprimer les demandes approuvées.",
      );
    }
  }, [authToken, refreshAccountRequests]);

  // Fonction pour supprimer les demandes rejetées
  const handleDeleteRejectedRequests = useCallback(async () => {
    if (!authToken)
      return "Vous devez être connecté pour supprimer les demandes.";

    try {
      await deleteAccountRequests("rejected", authToken);
      await refreshAccountRequests();
      return null;
    } catch (error) {
      return formatAppError(
        error,
        "Impossible de supprimer les demandes rejetées.",
      );
    }
  }, [authToken, refreshAccountRequests]);

  const handleRequestAccount = useCallback(
    async ({
      email,
      name,
      message,
    }: {
      email: string;
      name: string;
      message?: string;
    }) => {
      try {
        const response = await requestAccountCreation({ email, name, message });
        // Ajouter la demande au state local pour le Super Admin si l'API retourne la demande
        if (response.request) {
          const newRequest = {
            id: response.request.id,
            email: response.request.email,
            name: response.request.name,
            message,
            createdAt: response.request.createdAt,
            status: response.request.status as "pending",
          };
          setAccountRequests((prev) => [...prev, newRequest]);
        }
        return null;
      } catch (error) {
        return formatAppError(
          error,
          "Impossible d'envoyer la demande. Veuillez réessayer plus tard.",
        );
      }
    },
    [],
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
        let fallbackNameForLegacyApi = "User";
        try {
          const invitationResponse = await fetchInvitationByToken(token);
          const invitationName = invitationResponse.invitation.name?.trim();
          const invitationEmail = invitationResponse.invitation.email?.trim();
          if (invitationName) {
            fallbackNameForLegacyApi = invitationName;
          } else if (invitationEmail) {
            const localPart = invitationEmail.split("@")[0]?.trim();
            if (localPart) {
              fallbackNameForLegacyApi = localPart;
            }
          }
        } catch {
          // Ignore: accept endpoint will return a clear error if token is invalid/expired.
        }

        const response = await acceptInvitation(
          token,
          password,
          rememberMe,
          fallbackNameForLegacyApi,
        );
        saveAuthToken(response.token, rememberMe);
        setIsAuthBootstrapComplete(false);
        setAuthToken(response.token);
        setCurrentUser(response.user);
        setMonitorLoadError(null);
        navigateTo("/monitoring", { replace: true });
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
        return "Les mots de passe ne correspondent pas.";
      }

      try {
        await requestPasswordReset(email);
        setPasswordResetContext({
          email,
          newPassword,
        });
        navigateTo("/confirmation-code");
        return null;
      } catch (error) {
        return formatAppError(
          error,
          "Impossible d envoyer le code de verification.",
        );
      }
    },
    [navigateTo],
  );

  const handleResendPasswordResetCode = useCallback(async () => {
    if (!passwordResetContext) {
      return "Recommencez la procedure de reinitialisation.";
    }

    try {
      await requestPasswordReset(passwordResetContext.email);
      return null;
    } catch (error) {
      return formatAppError(error, "Impossible de renvoyer le code.");
    }
  }, [passwordResetContext]);

  const handleConfirmPasswordReset = useCallback(
    async (code: string) => {
      if (!passwordResetContext) {
        return "Recommencez la procedure de reinitialisation.";
      }

      if (!passwordResetContext.newPassword) {
        return "Veuillez définir un nouveau mot de passe.";
      }

      try {
        await resetPasswordWithCode(
          passwordResetContext.email,
          code,
          passwordResetContext.newPassword,
        );
        setPasswordResetContext(null);
        navigateTo("/login", { replace: true });
        return null;
      } catch (error) {
        return formatAppError(
          error,
          "Impossible de reinitialiser le mot de passe.",
        );
      }
    },
    [navigateTo, passwordResetContext],
  );

  const handleCreateMonitor = useCallback(
    async (payload: {
      name: string;
      url: string;
      type: "http" | "https" | "ws" | "wss";
      interval: number;
      timeout: number;
      httpMethod:
        | "GET"
        | "POST"
        | "PUT"
        | "PATCH"
        | "DELETE"
        | "HEAD"
        | "OPTIONS";
      ipVersion?: MonitorIpVersion;
      emailNotificationsEnabled?: boolean;
      domainExpiryMode?: "enabled" | "disabled";
      sslExpiryMode?: "enabled" | "disabled";
      body?: string;
      headers?: Record<string, string>;
      responseValidation?: {
        field: "status";
        mode: "value" | "type";
        expectedValue?: string;
        expectedType?: "string" | "boolean" | "number";
      };
      followRedirections?: boolean;
      upStatusCodeGroups?: Array<"2xx" | "3xx">;
    }) => {
      if (!authToken) {
        return "Authentification requise.";
      }

      try {
        await createMonitor(payload, authToken);
        await refreshMonitors(authToken);
        navigateTo("/monitoring");
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return "Session expiree. Reconnectez-vous.";
        }
        return formatAppError(error, "Impossible de creer le monitor.");
      }
    },
    [authToken, clearSessionAndRedirectToLogin, navigateTo, refreshMonitors],
  );

  const submitMonitorBatch = useCallback(
    async (payload: MonitorBatchSubmission, errorFallbackMessage: string) => {
      if (!authToken) {
        return "Authentification requise.";
      }
      if (!payload.monitors || payload.monitors.length === 0) {
        return "Aucun monitor a creer.";
      }

      try {
        const createdMonitorIds: string[] = [];

        for (const monitorPayload of payload.monitors) {
          const response = await createMonitor(monitorPayload, authToken);
          createdMonitorIds.push(response.monitor._id);
        }

        if (payload.integration) {
          await createIntegration(payload.integration, authToken);
        }

        if (payload.inviteEmails.length > 0) {
          if (!currentUser) {
            return "Authentification requise.";
          }

          for (const inviteEmail of payload.inviteEmails) {
            const nameFromEmail = inviteEmail.split("@")[0]?.trim();
            const safeName =
              nameFromEmail && nameFromEmail !== ""
                ? nameFromEmail
                : "Team member";
            await createInvitation(
              safeName,
              inviteEmail,
              createdMonitorIds,
              authToken,
            );
          }
        }

        await refreshMonitors(authToken);
        const currentRole = currentUser?.role;
        if (isCurrentUserAdmin && currentRole) {
          await refreshTeamSummary(authToken, currentRole);
        }
        navigateTo("/monitoring");
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return "Session expiree. Reconnectez-vous.";
        }
        await refreshMonitors(authToken);
        return formatAppError(error, errorFallbackMessage);
      }
    },
    [
      authToken,
      clearSessionAndRedirectToLogin,
      currentUser,
      navigateTo,
      refreshMonitors,
      refreshTeamSummary,
    ],
  );

  const handleSubmitMonitorWizard = useCallback(
    async (payload: MonitorWizardSubmission) =>
      submitMonitorBatch(payload, "Impossible de terminer le monitor wizard."),
    [submitMonitorBatch],
  );

  const handleSubmitBulkUpload = useCallback(
    async (payload: BulkUploadSubmission) =>
      submitMonitorBatch(payload, "Impossible de terminer l'import en masse."),
    [submitMonitorBatch],
  );

  const handleUpdateMonitor = useCallback(
    async (
      monitorId: string,
      payload: {
        name: string;
        url: string;
        domainExpiryMode?: "enabled" | "disabled";
        sslExpiryMode?: "enabled" | "disabled";
      },
    ) => {
      if (!authToken) {
        return "Authentification requise.";
      }

      try {
        const response = await updateMonitor(monitorId, payload, authToken);
        setMonitorRows((prev) =>
          prev.map((monitor) =>
            monitor.id === monitorId
              ? mapBackendMonitorToRow(response.monitor)
              : monitor,
          ),
        );
        await refreshMonitors(authToken);
        navigateTo(`/monitoring/${monitorId}`);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return "Session expiree. Reconnectez-vous.";
        }
        return formatAppError(error, "Impossible de modifier le monitor.");
      }
    },
    [authToken, clearSessionAndRedirectToLogin, navigateTo, refreshMonitors],
  );

  const appendInvitationLinkNotice = useCallback(
    async (
      baseNotice: string,
      options?: {
        invitationUrl?: string;
        delivery?: "smtp" | "manual-link";
        warning?: string;
      },
    ): Promise<string> => {
      void options;
      return baseNotice;
    },
    [],
  );

  const handleInviteTeamMember = useCallback(
    async ({
      name,
      email,
      role,
      monitorIds,
    }: {
      name: string;
      email: string;
      role: "admin" | "member";
      monitorIds: string[];
    }) => {
      const token = authToken;
      const adminUser = currentUser;

      if (!token) {
        return { error: "Authentification requise." };
      }
      if (!adminUser || !isCurrentUserAdmin) {
        return { error: "Acces reserve aux admins." };
      }

      try {
        const response = await createInvitation(
          name,
          email,
          monitorIds,
          token,
          role,
        );
        const appliedMonitorIds = response.invitation.monitorIds ?? [];
        if (monitorIds.length > 0 && appliedMonitorIds.length === 0) {
          return {
            error:
              "Invitation creee sans droits monitors. Redemarrez le backend sur le code actuel puis reinvitez l'utilisateur.",
          };
        }

        const successBase = "Invitation envoyee avec succes.";
        const notice = await appendInvitationLinkNotice(successBase, {
          invitationUrl: response.invitationUrl,
          delivery: response.delivery,
          warning: response.warning,
        });
        await refreshTeamSummary(token, adminUser.role);
        return { error: null, notice };
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return { error: "Session expiree. Reconnectez-vous." };
        }
        return {
          error: formatAppError(error, "Impossible d'envoyer l'invitation."),
        };
      }
    },
    [
      appendInvitationLinkNotice,
      authToken,
      clearSessionAndRedirectToLogin,
      currentUser,
      isCurrentUserAdmin,
      refreshTeamSummary,
    ],
  );

  const handleGrantMonitorAccess = useCallback(
    async ({
      monitorId,
      name,
      email,
    }: {
      monitorId: string;
      name?: string;
      email: string;
    }) => {
      const token = authToken;
      const adminUser = currentUser;

      if (!token) {
        return { error: "Authentification requise." };
      }
      if (!adminUser || !isCurrentUserAdmin) {
        return { error: "Acces reserve aux admins." };
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail === "") {
        return { error: "L'email est requis." };
      }

      const existingUser = teamMembers.find(
        (member) => member.email.trim().toLowerCase() === normalizedEmail,
      );
      const targetMonitor = monitorRows.find(
        (monitor) => monitor.id === monitorId,
      );

      try {
        if (existingUser) {
          if (targetMonitor?.sharedUserIds?.includes(existingUser.id)) {
            return { error: "Cet utilisateur a deja acces a ce monitor." };
          }

          const response = await shareMonitorWithUser(
            monitorId,
            existingUser.id,
            token,
          );
          await refreshMonitors(token);
          await refreshTeamSummary(token, adminUser.role);
          const notice = response.warning
            ? `${response.message} ${response.warning}`
            : response.message;
          return { error: null, notice };
        } else {
          const safeName =
            name?.trim() ||
            normalizedEmail.split("@")[0]?.trim() ||
            "Team member";

          const response = await createInvitation(
            safeName,
            normalizedEmail,
            [monitorId],
            token,
          );
          const appliedMonitorIds = response.invitation.monitorIds ?? [];

          if (appliedMonitorIds.length === 0) {
            return {
              error:
                "Invitation creee sans droits monitor. Redemarrez le backend sur le code actuel puis reinvitez l'utilisateur.",
            };
          }

          const successBase = "Invitation envoyee avec succes.";
          const notice = await appendInvitationLinkNotice(successBase, {
            invitationUrl: response.invitationUrl,
            delivery: response.delivery,
            warning: response.warning,
          });
          await refreshMonitors(token);
          await refreshTeamSummary(token, adminUser.role);
          return { error: null, notice };
        }
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return { error: "Session expiree. Reconnectez-vous." };
        }
        return {
          error: formatAppError(
            error,
            "Impossible d'ajouter l'utilisateur a ce monitor.",
          ),
        };
      }
    },
    [
      appendInvitationLinkNotice,
      authToken,
      clearSessionAndRedirectToLogin,
      currentUser,
      isCurrentUserAdmin,
      monitorRows,
      refreshMonitors,
      refreshTeamSummary,
      teamMembers,
    ],
  );

  const handleRevokeMonitorAccess = useCallback(
    async ({ monitorId, userId }: { monitorId: string; userId: string }) => {
      if (!authToken) {
        return "Authentification requise.";
      }
      if (!currentUser || !isCurrentUserAdmin) {
        return "Acces reserve aux admins.";
      }

      try {
        await removeMonitorShare(monitorId, userId, authToken);
        await refreshMonitors(authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return "Session expiree. Reconnectez-vous.";
        }
        return formatAppError(
          error,
          "Impossible de retirer l'acces a ce monitor.",
        );
      }
    },
    [
      authToken,
      clearSessionAndRedirectToLogin,
      currentUser,
      isCurrentUserAdmin,
      refreshMonitors,
      refreshTeamSummary,
    ],
  );

  const handleDeleteTeamUser = useCallback(
    async (userId: string) => {
      if (!authToken) {
        return "Authentification requise.";
      }
      if (!currentUser || !isCurrentUserAdmin) {
        return "Acces reserve aux admins.";
      }
      const targetUser = teamMembers.find((member) => member.id === userId);
      if (targetUser?.role === "super_admin") {
        return "Le super administrateur ne peut pas etre supprime.";
      }
      if (targetUser?.role === "admin" && currentUser.role !== "super_admin") {
        return "Seul le super administrateur peut supprimer un administrateur.";
      }
      if (userId === currentUser.id) {
        return "Vous ne pouvez pas vous supprimer vous-meme.";
      }

      try {
        await deleteUser(userId, authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return "Session expiree. Reconnectez-vous.";
        }
        return formatAppError(error, "Impossible de supprimer l'utilisateur.");
      }
    },
    [
      authToken,
      clearSessionAndRedirectToLogin,
      currentUser,
      isCurrentUserAdmin,
      refreshTeamSummary,
      teamMembers,
    ],
  );

  const handleTeamUserRoleChange = useCallback(
    async (userId: string, nextRole: EditableUserRole) => {
      if (!authToken) {
        return "Authentification requise.";
      }
      if (!currentUser || !isCurrentUserAdmin) {
        return "Acces reserve aux admins.";
      }
      const targetUser = teamMembers.find((member) => member.id === userId);
      if (targetUser?.role === "super_admin") {
        return "Le role du super administrateur ne peut pas etre modifie.";
      }
      if (targetUser?.role === "admin" && currentUser.role !== "super_admin") {
        return "Seul le super administrateur peut modifier un administrateur.";
      }
      if (nextRole === "admin" && currentUser.role !== "super_admin") {
        return "Seul le super administrateur peut attribuer le role admin.";
      }
      if (userId === currentUser.id) {
        return "Vous ne pouvez pas modifier votre propre role.";
      }

      try {
        await updateUser(userId, { role: nextRole }, authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return "Session expiree. Reconnectez-vous.";
        }
        return formatAppError(
          error,
          "Impossible de modifier le role de l'utilisateur.",
        );
      }
    },
    [
      authToken,
      clearSessionAndRedirectToLogin,
      currentUser,
      isCurrentUserAdmin,
      refreshTeamSummary,
      teamMembers,
    ],
  );

  const handleTeamUserActiveToggle = useCallback(
    async (userId: string, nextIsActive: boolean) => {
      if (!authToken) {
        return "Authentification requise.";
      }
      if (!currentUser || !isCurrentUserAdmin) {
        return "Acces reserve aux admins.";
      }
      const targetUser = teamMembers.find((member) => member.id === userId);
      if (targetUser?.role === "super_admin" && nextIsActive === false) {
        return "Le super administrateur ne peut pas etre desactive.";
      }
      if (targetUser?.role === "admin" && currentUser.role !== "super_admin") {
        return "Seul le super administrateur peut modifier le statut d'un administrateur.";
      }
      if (userId === currentUser.id && nextIsActive === false) {
        return "Vous ne pouvez pas vous desactiver vous-meme.";
      }

      try {
        await updateUser(userId, { isActive: nextIsActive }, authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return "Session expiree. Reconnectez-vous.";
        }
        return formatAppError(
          error,
          "Impossible de modifier le statut de l'utilisateur.",
        );
      }
    },
    [
      authToken,
      clearSessionAndRedirectToLogin,
      currentUser,
      refreshTeamSummary,
      teamMembers,
    ],
  );

  const handleDeleteInvitation = useCallback(
    async (invitationId: string) => {
      if (!authToken) {
        return "Authentification requise.";
      }
      if (!currentUser || !isCurrentUserAdmin) {
        return "Acces reserve aux admins.";
      }

      try {
        await deleteInvitation(invitationId, authToken);
        await refreshTeamSummary(authToken, currentUser.role);
        return null;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          clearSessionAndRedirectToLogin();
          return "Session expiree. Reconnectez-vous.";
        }
        return formatAppError(error, "Impossible de supprimer l'invitation.");
      }
    },
    [
      authToken,
      clearSessionAndRedirectToLogin,
      currentUser,
      isCurrentUserAdmin,
      refreshTeamSummary,
    ],
  );

  useEffect(() => {
    return () => {
      if (sidebarToggleTimerRef.current !== null) {
        clearTimeout(sidebarToggleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    clearStoredAuthToken();
  }, []);

  useEffect(() => {
    writeCachedUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    const pathname = normalizePathname(window.location.pathname);
    const isAuthPath = isPublicAuthPath(pathname);
    const isAllowedPublicPath = isAuthPath || isPublicStatusPagePath(pathname);
    const isInvitationAcceptancePath = isInvitationAcceptanceLocation(pathname);

    if (!isAuthBootstrapComplete && authToken === COOKIE_AUTH_SENTINEL) {
      if (isWorkspaceRoute(pathname)) {
        navigateTo("/login", { replace: true });
      } else {
        applyRoute(pathname);
      }
    } else if (!authToken && !isAllowedPublicPath) {
      navigateTo("/login", { replace: true });
    } else if (
      authToken &&
      currentUser &&
      (pathname === "/" || (isAuthPath && !isInvitationAcceptancePath))
    ) {
      navigateTo("/monitoring", { replace: true });
    } else if (pathname === "/") {
      navigateTo("/login", { replace: true });
    } else {
      applyRoute(pathname);
    }

    const handlePopState = () => {
      applyRoute(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [applyRoute, authToken, currentUser, isAuthBootstrapComplete, navigateTo]);

  useEffect(() => {
    if (!currentUser || isCurrentUserAdmin) return;
    if (!isTeamMembersPage || teamMembersSubPage === "overview") return;
    navigateTo("/team-members", { replace: true });
  }, [
    currentUser,
    isCurrentUserAdmin,
    isTeamMembersPage,
    navigateTo,
    teamMembersSubPage,
  ]);

  useEffect(() => {
    if (!currentUser || isCurrentUserSuperAdmin) return;
    if (!isTeamMembersPage || teamMembersSubPage !== "requests") return;
    navigateTo("/team-members", { replace: true });
  }, [
    currentUser,
    isCurrentUserSuperAdmin,
    isTeamMembersPage,
    navigateTo,
    teamMembersSubPage,
  ]);

  useEffect(() => {
    if (!authToken || !currentUser || !isCurrentUserAdmin) return;
    if (!isTeamMembersPage) return;
    void refreshTeamSummary(authToken, currentUser.role);
  }, [
    authToken,
    currentUser,
    isCurrentUserAdmin,
    isTeamMembersPage,
    teamMembersSubPage,
    refreshTeamSummary,
  ]);

  // Charger les demandes de création de compte lorsque l'utilisateur est super admin et sur la page des demandes
  useEffect(() => {
    if (!authToken || !currentUser || currentUser.role !== "super_admin")
      return;
    if (teamMembersSubPage !== "requests") return;

    void refreshAccountRequests();
    const intervalId = window.setInterval(() => {
      void refreshAccountRequests();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [authToken, currentUser, refreshAccountRequests, teamMembersSubPage]);

  useEffect(() => {
    if (!authToken) {
      setIsAuthBootstrapComplete(true);
      setCurrentUser(null);
      setMonitorRows([]);
      setTeamMembers([]);
      setTeamInvitations([]);
      return;
    }

    let cancelled = false;
    setIsAuthBootstrapComplete(false);

    const bootstrapSession = async () => {
      const pathname = normalizePathname(window.location.pathname);
      const isAuthPath = isPublicAuthPath(pathname);
      const isPublicStatusPath = isPublicStatusPagePath(pathname);
      const isAllowedAnonymousPath = isAuthPath || isPublicStatusPath;

      try {
        const meResponse = await fetchMe(authToken);
        if (cancelled) return;
        if (
          !meResponse ||
          typeof meResponse !== "object" ||
          !("user" in meResponse) ||
          !meResponse.user ||
          !meResponse.user.role
        ) {
          clearLocalSession();
          if (!isAllowedAnonymousPath) {
            clearSessionAndRedirectToLogin();
          }
          return;
        }
        setCurrentUser(meResponse.user);
        await Promise.all([
          refreshMonitors(authToken),
          refreshTeamSummary(authToken, meResponse.user.role),
        ]);
        if (cancelled) return;
        setIsAuthBootstrapComplete(true);
      } catch (error) {
        if (cancelled) return;
        if (isApiError(error) && error.status === 401) {
          if (isAllowedAnonymousPath) {
            clearLocalSession();
            return;
          }
          clearSessionAndRedirectToLogin();
          return;
        }
        clearLocalSession();
        setMonitorLoadError(
          formatAppError(error, "Impossible de charger la session."),
        );
        if (!isAllowedAnonymousPath) {
          clearSessionAndRedirectToLogin();
        }
      }
    };

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [
    authToken,
    clearLocalSession,
    clearSessionAndRedirectToLogin,
    refreshMonitors,
    refreshTeamSummary,
  ]);

  useEffect(() => {
    setSelectedMonitorIds((previousIds) =>
      previousIds.filter((monitorId) =>
        monitorRows.some((monitor) => monitor.id === monitorId),
      ),
    );
  }, [monitorRows]);

  useEffect(() => {
    if (!isCreatingMonitor) {
      setNewMonitorDraft(null);
    }
  }, [isCreatingMonitor]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        newMonitorMenuRef.current &&
        !newMonitorMenuRef.current.contains(target)
      ) {
        setNewMonitorMenuOpen(false);
      }

      if (
        monitorSortMenuRef.current &&
        !monitorSortMenuRef.current.contains(target)
      ) {
        setIsMonitorSortMenuOpen(false);
      }

      if (
        monitorTagMenuRef.current &&
        !monitorTagMenuRef.current.contains(target)
      ) {
        setIsMonitorTagMenuOpen(false);
      }

      if (
        bulkActionsMenuRef.current &&
        !bulkActionsMenuRef.current.contains(target)
      ) {
        setIsBulkActionsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () =>
      document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setNewMonitorMenuOpen(false);
      setIsMonitorSortMenuOpen(false);
      setIsMonitorTagMenuOpen(false);
      setIsBulkActionsMenuOpen(false);
      setIsMonitorFilterOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
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

  const openNewMonitorPage = useCallback(
    (draft?: MonitorDraft | null) => {
      setNewMonitorDraft(draft ?? null);
      navigateTo("/monitoring/new");
    },
    [navigateTo],
  );

  const handleNewMonitorOptionSelect = (option: NewMonitorOption) => {
    setNewMonitorMenuOpen(false);

    if (option === "single") {
      openNewMonitorPage();
      return;
    }

    if (option === "wizard") {
      navigateTo("/monitoring/wizard");
      return;
    }

    navigateTo("/monitoring/bulk");
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
    setDraftMonitorFilterStatus("none");
    setDraftMonitorTagQuery("");
  };

  const runBulkMonitorAction = useCallback(
    async (option: BulkActionOption, monitorIds: string[]) => {
      if (!bulkActionOptions.includes(option)) return;
      if (!authToken) {
        setMonitorActionFeedback("Authentification requise.");
        return;
      }
      if (monitorIds.length === 0) {
        setMonitorActionFeedback("Selectionnez au moins un monitor.");
        return;
      }

      setIsBulkActionRunning(true);
      setMonitorActionFeedback(null);

      const actionRunner = async (monitorId: string): Promise<void> => {
        if (option === "pause") {
          await pauseMonitor(monitorId, authToken);
          return;
        }
        if (option === "resume") {
          await resumeMonitor(monitorId, authToken);
          return;
        }
        if (option === "delete") {
          await deleteMonitor(monitorId, authToken);
          return;
        }

        await checkMonitor(monitorId, authToken);
      };

      const results = await Promise.allSettled(
        monitorIds.map((monitorId) => actionRunner(monitorId)),
      );
      const rejectedResults = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
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

      if (option === "delete" && successfulCount > 0) {
        setSelectedMonitorIds((previousIds) =>
          previousIds.filter((monitorId) => !monitorIds.includes(monitorId)),
        );
      }

      await refreshMonitors(authToken);
      setIsBulkActionsMenuOpen(false);
      setIsBulkActionRunning(false);

      if (failedCount === 0) {
        const optionLabel = bulkActionOptionLabels[option].toLowerCase();
        setMonitorActionFeedback(
          `${successfulCount} monitor(s) ${optionLabel} avec succes.`,
        );
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
      const sourceIds =
        selectedMonitorIds.length > 0
          ? selectedMonitorIds
          : displayedMonitors.map((monitor) => monitor.id);
      const uniqueMonitorIds = Array.from(new Set(sourceIds));
      await runBulkMonitorAction(option, uniqueMonitorIds);
    },
    [displayedMonitors, runBulkMonitorAction, selectedMonitorIds],
  );

  const toggleMonitorSelection = (monitorId: string) => {
    setSelectedMonitorIds((prev) =>
      prev.includes(monitorId)
        ? prev.filter((id) => id !== monitorId)
        : [...prev, monitorId],
    );
  };

  const toggleAllMonitorSelections = () => {
    setSelectedMonitorIds(
      areAllMonitorsSelected ? [] : monitorRows.map((monitor) => monitor.id),
    );
  };

  const currentPathname =
    typeof window === "undefined"
      ? "/"
      : normalizePathname(window.location.pathname);
  const currentAuthRoute =
    authRoute ?? getAuthRouteFromLocation(currentPathname);
  const isCookieSessionCandidate = authToken === COOKIE_AUTH_SENTINEL;
  const shouldShowLoginFallback =
    isCookieSessionCandidate &&
    !isAuthBootstrapComplete &&
    currentAuthRoute === null &&
    isWorkspaceRoute(currentPathname);

  if (shouldShowLoginFallback) {
    return (
      <LoginPage
        onSignIn={handleSignIn}
        onRequestAccount={handleRequestAccount}
        onSendVerificationCode={async (email) => {
          try {
            await requestPasswordReset(email);
            setPasswordResetContext({ email, timestamp: Date.now() });
            return null;
          } catch (error) {
            return formatAppError(
              error,
              "Impossible d envoyer le code de verification.",
            );
          }
        }}
        onVerifyCode={async (email, code) => {
          const normalizedCode = String(code ?? "")
            .trim()
            .replace(/\D/g, "");

          if (normalizedCode.length !== 6) {
            return false;
          }

          setPasswordResetContext((prev) => ({
            email,
            code: normalizedCode,
            timestamp: prev?.timestamp ?? Date.now(),
          }));
          return true;
        }}
        onResetPassword={async (email, newPassword) => {
          const verificationCode = passwordResetContext?.code;
          if (!verificationCode) {
            return "Veuillez verifier le code avant de reinitialiser le mot de passe.";
          }

          try {
            await resetPasswordWithCode(email, verificationCode, newPassword);
            setPasswordResetContext(null);
            return null;
          } catch (error) {
            return formatAppError(
              error,
              "Impossible de reinitialiser le mot de passe.",
            );
          }
        }}
      />
    );
  }

  if (currentAuthRoute === "login") {
    return (
      <LoginPage
        onSignIn={handleSignIn}
        onRequestAccount={handleRequestAccount}
        onSendVerificationCode={async (email) => {
          try {
            await requestPasswordReset(email);
            setPasswordResetContext({ email, timestamp: Date.now() });
            return null;
          } catch (error) {
            return formatAppError(
              error,
              "Impossible d envoyer le code de verification.",
            );
          }
        }}
        onVerifyCode={async (email, code) => {
          const normalizedCode = String(code ?? "")
            .trim()
            .replace(/\D/g, "");

          if (normalizedCode.length !== 6) {
            return false;
          }

          setPasswordResetContext((prev) => ({
            email,
            code: normalizedCode,
            timestamp: prev?.timestamp ?? Date.now(),
          }));
          return true;
        }}
        onResetPassword={async (email, newPassword) => {
          const verificationCode = passwordResetContext?.code;
          if (!verificationCode) {
            return "Veuillez verifier le code avant de reinitialiser le mot de passe.";
          }

          try {
            await resetPasswordWithCode(email, verificationCode, newPassword);
            setPasswordResetContext(null);
            return null;
          } catch (error) {
            return formatAppError(
              error,
              "Impossible de reinitialiser le mot de passe.",
            );
          }
        }}
      />
    );
  }

  if (currentAuthRoute === "confirmation-code") {
    return (
      <ConfirmationCodePage
        email={passwordResetContext?.email}
        onBack={() => {
          navigateTo("/forgot-password");
        }}
        onContinue={handleConfirmPasswordReset}
        onResend={handleResendPasswordResetCode}
      />
    );
  }

  if (currentAuthRoute === "forgot-password") {
    return <ForgotPasswordPage onResetPassword={handleRequestPasswordReset} />;
  }

  if (currentAuthRoute === "accept-invitation") {
    const invitationToken = getInvitationTokenFromSearch();
    return (
      <AcceptInvitationPage
        token={invitationToken}
        onAcceptInvitation={handleAcceptInvitation}
        onBackToLogin={() => {
          navigateTo("/login");
        }}
      />
    );
  }

  // Public status page is rendered outside the app shell (no sidebar/navbar).
  if (isStatusPagesPage && selectedStatusPageId && isStatusPagePublicView) {
    return (
      <StatusPagePublicPage
        statusPageId={selectedStatusPageId}
        authToken={authToken}
      />
    );
  }

  if (currentPathname === "/profile") {
    return (
      <EditProfilePage
        authToken={authToken}
        currentUser={currentUser}
        onBack={() => {
          navigateTo("/monitoring");
        }}
        onUpdateUser={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  if (currentPathname === "/settings") {
    return <SettingsPage />;
  }

  return (
    <div className={appShellClasses}>
      <button
        className="mobile-toggle"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* --- Sidebar --- */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-head">
          <button
            className={`sidebar-collapse-toggle ${sidebarTogglePending ? "pending" : ""}`}
            type="button"
            onClick={handleSidebarToggleClick}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            disabled={sidebarTogglePending}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronLeft size={14} />
            )}
          </button>
          <div className="brand-copy">
            <h2>{sidebarCollapsed ? "M" : "Monitoring"}</h2>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
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
                  "menu-link",
                  item.customIcon === "monitoringRadar"
                    ? "menu-link-monitoring"
                    : "",
                  isActive ? "active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  navigateTo(routeByMenuLabel[item.label]);
                  setMobileMenuOpen(false);
                }}
              >
                <span className="menu-icon-slot" aria-hidden="true">
                  {item.customIcon === "monitoringRadar" ? (
                    <img
                      src={monitoringMenuIcon}
                      alt=""
                      className="menu-monitoring-image"
                    />
                  ) : item.customIcon === "incidentHexagon" ? (
                    <ExclamationHexagonIcon
                      size={16}
                      className="menu-custom-icon"
                    />
                  ) : item.materialIcon ? (
                    <span className="material-symbols-outlined menu-material-icon">
                      {item.materialIcon}
                    </span>
                  ) : (
                    item.icon && <item.icon size={15} />
                  )}
                </span>
                <span className="menu-text">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer" ref={profileMenuRef}>
          <div
            className="profile-avatar"
            onClick={() => setProfileMenuOpen((s) => !s)}
          >
            {isUserLoading ? (
              "…"
            ) : profileAvatarUrl ? (
              <img src={`${profileAvatarUrl}?t=${Date.now()}`} alt="" />
            ) : (
              userInitials || "-"
            )}
          </div>
          <div
            className="profile-copy"
            role="button"
            onClick={() => setProfileMenuOpen((s) => !s)}
            style={{ cursor: "pointer" }}
          >
            {profileName ? <strong>{profileName}</strong> : null}
            {profileEmail ? <span>{profileEmail}</span> : null}
          </div>
          <div className={`profile-menu ${profileMenuOpen ? "open" : ""}`}>
            <button
              type="button"
              className="profile-menu-item"
              onClick={() => {
                setProfileMenuOpen(false);
                setIsProfileModalOpen(true);
                setMobileMenuOpen(false);
              }}
            >
              Profil
            </button>
            <button
              type="button"
              className="profile-menu-item"
              onClick={() => {
                setProfileMenuOpen(false);
                setIsSettingsModalOpen(true);
                setMobileMenuOpen(false);
              }}
            >
              Paramètres
            </button>
            <button
              type="button"
              className="profile-menu-item"
              onClick={() => {
                void (async () => {
                  try {
                    await logout();
                  } catch {
                    // ignore
                  } finally {
                    clearSessionAndRedirectToLogin();
                    setProfileMenuOpen(false);
                    setMobileMenuOpen(false);
                  }
                })();
              }}
            >
              Logout
            </button>
          </div>
          <button
            className="logout-button"
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((s) => !s)}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>

      <div
        className={`sidebar-overlay ${mobileMenuOpen ? "show" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <AssistantChatbot
        enabled={showAssistantChatbot}
        userName={currentUser?.name}
        onOpenMonitorCreator={(draft) => {
          openNewMonitorPage(draft);
        }}
      />

      {/* Modal Profil */}
      {isProfileModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsProfileModalOpen(false);
          }}
        >
          <div className="modal-container modal-large">
            <div className="modal-header">
              <h2>Profil</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsProfileModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <EditProfilePage
                authToken={authToken}
                currentUser={currentUser}
                onBack={() => setIsProfileModalOpen(false)}
                onUpdateUser={(user) => {
                  setCurrentUser(user);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Paramètres */}
      {isSettingsModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingsModalOpen(false);
          }}
        >
          <div className="modal-container modal-large">
            <div className="modal-header">
              <h2>Paramètres</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSettingsModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <SettingsPage />
            </div>
          </div>
        </div>
      )}

      {/* Modal Gestion Users & Demandes */}
      {isUsersManageModalOpen && (
        <div
          className="modal-overlay users-manage-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsUsersManageModalOpen(false);
          }}
        >
          <div className="modal-container modal-xlarge users-manage-modal">
            <div className="modal-header users-manage-header">
              <h2>
                <Users size={22} />
                Gestion des utilisateurs
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsUsersManageModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body users-manage-body">
              <div className="users-manage-grid">
                {/* Bloc 1: Demandes de création de compte */}
                <div className="users-manage-block requests-block">
                  <div className="users-manage-block-header">
                    <Mail size={18} />
                    <h3>Demandes de compte</h3>
                    <span className="users-manage-badge">
                      {
                        accountRequests.filter((r) => r.status === "pending")
                          .length
                      }
                    </span>
                  </div>
                  <div className="users-manage-block-content">
                    {isLoadingAccountRequests ? (
                      <p className="users-manage-loading">Chargement...</p>
                    ) : accountRequests.filter((r) => r.status === "pending")
                        .length === 0 ? (
                      <p className="users-manage-empty">
                        Aucune demande en attente
                      </p>
                    ) : (
                      <ul className="users-manage-list">
                        {accountRequests
                          .filter((r) => r.status === "pending")
                          .map((request) => (
                            <li
                              key={request.id}
                              className="users-manage-item request-item"
                            >
                              <div className="request-info">
                                <strong>{request.name}</strong>
                                <span>{request.email}</span>
                                {request.message && (
                                  <p className="request-message">
                                    {request.message}
                                  </p>
                                )}
                              </div>
                              <div className="request-actions">
                                <button
                                  type="button"
                                  className="request-btn approve"
                                  title="Approuver"
                                  onClick={() => {
                                    void handleApproveRequest(request.id);
                                  }}
                                  disabled={isLoadingAccountRequests}
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  className="request-btn reject"
                                  title="Rejeter"
                                  onClick={() => {
                                    void handleRejectRequest(request.id);
                                  }}
                                  disabled={isLoadingAccountRequests}
                                >
                                  ✕
                                </button>
                              </div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Bloc 2: Utilisateurs existants */}
                <div className="users-manage-block users-block">
                  <div className="users-manage-block-header">
                    <Users size={18} />
                    <h3>Utilisateurs existants</h3>
                    <span className="users-manage-badge">
                      {teamMembers.length}
                    </span>
                  </div>
                  <div className="users-manage-block-content">
                    {teamMembers.length === 0 ? (
                      <p className="users-manage-empty">Aucun utilisateur</p>
                    ) : (
                      <ul className="users-manage-list">
                        {teamMembers.map((member) => (
                          <li
                            key={member.id}
                            className="users-manage-item user-item"
                          >
                            <div className="user-avatar">
                              {member.name?.charAt(0).toUpperCase() ||
                                member.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="user-info">
                              <strong>{member.name || member.email}</strong>
                              <span className={`user-role role-${member.role}`}>
                                {member.role}
                              </span>
                            </div>
                            <div className="user-status">
                              <span
                                className={`status-indicator ${member.isActive ? "active" : "inactive"}`}
                              >
                                {member.isActive ? "Actif" : "Inactif"}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {integrationsSubPage === "team" && teamMonitor ? (
        <EditMonitorPage
          key={`edit-${teamMonitor.id}-integrations`}
          monitor={teamMonitor}
          initialSection="integrations"
          currentUserRole={isCurrentUserAdmin ? currentUser?.role : undefined}
          teamMembers={teamMembers}
          invitations={teamInvitations}
          onBack={() => {
            navigateTo("/monitoring");
          }}
          onOpenMonitorDetails={() => {
            navigateTo(`/monitoring/${teamMonitor.id}/edit`);
          }}
          onOpenIntegrationsTeam={() => {
            navigateTo(`/monitoring/${teamMonitor.id}/integrations-team`);
          }}
          onManageTeam={() => {
            navigateTo("/team-members/manage");
          }}
          onGrantMonitorAccess={(payload) =>
            handleGrantMonitorAccess({ monitorId: teamMonitor.id, ...payload })
          }
          onRevokeMonitorAccess={(userId) =>
            handleRevokeMonitorAccess({ monitorId: teamMonitor.id, userId })
          }
          onDeleteInvitation={handleDeleteInvitation}
          onSaveChanges={(payload) =>
            handleUpdateMonitor(teamMonitor.id, payload)
          }
          onOpenMaintenanceInfo={() => {
            navigateTo("/maintenance");
          }}
        />
      ) : isIntegrationsPage ? (
        <IntegrationsApiPage />
      ) : editingMonitor ? (
        <EditMonitorPage
          key={`edit-${editingMonitor.id}-details`}
          monitor={editingMonitor}
          initialSection="details"
          currentUserRole={isCurrentUserAdmin ? currentUser?.role : undefined}
          teamMembers={teamMembers}
          invitations={teamInvitations}
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
            navigateTo("/team-members/manage");
          }}
          onGrantMonitorAccess={(payload) =>
            handleGrantMonitorAccess({
              monitorId: editingMonitor.id,
              ...payload,
            })
          }
          onRevokeMonitorAccess={(userId) =>
            handleRevokeMonitorAccess({ monitorId: editingMonitor.id, userId })
          }
          onDeleteInvitation={handleDeleteInvitation}
          onSaveChanges={(payload) =>
            handleUpdateMonitor(editingMonitor.id, payload)
          }
          onOpenMaintenanceInfo={() => {
            navigateTo("/maintenance");
          }}
        />
      ) : selectedMonitor ? (
        <MonitorDetailsPage
          monitor={selectedMonitor}
          onBack={() => {
            navigateTo("/monitoring");
          }}
          onEdit={() => {
            navigateTo(`/monitoring/${selectedMonitor.id}/edit`);
          }}
          isActionPending={isBulkActionRunning}
          onRunCheck={() => {
            void runBulkMonitorAction("start", [selectedMonitor.id]);
          }}
          onPause={() => {
            void runBulkMonitorAction("pause", [selectedMonitor.id]);
          }}
          onResume={() => {
            void runBulkMonitorAction("resume", [selectedMonitor.id]);
          }}
          onDelete={() => {
            void (async () => {
              await runBulkMonitorAction("delete", [selectedMonitor.id]);
              navigateTo("/monitoring");
            })();
          }}
          onExportLogs={() => {
            navigateTo("/incidents");
          }}
          onOpenNotificationSettings={() => {
            navigateTo(`/monitoring/${selectedMonitor.id}/integrations-team`);
          }}
          onOpenMaintenanceInfo={() => {
            navigateTo("/maintenance");
          }}
        />
      ) : isMonitorWizardOpen ? (
        <MonitorWizardPage
          onBack={() => {
            navigateTo("/monitoring");
          }}
          canInviteTeam={canCurrentUserInviteTeam}
          onSubmitWizard={handleSubmitMonitorWizard}
        />
      ) : isBulkUploadOpen ? (
        <BulkUploadPage
          onBack={() => {
            navigateTo("/monitoring");
          }}
          canInviteTeam={canCurrentUserInviteTeam}
          onSubmitBulkUpload={handleSubmitBulkUpload}
        />
      ) : isCreatingMonitor ? (
        <NewMonitorPage
          key={
            newMonitorDraft
              ? `prefill-${JSON.stringify(newMonitorDraft)}`
              : "prefill-default"
          }
          onBack={() => {
            navigateTo("/monitoring");
          }}
          onCreateMonitor={handleCreateMonitor}
          initialName={newMonitorDraft?.name}
          initialUrl={newMonitorDraft?.url}
          initialProtocol={newMonitorDraft?.protocol}
          initialIntervalSeconds={newMonitorDraft?.intervalSeconds}
          initialTimeoutSeconds={newMonitorDraft?.timeoutSeconds}
          initialHttpMethod={newMonitorDraft?.httpMethod}
          initialDomainExpiryMode={newMonitorDraft?.domainExpiryMode}
          initialSslExpiryMode={newMonitorDraft?.sslExpiryMode}
          initialSslCheckMode={newMonitorDraft?.sslCheckMode}
          initialTagsText={newMonitorDraft?.tagsText}
          initialSlowResponseAlert={newMonitorDraft?.slowResponseAlert}
          initialSlowResponseThresholdMs={
            newMonitorDraft?.slowResponseThresholdMs
          }
          initialIpVersion={convertMonitorIpVersionToUI(
            newMonitorDraft?.ipVersion,
          )}
          initialFollowRedirections={newMonitorDraft?.followRedirections}
          initialAuthType={newMonitorDraft?.authType}
          initialAuthUsername={newMonitorDraft?.authUsername}
          initialAuthPassword={newMonitorDraft?.authPassword}
          initialRequestBody={newMonitorDraft?.requestBody}
          initialSendAsJson={newMonitorDraft?.sendAsJson}
          initialHeaderKey={newMonitorDraft?.headerKey}
          initialHeaderValue={newMonitorDraft?.headerValue}
          initialUpStatusCodeGroups={newMonitorDraft?.upStatusCodeGroups}
          notificationEmail={currentUser?.email}
        />
      ) : isIncidentsPage ? (
        <div className="panel-main">
          <IncidentsPage
            onOpenMonitor={(monitorId) => {
              navigateTo(`/monitoring/${monitorId}`);
            }}
          />
        </div>
      ) : isStatusPagesPage ? (
        selectedStatusPageId ? (
          statusPageEditorView === "monitors" ? (
            <StatusPageMonitorsPage
              statusPageId={selectedStatusPageId}
              statusPageName={
                monitorRows.find(
                  (monitor) => monitor.id === selectedStatusPageId,
                )?.name
              }
              monitors={monitorRows.map((monitor) => ({
                id: monitor.id,
                name: monitor.name,
                url: monitor.url,
                protocol: monitor.protocol,
                tags: monitor.tags,
                state: monitor.state,
                uptime: monitor.uptime,
              }))}
              onBackToMonitoring={() => {
                navigateTo("/monitoring");
              }}
              onBackToStatusPages={() => {
                navigateTo("/status-pages");
              }}
              onOpenGlobalSettings={() => {
                navigateTo(`/status-pages/${selectedStatusPageId}`);
              }}
              onCreateMonitor={() => {
                openNewMonitorPage();
              }}
            />
          ) : (
            <StatusPageInfoPage
              statusPageId={selectedStatusPageId}
              statusPageName={
                monitorRows.find(
                  (monitor) => monitor.id === selectedStatusPageId,
                )?.name
              }
              authToken={authToken}
              monitors={monitorRows.map((monitor) => ({
                id: monitor.id,
                name: monitor.name,
                url: monitor.url,
                protocol: monitor.protocol,
                tags: monitor.tags,
                state: monitor.state,
                uptime: monitor.uptime,
              }))}
              onBackToMonitoring={() => {
                navigateTo("/monitoring");
              }}
              onBackToStatusPages={() => {
                navigateTo("/status-pages");
              }}
              onOpenMonitorsStep={() => {
                navigateTo(`/status-pages/${selectedStatusPageId}/monitors`);
              }}
            />
          )
        ) : (
          <div className="panel-main">
            <StatusPagesPage
              authToken={authToken}
              onCreateStatusPage={() => {
                navigateTo("/status-pages/new/monitors");
              }}
              onOpenStatusPage={(statusPageId) => {
                navigateTo(`/status-pages/${statusPageId}`);
              }}
              onOpenStatusPageMonitors={(statusPageId) => {
                navigateTo(`/status-pages/${statusPageId}/monitors`);
              }}
              onPreviewStatusPage={(statusPageId) => {
                navigateTo(`/status-pages/${statusPageId}/public`);
              }}
            />
          </div>
        )
      ) : isTeamMembersPage ? (
        teamMembersSubPage === "invite" && isCurrentUserAdmin ? (
          <InviteTeamMemberPage
            monitorOptions={monitorRows.map((monitor) => ({
              id: monitor.id,
              name: monitor.name,
            }))}
            onInviteTeam={handleInviteTeamMember}
          />
        ) : teamMembersSubPage === "management" && isCurrentUserAdmin ? (
          <div className="panel-main">
            <TeamMembersManagementPage
              users={teamMembers}
              invitations={teamInvitations}
              accountRequests={accountRequests}
              isLoadingRequests={isLoadingAccountRequests}
              currentUserId={currentUser?.id || ""}
              currentUserRole={currentUser?.role || "user"}
              onBack={() => navigateTo("/team-members")}
              onApproveRequest={handleApproveRequest}
              onRejectRequest={handleRejectRequest}
              onDeleteUser={handleDeleteTeamUser}
              onChangeUserRole={handleTeamUserRoleChange}
              onToggleUserActive={handleTeamUserActiveToggle}
              onInviteTeam={() => navigateTo("/team-members/invite")}
              onManageRequests={
                isCurrentUserSuperAdmin
                  ? () => navigateTo("/team-members/requests")
                  : undefined
              }
              onDeleteInvitation={handleDeleteInvitation}
            />
          </div>
        ) : teamMembersSubPage === "requests" && isCurrentUserSuperAdmin ? (
          <div className="panel-main">
            <AccountRequestsPage
              accountRequests={accountRequests}
              isLoadingRequests={isLoadingAccountRequests}
              monitors={monitorRows.map((m) => ({
                id: m.id,
                name: m.name,
                protocol: m.protocol,
                status: m.state,
              }))}
              onBack={() => navigateTo("/team-members")}
              onApproveRequest={handleApproveRequest}
              onRejectRequest={handleRejectRequest}
              onDeleteApprovedRequests={handleDeleteApprovedRequests}
              onDeleteRejectedRequests={handleDeleteRejectedRequests}
            />
          </div>
        ) : teamMembersSubPage === "manage" && isCurrentUserAdmin ? (
          <TeamMembersManagePage
            users={teamMembers}
            invitations={teamInvitations}
            currentUserId={currentUser?.id}
            onBack={() => {
              navigateTo("/team-members");
            }}
            onInviteTeam={() => {
              navigateTo("/team-members/invite");
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
                    navigateTo("/team-members/invite");
                  }
                : undefined
            }
            onManageUsers={
              isCurrentUserAdmin
                ? () => {
                    navigateTo("/team-members/management");
                  }
                : undefined
            }
          />
        )
      ) : isMaintenancePage ? (
        <MaintenancePage
          onCreateMonitor={() => {
            openNewMonitorPage();
          }}
          onOpenMaintenanceWindows={() => {
            navigateTo("/maintenance/windows");
          }}
          onBackToMaintenanceOverview={() => {
            navigateTo("/maintenance");
          }}
          showWindowsOnly={maintenanceSubPage === "windows"}
        />
      ) : isChatbotPage ? (
        <div className="panel-main chatbot-page-shell">
          <ChatbotPage userName={currentUser?.name} />
        </div>
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
                    openNewMonitorPage();
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
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleNewMonitorOptionSelect("single")}
                    >
                      <span
                        className="primary-button-menu-item-icon"
                        aria-hidden="true"
                      >
                        <Plus size={14} />
                      </span>
                      <span>Single monitor</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleNewMonitorOptionSelect("wizard")}
                    >
                      <span
                        className="primary-button-menu-item-icon"
                        aria-hidden="true"
                      >
                        <Wrench size={14} />
                      </span>
                      <span>Monitor Wizard</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleNewMonitorOptionSelect("bulk")}
                    >
                      <span
                        className="primary-button-menu-item-icon"
                        aria-hidden="true"
                      >
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
                  className={`chip-button chip-counter ${areAllMonitorsSelected ? "active" : ""}`}
                  onClick={toggleAllMonitorSelections}
                >
                  <span className="counter-dot" aria-hidden="true" />
                  {selectedMonitorsCount}/{monitorRows.length}
                </button>
                <div className="bulk-actions-wrap" ref={bulkActionsMenuRef}>
                  <button
                    className={`chip-button bulk-actions-trigger ${isBulkActionsMenuOpen ? "active" : ""}`}
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
                          onClick={() =>
                            void handleBulkActionOptionSelect(bulkOption)
                          }
                          className={bulkOption === "delete" ? "delete" : ""}
                          disabled={isBulkActionRunning}
                        >
                          <span
                            className="bulk-actions-menu-icon"
                            aria-hidden="true"
                          >
                            {bulkOption === "start" ? (
                              <Play size={14} />
                            ) : bulkOption === "pause" ? (
                              <Pause size={14} />
                            ) : bulkOption === "resume" ? (
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
                    className={`chip-button monitor-tag-trigger ${isMonitorTagMenuOpen || selectedMonitorTag !== "All tags" ? "active" : ""}`}
                    type="button"
                    onClick={() => setIsMonitorTagMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isMonitorTagMenuOpen}
                  >
                    <Tag size={20} />
                    <span className="monitor-tag-label">
                      {selectedMonitorTag}
                    </span>
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
                          className={
                            selectedMonitorTag === tagOption ? "selected" : ""
                          }
                          onClick={() => {
                            setSelectedMonitorTag(tagOption);
                            setIsMonitorTagMenuOpen(false);
                          }}
                        >
                          <span>{tagOption}</span>
                          {selectedMonitorTag === tagOption ? (
                            <Check size={16} aria-hidden="true" />
                          ) : null}
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
                    onChange={(event) =>
                      setMonitorSearchQuery(event.target.value)
                    }
                  />
                </label>
                <div className="monitor-sort-wrap" ref={monitorSortMenuRef}>
                  <button
                    className={`chip-button monitor-sort-trigger ${isMonitorSortMenuOpen ? "active" : ""}`}
                    type="button"
                    onClick={() => setIsMonitorSortMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isMonitorSortMenuOpen}
                  >
                    <ArrowUpDown size={20} />
                    <span className="monitor-sort-label">
                      {monitorSortOptionLabels[monitorSortOption]}
                    </span>
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
                          className={
                            monitorSortOption === option ? "selected" : ""
                          }
                          onClick={() => {
                            setMonitorSortOption(option);
                            setIsMonitorSortMenuOpen(false);
                          }}
                        >
                          <span>{monitorSortOptionLabels[option]}</span>
                          {monitorSortOption === option ? (
                            <Check size={16} aria-hidden="true" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className={`chip-button monitor-filter-trigger ${isMonitorFilterOpen || hasActiveMonitorFilters ? "active" : ""}`}
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
                  <button
                    className="action-button"
                    type="button"
                    onClick={() => void handleTopActionClick("start")}
                    disabled={isBulkActionRunning}
                  >
                    <span className="action-icon-circle" aria-hidden="true">
                      <Play size={11} />
                    </span>
                    <span>Start</span>
                  </button>
                  <button
                    className="action-button"
                    type="button"
                    onClick={() => void handleTopActionClick("pause")}
                    disabled={isBulkActionRunning}
                  >
                    <span className="action-icon-circle" aria-hidden="true">
                      <Pause size={11} />
                    </span>
                    <span>Pause</span>
                  </button>
                  <button
                    className="action-button"
                    type="button"
                    onClick={() => void handleTopActionClick("delete")}
                    disabled={isBulkActionRunning}
                  >
                    <span className="action-icon-circle" aria-hidden="true">
                      <Trash2 size={11} />
                    </span>
                    <span>Delete</span>
                  </button>
                  <button
                    className="action-button"
                    type="button"
                    onClick={() => void handleTopActionClick("resume")}
                    disabled={isBulkActionRunning}
                  >
                    <span className="action-icon-circle" aria-hidden="true">
                      <RotateCcw size={11} />
                    </span>
                    <span>Resume</span>
                  </button>
                </div>
              </div>

              {monitorActionFeedback ? (
                <p className="monitor-table-feedback">
                  {monitorActionFeedback}
                </p>
              ) : null}

              <div className="monitor-table">
                {isMonitorsLoading ? (
                  <p className="monitor-table-feedback">
                    Chargement des monitors...
                  </p>
                ) : monitorLoadError ? (
                  <p className="monitor-table-feedback error">
                    {monitorLoadError}
                  </p>
                ) : displayedMonitors.length === 0 ? (
                  <p className="monitor-table-feedback">
                    Aucun monitor disponible.
                  </p>
                ) : (
                  displayedMonitors.map((monitor) => (
                    <article
                      className={`monitor-row ${selectedMonitorIds.includes(monitor.id) ? "selected" : ""}`}
                      key={monitor.id}
                    >
                      <div className="monitor-main">
                        <button
                          type="button"
                          className={`monitor-checkbox ${selectedMonitorIds.includes(monitor.id) ? "selected" : ""}`}
                          aria-label={
                            selectedMonitorIds.includes(monitor.id)
                              ? `Unselect ${monitor.name}`
                              : `Select ${monitor.name}`
                          }
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
                          <span
                            key={`${monitor.id}-${index}`}
                            className={`history-bar ${barState}`}
                          />
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
                  <span
                    className="status-ring-icon status-ring-triangle"
                    aria-hidden="true"
                  />
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
              <p className="status-hint">
                Using {monitorRows.length} of 50 monitors
              </p>
            </section>

            <section className="status-card">
              <h3>Last 24 hours</h3>
              <div className="hours-row">
                <div className="hours-col">
                  <p className="hours-uptime">
                    {last24HoursStats.overallUptime}
                  </p>
                  <span className="hours-label">Overall uptime</span>
                </div>
                <div className="hours-col">
                  <p className="hours-value">{last24HoursStats.incidents}</p>
                  <span className="hours-label">Incidents</span>
                </div>
              </div>
              <div className="hours-row">
                <div className="hours-col">
                  <p className="hours-meta">
                    {last24HoursStats.withoutIncident}
                  </p>
                  <span className="hours-label">Without incid.</span>
                </div>
                <div className="hours-col">
                  <p className="hours-value">
                    {last24HoursStats.affectedMonitors}
                  </p>
                  <span className="hours-label">Affected mon.</span>
                </div>
              </div>
            </section>
          </aside>

          <div
            className={`monitor-filter-overlay ${isMonitorFilterOpen ? "show" : ""}`}
            onClick={closeMonitorFilterPanel}
          />

          <aside
            className={`monitor-filter-panel ${isMonitorFilterOpen ? "show" : ""}`}
            aria-hidden={!isMonitorFilterOpen}
          >
            <header className="monitor-filter-header">
              <h3>Filter</h3>
              <button
                type="button"
                onClick={closeMonitorFilterPanel}
                aria-label="Close filter"
              >
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
                    onChange={(event) =>
                      setDraftMonitorFilterStatus(
                        event.target.value as MonitorFilterStatus,
                      )
                    }
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
                  onChange={(event) =>
                    setDraftMonitorTagQuery(event.target.value)
                  }
                />
                <div className="monitor-filter-empty">
                  <p className="monitor-filter-empty-title">
                    You don&apos;t have any tags yet.
                  </p>
                  <p className="monitor-filter-empty-copy">
                    To filter monitors based on tags create and attach tag to
                    some monitor.
                  </p>
                </div>
              </div>
            </div>

            <footer className="monitor-filter-footer">
              <button
                type="button"
                className="monitor-filter-reset"
                onClick={handleResetMonitorFilter}
              >
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
