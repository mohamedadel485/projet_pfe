import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
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
} from "lucide-react";
import {
  fetchIncidents,
  fetchMaintenances,
  fetchMonitorLogs,
  type BackendIncident,
  type BackendMaintenance,
  type BackendMaintenanceStatus,
  type BackendMonitorLog,
} from "../../lib/api";
import {
  HISTORY_BAR_COUNT,
  buildMonitorHistoryBars,
  parseUptimePercent,
  type HistoryBarState,
} from "../../lib/monitorHistory";
import { ensureChartsRegistered } from "../../lib/charts";
import { useAppLanguage } from "../../lib/language";
import "./MonitorDetailsPage.css";

interface MonitorDetails {
  id: string;
  name: string;
  protocol: string;
  url?: string;
  domainExpiryMode?: "enabled" | "disabled";
  domainExpiryAt?: string;
  domainExpiryCheckedAt?: string;
  domainExpiryError?: string;
  sslExpiryMode?: "enabled" | "disabled";
  sslExpiryAt?: string;
  sslExpiryCheckedAt?: string;
  sslExpiryError?: string;
  uptimeLabel: string;
  interval: string;
  uptime: string;
  state: "up" | "down" | "paused" | "pending";
}

interface MonitorDetailsPageProps {
  monitor: MonitorDetails;
  onBack: () => void;
  onTestNotification?: () => void;
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

type ResponseRange = "24h" | "7d" | "30d" | "365d";
type MonitorState = MonitorDetails["state"];

const DAY_MS = 24 * 60 * 60 * 1000;
const RESPONSE_POINT_COUNT = 16;

const RESPONSE_RANGE_OPTIONS: Array<{
  value: ResponseRange;
  labelKey: string;
  durationMs: number;
}> = [
  {
    value: "24h",
    labelKey: "monitorDetails.responseRange.last24Hours",
    durationMs: DAY_MS,
  },
  {
    value: "7d",
    labelKey: "monitorDetails.responseRange.last7Days",
    durationMs: 7 * DAY_MS,
  },
  {
    value: "30d",
    labelKey: "monitorDetails.responseRange.last30Days",
    durationMs: 30 * DAY_MS,
  },
  {
    value: "365d",
    labelKey: "monitorDetails.responseRange.last365Days",
    durationMs: 365 * DAY_MS,
  },
];

const MONITOR_STATE_LABEL_KEYS: Record<MonitorState, string> = {
  up: "dashboard.monitor.status.up",
  down: "dashboard.monitor.status.down",
  paused: "dashboard.monitor.status.paused",
  pending: "dashboard.monitor.status.pending",
};

const MAINTENANCE_STATUS_LABEL_KEYS: Record<BackendMaintenanceStatus, string> =
  {
    scheduled: "maintenance.status.scheduled",
    ongoing: "maintenance.status.ongoing",
    paused: "maintenance.status.paused",
    completed: "maintenance.status.completed",
    cancelled: "maintenance.status.cancelled",
  };

const getLocale = (language: string): string => {
  if (language === "fr") return "fr-FR";
  if (language === "ar") return "ar-EG";
  return "en-US";
};

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateTime = (value?: string | null, locale = "en-US"): string => {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return "-";

  return new Date(timestamp)
    .toLocaleString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: locale === "en-US",
    });
};

const formatShortDate = (value?: string | null, locale = "en-US"): string => {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return "-";

  return new Date(timestamp).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDurationFromMs = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) {
    return "0h 00m 00s";
  }

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
};

const formatCompactDuration = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0m, 0s";

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h, ${minutes}m`;
  return `${minutes}m, ${seconds}s`;
};

const formatPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return "- - -%";
  return `${value.toFixed(3)}%`;
};

const formatMs = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return "- - ms";
  return `${Math.round(value)} ms`;
};

const mapErrorMessage = (
  reason: unknown,
  fallbackMessage: string,
): string => {
  if (reason instanceof Error && reason.message.trim() !== "") {
    return reason.message;
  }
  return fallbackMessage;
};

const getResponseRangeOption = (
  range: ResponseRange,
  options: Array<{ value: ResponseRange; label: string; durationMs: number }>,
) => options.find((option) => option.value === range) ?? options[0];

const getNiceChartBounds = (values: number[]): { min: number; max: number } => {
  const cleaned = values.filter((value) => Number.isFinite(value));
  if (cleaned.length === 0) return { min: 0, max: 1 };
  const minValue = Math.min(...cleaned);
  const maxValue = Math.max(...cleaned);
  const span = Math.max(1, maxValue - minValue);
  const pad = Math.max(1, span * 0.12);
  return {
    min: Math.max(0, minValue - pad),
    max: maxValue + pad,
  };
};

const formatResponseAxisLabel = (
  value: string,
  range: ResponseRange,
  locale = "en-US",
): string => {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return "-";

  const date = new Date(timestamp);

  if (range === "24h") {
    return date
      .toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: locale === "en-US",
      });
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
};

ensureChartsRegistered();

const sampleResponseLogs = (logs: BackendMonitorLog[]): BackendMonitorLog[] => {
  if (logs.length <= RESPONSE_POINT_COUNT) return logs;

  const sampledIndices = new Set<number>();
  const lastIndex = logs.length - 1;

  sampledIndices.add(0);
  sampledIndices.add(lastIndex);

  for (let index = 0; index < RESPONSE_POINT_COUNT; index += 1) {
    const sampledIndex = Math.round(
      (index * lastIndex) / Math.max(1, RESPONSE_POINT_COUNT - 1),
    );
    sampledIndices.add(sampledIndex);
  }

  return Array.from(sampledIndices)
    .sort((left, right) => left - right)
    .map((index) => logs[index]);
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

function MonitorDetailsPage({
  monitor,
  onBack,
  onTestNotification,
  onDelete,
  onExportLogs,
  onOpenMaintenanceInfo,
  onOpenNotificationSettings,
  actionFeedback,
  refreshSignal = 0,
  isActionPending = false,
}: MonitorDetailsPageProps) {
  const { language, t, isRtl } = useAppLanguage();
  const locale = useMemo(() => getLocale(language), [language]);
  const [logs, setLogs] = useState<BackendMonitorLog[]>([]);
  const [incidents, setIncidents] = useState<BackendIncident[]>([]);
  const [maintenances, setMaintenances] = useState<BackendMaintenance[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [responseRange, setResponseRange] = useState<ResponseRange>("24h");
  const [isResponseRangeMenuOpen, setIsResponseRangeMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const responseRangeMenuRef = useRef<HTMLDivElement | null>(null);
  const responseRangeOptions = useMemo(
    () =>
      RESPONSE_RANGE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelKey),
      })),
    [t],
  );
  const monitorStateLabels = useMemo(
    () => ({
      up: t(MONITOR_STATE_LABEL_KEYS.up),
      down: t(MONITOR_STATE_LABEL_KEYS.down),
      paused: t(MONITOR_STATE_LABEL_KEYS.paused),
      pending: t(MONITOR_STATE_LABEL_KEYS.pending),
    }),
    [t],
  );
  const maintenanceStatusLabels = useMemo(
    () => ({
      scheduled: t(MAINTENANCE_STATUS_LABEL_KEYS.scheduled),
      ongoing: t(MAINTENANCE_STATUS_LABEL_KEYS.ongoing),
      paused: t(MAINTENANCE_STATUS_LABEL_KEYS.paused),
      completed: t(MAINTENANCE_STATUS_LABEL_KEYS.completed),
      cancelled: t(MAINTENANCE_STATUS_LABEL_KEYS.cancelled),
    }),
    [t],
  );
  const formatIncidentSummary = (count: number, downtime: string): string =>
    count === 1
      ? t("monitorDetails.summary.one", { downtime })
      : t("monitorDetails.summary.many", { count, downtime });
  const formatIncidentTotal = (count: number): string =>
    count === 1
      ? t("monitorDetails.total.one")
      : t("monitorDetails.total.many", { count });

  useEffect(() => {
    if (!isMoreMenuOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMoreMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMoreMenuOpen]);

  useEffect(() => {
    setResponseRange("24h");
    setIsResponseRangeMenuOpen(false);
  }, [monitor.id]);

  useEffect(() => {
    if (!isResponseRangeMenuOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        responseRangeMenuRef.current &&
        !responseRangeMenuRef.current.contains(target)
      ) {
        setIsResponseRangeMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsResponseRangeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isResponseRangeMenuOpen]);

  useEffect(() => {
    let isDisposed = false;

    const loadMonitorDetails = async (): Promise<void> => {
      setIsDataLoading(true);
      setDataError(null);

      const [logsResult, incidentsResult, maintenancesResult] =
        await Promise.allSettled([
          fetchMonitorLogs(monitor.id, undefined, { limit: 500 }),
          fetchIncidents(undefined, { limit: 500 }),
          fetchMaintenances(undefined, { monitorId: monitor.id }),
        ]);

      if (isDisposed) return;

      if (logsResult.status === "fulfilled") {
        setLogs(logsResult.value.logs);
      } else {
        setLogs([]);
      }

      if (incidentsResult.status === "fulfilled") {
        setIncidents(incidentsResult.value.incidents);
      } else {
        setIncidents([]);
      }

      if (maintenancesResult.status === "fulfilled") {
        setMaintenances(maintenancesResult.value.maintenances);
      } else {
        setMaintenances([]);
      }

      const firstError =
        logsResult.status === "rejected"
          ? logsResult.reason
          : incidentsResult.status === "rejected"
            ? incidentsResult.reason
            : maintenancesResult.status === "rejected"
              ? maintenancesResult.reason
              : null;

      setDataError(
        firstError ? mapErrorMessage(firstError, t("monitorDetails.loadError")) : null,
      );
      setIsDataLoading(false);
    };

    void loadMonitorDetails();

    return () => {
      isDisposed = true;
    };
  }, [monitor.id, refreshSignal, t]);

  useEffect(() => {
    let isDisposed = false;

    const loadRangeLogs = async (): Promise<void> => {
      const now = Date.now();
      const rangeOption = getResponseRangeOption(responseRange, responseRangeOptions);
      const startDate = new Date(now - rangeOption.durationMs).toISOString();
      const endDate = new Date(now).toISOString();

      try {
        const result = await fetchMonitorLogs(monitor.id, undefined, {
          limit: 0,
          startDate,
          endDate,
        });

        if (!isDisposed) {
          setLogs(result.logs);
        }
      } catch (error) {
        if (!isDisposed) {
          setLogs([]);
          setDataError(mapErrorMessage(error, t("monitorDetails.loadError")));
        }
      }
    };

    void loadRangeLogs();

    return () => {
      isDisposed = true;
    };
  }, [monitor.id, refreshSignal, responseRange, responseRangeOptions, t]);

  const linkLabel = monitor.url ?? t("monitorDetails.noWebsiteConfigured");
  const statusLabel = monitorStateLabels[monitor.state];
  const intervalMinutes = parseIntervalToMinutes(monitor.interval);
  const onOpenNotificationConfig =
    onOpenNotificationSettings ?? onOpenMaintenanceInfo;

  const monitorLogs = useMemo(
    () =>
      [...logs].sort(
        (a, b) => toTimestamp(a.checkedAt) - toTimestamp(b.checkedAt),
      ),
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
    () =>
      monitorLogs.filter((log) => toTimestamp(log.checkedAt) >= last24Start),
    [monitorLogs, last24Start],
  );

  const lastCheckLabel = useMemo(() => {
    const lastLog = monitorLogs[monitorLogs.length - 1];
    return lastLog ? formatDateTime(lastLog.checkedAt, locale) : t("monitorDetails.noCheckYet");
  }, [locale, monitorLogs, t]);

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
        summary: t("monitorDetails.noChecksYet"),
      };
    }

    const upChecks = logsLast24.filter((log) => log.status === "up").length;
    const downChecks = logsLast24.length - upChecks;
    const uptime = (upChecks / logsLast24.length) * 100;
    const incidentsCount = monitorIncidents.filter(
      (incident) =>
        toTimestamp(incident.startedAt ?? incident.checkedAt) >= last24Start,
    ).length;
    const downtimeMs = downChecks * intervalMinutes * 60 * 1000;

    return {
      uptime: formatPercent(uptime),
      summary: formatIncidentSummary(
        incidentsCount,
        formatCompactDuration(downtimeMs),
      ),
    };
  }, [
    intervalMinutes,
    last24Start,
    logsLast24,
    monitor.uptime,
    monitorIncidents,
    formatIncidentSummary,
    t,
  ]);

  const windowStats = useMemo(() => {
    const buildStats = (days: number): { uptime: string; summary: string } => {
      const windowStart = now - days * DAY_MS;
      const scopedLogs = monitorLogs.filter(
        (log) => toTimestamp(log.checkedAt) >= windowStart,
      );
      const scopedIncidents = monitorIncidents.filter(
        (incident) =>
          toTimestamp(incident.startedAt ?? incident.checkedAt) >= windowStart,
      );

      if (scopedLogs.length === 0) {
        return {
          uptime: "- - -%",
          summary: t("monitorDetails.noChecksYet"),
        };
      }

      const upChecks = scopedLogs.filter((log) => log.status === "up").length;
      const downChecks = scopedLogs.length - upChecks;
      const uptime = (upChecks / scopedLogs.length) * 100;
      const downtimeMs = downChecks * intervalMinutes * 60 * 1000;

      return {
        uptime: formatPercent(uptime),
        summary: formatIncidentSummary(
          scopedIncidents.length,
          formatCompactDuration(downtimeMs),
        ),
      };
    };

    return {
      sevenDays: buildStats(7),
      thirtyDays: buildStats(30),
      year: buildStats(365),
    };
  }, [formatIncidentSummary, intervalMinutes, monitorIncidents, monitorLogs, now, t]);

  const responseRangeOption = getResponseRangeOption(
    responseRange,
    responseRangeOptions,
  );

  const responseWindowLogs = useMemo(() => {
    const windowStart = now - responseRangeOption.durationMs;
    return monitorLogs.filter(
      (log) => toTimestamp(log.checkedAt) >= windowStart,
    );
  }, [monitorLogs, now, responseRangeOption.durationMs]);

  const responseChartLogs = useMemo(
    () => sampleResponseLogs(responseWindowLogs),
    [responseWindowLogs],
  );

  const responseStats = useMemo<ResponseStats>(() => {
    if (responseWindowLogs.length === 0) {
      return { average: null, minimum: null, maximum: null };
    }

    const values = responseWindowLogs.map((log) =>
      Math.max(0, log.responseTime),
    );
    const sum = values.reduce((acc, value) => acc + value, 0);

    return {
      average: sum / values.length,
      minimum: Math.min(...values),
      maximum: Math.max(...values),
    };
  }, [responseWindowLogs]);

  const responseChartMax = useMemo(() => {
    if (responseStats.maximum === null) return 2000;
    if (responseStats.maximum <= 500) return 500;
    if (responseStats.maximum <= 1000) return 1000;
    if (responseStats.maximum <= 2000) return 2000;
    if (responseStats.maximum <= 5000) return 5000;
    if (responseStats.maximum <= 10000) return 10000;
    return Math.ceil(responseStats.maximum / 5000) * 5000;
  }, [responseStats.maximum]);

  const responseChartBounds = useMemo(() => {
    const values = responseWindowLogs.map((log) =>
      Math.max(0, log.responseTime),
    );
    const nice = getNiceChartBounds(values);
    return {
      min: 0,
      max: Math.max(1, responseChartMax, nice.max),
    };
  }, [responseChartMax, responseWindowLogs]);

  const responseChartData = useMemo(() => {
    const labels = responseChartLogs.map((log) => log.checkedAt ?? "");
    return {
      labels,
      datasets: [
        {
          label: t("monitorDetails.responseTime"),
          data: responseChartLogs.map((log) => Math.max(0, log.responseTime)),
          fill: true,
          tension: 0.35,
          borderWidth: 2.8,
          pointRadius: (ctx: any) => {
            const idx = ctx.dataIndex ?? 0;
            const last = (ctx.dataset?.data?.length ?? 1) - 1;
            return idx === last ? 4 : 0;
          },
          pointHoverRadius: 5,
          pointBackgroundColor: "#ffffff",
          pointBorderWidth: 2,
          pointBorderColor: "#2f79ff",
          borderColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "#2f79ff";
            const gradient = ctx.createLinearGradient(
              chartArea.left,
              0,
              chartArea.right,
              0,
            );
            gradient.addColorStop(0, "#2f79ff");
            gradient.addColorStop(1, "#14b8a6");
            return gradient;
          },
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(47,121,255,0.12)";
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );
            gradient.addColorStop(0, "rgba(47,121,255,0.20)");
            gradient.addColorStop(0.72, "rgba(47,121,255,0.06)");
            gradient.addColorStop(1, "rgba(47,121,255,0)");
            return gradient;
          },
        },
      ],
    };
  }, [responseChartLogs, t]);

  const responseChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: 0 },
      elements: {
        line: { borderCapStyle: "round", borderJoinStyle: "round" },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: (context: any) => {
            const { chart, tooltip } = context;
            const parent = chart?.canvas?.parentNode as HTMLElement | null;
            if (!parent) return;

            let tooltipEl = parent.querySelector(
              ".response-chart-tooltip",
            ) as HTMLDivElement | null;
            if (!tooltipEl) {
              tooltipEl = document.createElement("div");
              tooltipEl.className = "response-chart-tooltip above";
              tooltipEl.style.position = "absolute";
              tooltipEl.style.pointerEvents = "none";
              tooltipEl.style.opacity = "0";
              parent.appendChild(tooltipEl);
            }

            if (
              !tooltip ||
              tooltip.opacity === 0 ||
              !tooltip.dataPoints?.length
            ) {
              tooltipEl.style.opacity = "0";
              return;
            }

            const dataPoint = tooltip.dataPoints[0];
            const index = dataPoint?.dataIndex ?? 0;
            const log = responseChartLogs[index];
            const checkedAt = log?.checkedAt
              ? formatDateTime(log.checkedAt, locale)
              : "-";
            const responseTime = Number.isFinite(log?.responseTime)
              ? formatMs(log!.responseTime)
              : "-";
            const status = log?.status === "down" ? "down" : "up";
            const statusLabel =
              status === "up" ? monitorStateLabels.up : monitorStateLabels.down;

            const placement = tooltip.caretY < 36 ? "below" : "above";
            tooltipEl.className = `response-chart-tooltip ${placement}`;
            tooltipEl.innerHTML = `
              <span class="response-chart-tooltip-time">${checkedAt}</span>
              <div class="response-chart-tooltip-row">
                <span class="response-chart-tooltip-dot ${status}" aria-hidden="true"></span>
                <strong>${responseTime}</strong>
                <span class="response-chart-tooltip-status">${statusLabel}</span>
              </div>
            `;

            const leftPct = (tooltip.caretX / chart.width) * 100;
            const topPct = (tooltip.caretY / chart.height) * 100;
            tooltipEl.style.left = `clamp(72px, ${leftPct}%, calc(100% - 72px))`;
            tooltipEl.style.top = `${topPct}%`;
            tooltipEl.style.opacity = "1";
          },
          callbacks: {
            title: (items: any[]) => {
              const raw = items?.[0]?.label as string | undefined;
              return raw ? formatDateTime(raw, locale) : "-";
            },
            label: (item: any) => {
              const value = item.parsed?.y as number | undefined;
              return value === undefined ? "-" : `${Math.round(value)} ms`;
            },
            afterLabel: (item: any) => {
              const index = item.dataIndex ?? 0;
              const status = responseChartLogs[index]?.status;
              const statusLabel =
                status === "up" ? monitorStateLabels.up : monitorStateLabels.down;
              return status ? t("monitorDetails.tooltipStatus", { status: statusLabel }) : "";
            },
          },
        },
      },
      interaction: { mode: "index" as const, intersect: false },
      scales: {
        x: { display: false },
        y: {
          display: false,
          min: responseChartBounds.min,
          max: responseChartBounds.max,
        },
      },
    };
  }, [
    locale,
    monitorStateLabels,
    responseChartBounds.max,
    responseChartBounds.min,
    responseChartLogs,
    t,
  ]);

  const responseXAxisLabels = useMemo(() => {
    if (responseChartLogs.length === 0) {
      return ["-", "-", "-"];
    }

    const middleIndex = Math.floor(responseChartLogs.length / 2);
    return [
      formatResponseAxisLabel(
        responseChartLogs[0].checkedAt,
        responseRange,
        locale,
      ),
      formatResponseAxisLabel(
        responseChartLogs[middleIndex].checkedAt,
        responseRange,
        locale,
      ),
      formatResponseAxisLabel(
        responseChartLogs[responseChartLogs.length - 1].checkedAt,
        responseRange,
        locale,
      ),
    ];
  }, [locale, responseChartLogs, responseRange]);

  const latestIncidentRows = useMemo(
    () =>
      monitorIncidents.slice(0, 4).map((incident) => {
        const startedAt = incident.startedAt ?? incident.checkedAt;
        const durationMs = incident.durationMs ?? 0;
        const isOngoing = incident.status === "down";
        const rootCause =
          incident.errorMessage ||
          (incident.statusCode
            ? t("monitorDetails.rootCauseHttp", { statusCode: incident.statusCode })
            : t("monitorDetails.unknownError"));

        return {
          id: incident._id,
          status: isOngoing
            ? t("incidents.status.ongoing")
            : t("incidents.status.resolved"),
          isOngoing,
          rootCause,
          started: formatDateTime(startedAt, locale),
          duration: formatDurationFromMs(durationMs),
        };
      }),
    [locale, monitorIncidents, t],
  );

  const nextMaintenance = useMemo(() => {
    const activeStatuses = new Set(["scheduled", "ongoing", "paused"]);
    return (
      maintenances
        .filter((maintenance) => maintenance.monitor?._id === monitor.id)
        .filter(
          (maintenance) =>
            activeStatuses.has(maintenance.status) &&
            toTimestamp(maintenance.endAt) >= Date.now(),
        )
        .sort((a, b) => toTimestamp(a.startAt) - toTimestamp(b.startAt))[0] ??
      null
    );
  }, [maintenances, monitor.id]);

  const domainAndSsl = useMemo(() => {
    try {
      const parsedUrl = new URL(monitor.url ?? "");
      const isTls =
        parsedUrl.protocol === "https:" || parsedUrl.protocol === "wss:";
      return {
        domain: parsedUrl.host,
        ssl: isTls ? t("monitorDetails.sslActive") : t("monitorDetails.sslNotApplicable"),
      };
    } catch {
      return {
        domain: t("monitorDetails.unavailable"),
        ssl: t("monitorDetails.unavailable"),
      };
    }
  }, [monitor.url, t]);

  const domainExpiryLabel = useMemo(() => {
    if (monitor.domainExpiryMode !== "enabled") {
      return t("monitorDetails.disabled");
    }
    if (!monitor.domainExpiryCheckedAt) {
      return t("monitorDetails.checking");
    }
    if (!monitor.domainExpiryAt) {
      return t("monitorDetails.unavailable");
    }
    return formatShortDate(monitor.domainExpiryAt, locale);
  }, [
    locale,
    monitor.domainExpiryAt,
    monitor.domainExpiryCheckedAt,
    monitor.domainExpiryMode,
    t,
  ]);

  const sslExpiryLabel = useMemo(() => {
    if (monitor.sslExpiryMode !== "enabled") {
      return t("monitorDetails.disabled");
    }
    if (!monitor.sslExpiryCheckedAt) {
      return t("monitorDetails.checking");
    }
    if (!monitor.sslExpiryAt) {
      return t("monitorDetails.unavailable");
    }
    return formatShortDate(monitor.sslExpiryAt, locale);
  }, [
    locale,
    monitor.sslExpiryAt,
    monitor.sslExpiryCheckedAt,
    monitor.sslExpiryMode,
    t,
  ]);

  return (
    <section className="monitor-details-page">
      <div className="monitor-details-breadcrumb">
        <button type="button" className="monitor-details-back" onClick={onBack}>
          {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          <span>{t("menu.monitoring")}</span>
        </button>
        {isRtl ? (
          <ChevronLeft size={14} className="monitor-details-separator" />
        ) : (
          <ChevronRight size={14} className="monitor-details-separator" />
        )}
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
                <span>{t("monitorDetails.monitorFor", { protocol: monitor.protocol })} </span>
                <a
                  href={monitor.url}
                  target="_blank"
                  rel="noreferrer"
                  className="monitor-details-link"
                >
                  {linkLabel}
                </a>
                <ExternalLink size={12} />
              </p>
            ) : (
              <p>
                {t("monitorDetails.monitorFor", { protocol: monitor.protocol })} {linkLabel}
              </p>
            )}
          </div>
        </div>

        <div className="monitor-details-actions">
          <button
            type="button"
            className="monitor-action-button"
            onClick={onTestNotification}
            disabled={isActionPending}
          >
            <Bell size={13} />
            {t("monitorDetails.actions.testNotification")}
          </button>
          <div className="monitor-details-more-menu" ref={moreMenuRef}>
            <button
              type="button"
              className="monitor-details-more-button"
              aria-label={t("monitorDetails.actions.moreActions")}
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
                  {t("monitorDetails.actions.deleteMonitor")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {actionFeedback ? (
        <p className="monitor-details-action-feedback">{actionFeedback}</p>
      ) : null}
      {dataError ? (
        <p className="monitor-details-data-error">{dataError}</p>
      ) : null}

      <div className="monitor-details-content-grid">
        <div className="monitor-details-main-column">
          <div className="monitor-details-stats-grid">
            <article>
              <h3>{t("dashboard.status.current")}</h3>
              <p
                className={monitor.state === "up" ? "status-up" : "status-down"}
              >
                {statusLabel}
              </p>
              <span>{t("monitorDetails.currently", { status: statusLabel.toLowerCase() })}</span>
            </article>
            <article>
              <h3>{t("monitorDetails.lastCheck")}</h3>
              <p>{isDataLoading ? t("common.loading") : lastCheckLabel}</p>
              <span>{t("monitorDetails.checkedEvery", { interval: monitor.interval })}</span>
            </article>
            <article className="monitor-last24-card">
              <div className="stat-row-head">
                <h3>{t("dashboard.last24Hours")}</h3>
                <strong>{last24Summary.uptime}</strong>
              </div>
              <div
                className="mini-history"
                aria-hidden="true"
                style={{
                  gridTemplateColumns: `repeat(${last24HistoryBars.length}, minmax(0, 1fr))`,
                }}
              >
                {last24HistoryBars.map((state, index) => (
                  <span
                    key={`last24-${monitor.id}-${index}`}
                    className={`mini-history-bar ${state}`}
                  />
                ))}
              </div>
              <span>{last24Summary.summary}</span>
            </article>
          </div>

          <section className="monitor-details-ranges-card">
            <article className="range-cell">
              <h3>{t("monitorDetails.responseRange.last7Days")}</h3>
              <p>{windowStats.sevenDays.uptime}</p>
              <span>{windowStats.sevenDays.summary}</span>
            </article>
            <article className="range-cell">
              <h3>{t("monitorDetails.responseRange.last30Days")}</h3>
              <p>{windowStats.thirtyDays.uptime}</p>
              <span>{windowStats.thirtyDays.summary}</span>
            </article>
            <article className="range-cell">
              <h3>{t("monitorDetails.responseRange.last365Days")}</h3>
              <p>{windowStats.year.uptime}</p>
              <span>{windowStats.year.summary}</span>
            </article>
            <article className="range-cell">
              <button
                type="button"
                className="range-picker-button"
                onClick={onExportLogs}
              >
                <CalendarClock size={12} />
                <span>{t("monitorDetails.openIncidents")}</span>
                <ChevronDown size={13} />
              </button>
              <p>{monitor.uptime}</p>
              <span>{formatIncidentTotal(monitorIncidents.length)}</span>
            </article>
          </section>

          <section className="monitor-details-response">
            <div className="response-header">
              <h3>{t("monitorDetails.responseTime")}</h3>
              <div
                className="response-range-menu-wrap"
                ref={responseRangeMenuRef}
              >
                <button
                  type="button"
                  className={`response-range-button ${isResponseRangeMenuOpen ? "open" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isResponseRangeMenuOpen}
                  aria-label={t("monitorDetails.selectResponseRange")}
                  onClick={() =>
                    setIsResponseRangeMenuOpen((previousOpen) => !previousOpen)
                  }
                >
                  <span>{responseRangeOption.label}</span>
                  <ChevronDown size={13} />
                </button>
                {isResponseRangeMenuOpen ? (
                  <div className="response-range-menu" role="menu">
                    {responseRangeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={responseRange === option.value}
                        className={`response-range-menu-item ${responseRange === option.value ? "selected" : ""}`}
                        onClick={() => {
                          setResponseRange(option.value);
                          setIsResponseRangeMenuOpen(false);
                        }}
                      >
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="response-chart-layout">
              <div className="response-y-axis" aria-hidden="true">
                <span>{Math.round(responseChartBounds.max)} ms</span>
                <span>{Math.round(responseChartBounds.max / 2)} ms</span>
                <span>0 ms</span>
              </div>
              <div className="response-chart-wrap">
                <div
                  className={`response-chart ${responseWindowLogs.length === 0 ? "empty" : ""}`}
                  aria-hidden="true"
                >
                  <Line
                    data={responseChartData as any}
                    options={responseChartOptions as any}
                  />
                  {responseWindowLogs.length === 0 ? (
                    <div className="response-chart-empty">
                      {t("monitorDetails.noResponseData")}
                    </div>
                  ) : null}
                </div>
                <div className="response-x-axis" aria-hidden="true">
                  {responseXAxisLabels.map((label, index) => (
                    <span key={`${responseRange}-${index}-${label}`}>
                      {label}
                    </span>
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
                <span>{t("monitorDetails.average")}</span>
              </article>
              <article className="metric-min">
                <div className="metric-value">
                  <ArrowDownLeft size={14} />
                  <strong>{formatMs(responseStats.minimum)}</strong>
                </div>
                <span>{t("monitorDetails.minimum")}</span>
              </article>
              <article className="metric-max">
                <div className="metric-value">
                  <ArrowUpLeft size={14} />
                  <strong>{formatMs(responseStats.maximum)}</strong>
                </div>
                <span>{t("monitorDetails.maximum")}</span>
              </article>
            </div>
          </section>

          <section className="monitor-details-incidents">
            <div className="incidents-header">
              <h3>{t("monitorDetails.latestIncidents")}</h3>
              <button type="button" onClick={onExportLogs}>
                <Upload size={13} />
                {t("monitorDetails.exportLogs")}
              </button>
            </div>
            <div className="incidents-table">
              <div className="incidents-table-head">
                <span>{t("incidents.table.status")}</span>
                <span>{t("incidents.table.rootCause")}</span>
                <span>{t("incidents.table.started")}</span>
                <span>{t("incidents.table.duration")}</span>
              </div>
              {latestIncidentRows.length === 0 ? (
                <div className="incidents-row">
                  <span>{t("monitorDetails.noIncidents")}</span>
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                </div>
              ) : null}
              {latestIncidentRows.map((incident) => (
                <div className="incidents-row" key={incident.id}>
                  <span
                    className={`resolved-pill ${incident.isOngoing ? "ongoing" : ""}`}
                  >
                    <span
                      className={`resolved-dot ${incident.isOngoing ? "ongoing" : ""}`}
                      aria-hidden="true"
                    />
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
            <h3>{t("monitorDetails.domainSsl")}</h3>
            <p>{t("monitorDetails.domainPrefix", { domain: domainAndSsl.domain })}</p>
            <p>{t("monitorDetails.sslPrefix", { ssl: domainAndSsl.ssl })}</p>
            <p>{t("monitorDetails.sslExpiryPrefix", { value: sslExpiryLabel })}</p>
            {monitor.sslExpiryMode === "enabled" &&
            monitor.sslExpiryCheckedAt ? (
              <p>
                {t("monitorDetails.sslCheckedPrefix", {
                  date: formatDateTime(monitor.sslExpiryCheckedAt, locale),
                })}
              </p>
            ) : null}
            {monitor.sslExpiryMode === "enabled" && monitor.sslExpiryError ? (
              <p>
                {t("monitorDetails.sslErrorPrefix", {
                  message: monitor.sslExpiryError,
                })}
              </p>
            ) : null}
            <p>{t("monitorDetails.domainExpiryPrefix", { value: domainExpiryLabel })}</p>
            {monitor.domainExpiryMode === "enabled" &&
            monitor.domainExpiryCheckedAt ? (
              <p>
                {t("monitorDetails.domainCheckedPrefix", {
                  date: formatDateTime(monitor.domainExpiryCheckedAt, locale),
                })}
              </p>
            ) : null}
            {monitor.domainExpiryMode === "enabled" &&
            monitor.domainExpiryError ? (
              <p>
                {t("monitorDetails.domainErrorPrefix", {
                  message: monitor.domainExpiryError,
                })}
              </p>
            ) : null}
          </article>
          <article className="monitor-side-card">
            <div className="monitor-side-card-head">
              <h3>{t("monitorDetails.nextMaintenance")}</h3>
              <button
                type="button"
                className="side-card-settings-button"
                aria-label={t("monitorDetails.openMaintenanceSettings")}
                onClick={onOpenMaintenanceInfo}
                disabled={!onOpenMaintenanceInfo}
              >
                <span
                  className="material-symbols-outlined side-card-settings-icon"
                  aria-hidden="true"
                >
                  settings
                </span>
              </button>
            </div>
            {nextMaintenance ? (
              <>
                <p>
                  {maintenanceStatusLabels[nextMaintenance.status]} -{" "}
                  {formatDateTime(nextMaintenance.startAt, locale)}
                </p>
                <p>{nextMaintenance.name}</p>
              </>
            ) : (
              <p>{t("monitorDetails.noMaintenancePlanned")}</p>
            )}
            <button type="button" onClick={onOpenMaintenanceInfo} disabled={!onOpenMaintenanceInfo}>
              {t("monitorDetails.setUpMaintenance")}
            </button>
          </article>
          <article className="monitor-side-card">
            <div className="monitor-side-card-head">
              <h3>{t("monitorDetails.toBeNotified")}</h3>
              <button
                type="button"
                className="side-card-settings-button"
                aria-label={t("monitorDetails.openNotificationSettings")}
                onClick={onOpenNotificationConfig}
                disabled={!onOpenNotificationConfig}
              >
                <span
                  className="material-symbols-outlined side-card-settings-icon"
                  aria-hidden="true"
                >
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
