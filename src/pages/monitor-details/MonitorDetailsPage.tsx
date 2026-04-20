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
  isApiError,
  type BackendIncident,
  type BackendMaintenance,
  type BackendMonitorLog,
} from "../../lib/api";
import {
  HISTORY_BAR_COUNT,
  buildMonitorHistoryBars,
  parseUptimePercent,
  type HistoryBarState,
} from "../../lib/monitorHistory";
import { ensureChartsRegistered } from "../../lib/charts";
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
  onEdit: () => void;
  onRunCheck?: () => void;
  onPause?: () => void;
  onResume?: () => void;
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

const DAY_MS = 24 * 60 * 60 * 1000;
const RESPONSE_POINT_COUNT = 16;

const RESPONSE_RANGE_OPTIONS: Array<{
  value: ResponseRange;
  label: string;
  durationMs: number;
}> = [
  { value: "24h", label: "Last 24 hours", durationMs: DAY_MS },
  { value: "7d", label: "Last 7 days", durationMs: 7 * DAY_MS },
  { value: "30d", label: "Last 30 days", durationMs: 30 * DAY_MS },
  { value: "365d", label: "Last 365 days", durationMs: 365 * DAY_MS },
];

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateTime = (value?: string | null): string => {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return "-";

  return new Date(timestamp)
    .toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s(AM|PM)$/i, "$1");
};

const formatShortDate = (value?: string | null): string => {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return "-";

  return new Date(timestamp).toLocaleDateString("en-US", {
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

const getResponseRangeOption = (range: ResponseRange) =>
  RESPONSE_RANGE_OPTIONS.find((option) => option.value === range) ??
  RESPONSE_RANGE_OPTIONS[0];

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
): string => {
  const timestamp = toTimestamp(value);
  if (timestamp === 0) return "-";

  const date = new Date(timestamp);

  if (range === "24h") {
    return date
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(/\s(AM|PM)$/i, "$1");
  }

  return date.toLocaleDateString("en-US", {
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

const mapErrorMessage = (reason: unknown): string => {
  if (isApiError(reason)) {
    return reason.message || `API error (${reason.status})`;
  }
  if (reason instanceof Error && reason.message.trim() !== "") {
    return reason.message;
  }
  return "Impossible de charger les details du monitor.";
};

function MonitorDetailsPage({
  monitor,
  onBack,
  onEdit,
  onRunCheck,
  onPause,
  onResume,
  onDelete,
  onExportLogs,
  onOpenMaintenanceInfo,
  onOpenNotificationSettings,
  actionFeedback,
  refreshSignal = 0,
  isActionPending = false,
}: MonitorDetailsPageProps) {
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

      setDataError(firstError ? mapErrorMessage(firstError) : null);
      setIsDataLoading(false);
    };

    void loadMonitorDetails();

    return () => {
      isDisposed = true;
    };
  }, [monitor.id, refreshSignal]);

  useEffect(() => {
    let isDisposed = false;

    const loadRangeLogs = async (): Promise<void> => {
      const now = Date.now();
      const rangeOption = getResponseRangeOption(responseRange);
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
          setDataError(mapErrorMessage(error));
        }
      }
    };

    void loadRangeLogs();

    return () => {
      isDisposed = true;
    };
  }, [monitor.id, refreshSignal, responseRange]);

  const linkLabel = monitor.url ?? "No website configured";
  const isPausedOrPending =
    monitor.state === "paused" || monitor.state === "pending";
  const statusLabel =
    monitor.state === "up"
      ? "Up"
      : monitor.state === "down"
        ? "Down"
        : monitor.state === "paused"
          ? "Paused"
          : "Pending";
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
    return lastLog ? formatDateTime(lastLog.checkedAt) : "No check yet";
  }, [monitorLogs]);

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
        incidents: 0,
        downtime: "0m, 0s down",
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
      incidents: incidentsCount,
      downtime: `${formatCompactDuration(downtimeMs)} down`,
    };
  }, [
    intervalMinutes,
    last24Start,
    logsLast24,
    monitor.uptime,
    monitorIncidents,
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
          summary: "No checks yet",
        };
      }

      const upChecks = scopedLogs.filter((log) => log.status === "up").length;
      const downChecks = scopedLogs.length - upChecks;
      const uptime = (upChecks / scopedLogs.length) * 100;
      const downtimeMs = downChecks * intervalMinutes * 60 * 1000;

      return {
        uptime: formatPercent(uptime),
        summary: `${scopedIncidents.length} incident(s), ${formatCompactDuration(downtimeMs)} down`,
      };
    };

    return {
      sevenDays: buildStats(7),
      thirtyDays: buildStats(30),
      year: buildStats(365),
    };
  }, [intervalMinutes, monitorIncidents, monitorLogs, now]);

  const responseRangeOption = getResponseRangeOption(responseRange);

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
          label: "Response time",
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
  }, [responseChartLogs]);

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
              ? formatDateTime(log.checkedAt)
              : "-";
            const responseTime = Number.isFinite(log?.responseTime)
              ? formatMs(log!.responseTime)
              : "-";
            const status = log?.status === "down" ? "down" : "up";

            const placement = tooltip.caretY < 36 ? "below" : "above";
            tooltipEl.className = `response-chart-tooltip ${placement}`;
            tooltipEl.innerHTML = `
              <span class="response-chart-tooltip-time">${checkedAt}</span>
              <div class="response-chart-tooltip-row">
                <span class="response-chart-tooltip-dot ${status}" aria-hidden="true"></span>
                <strong>${responseTime}</strong>
                <span class="response-chart-tooltip-status">${status === "up" ? "Up" : "Down"}</span>
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
              return raw ? formatDateTime(raw) : "-";
            },
            label: (item: any) => {
              const value = item.parsed?.y as number | undefined;
              return value === undefined ? "-" : `${Math.round(value)} ms`;
            },
            afterLabel: (item: any) => {
              const index = item.dataIndex ?? 0;
              const status = responseChartLogs[index]?.status;
              return status ? `Status: ${status === "up" ? "Up" : "Down"}` : "";
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
  }, [responseChartBounds.max, responseChartBounds.min, responseChartLogs]);

  const responseXAxisLabels = useMemo(() => {
    if (responseChartLogs.length === 0) {
      return ["-", "-", "-"];
    }

    const middleIndex = Math.floor(responseChartLogs.length / 2);
    return [
      formatResponseAxisLabel(responseChartLogs[0].checkedAt, responseRange),
      formatResponseAxisLabel(
        responseChartLogs[middleIndex].checkedAt,
        responseRange,
      ),
      formatResponseAxisLabel(
        responseChartLogs[responseChartLogs.length - 1].checkedAt,
        responseRange,
      ),
    ];
  }, [responseChartLogs, responseRange]);

  const latestIncidentRows = useMemo(
    () =>
      monitorIncidents.slice(0, 4).map((incident) => {
        const startedAt = incident.startedAt ?? incident.checkedAt;
        const durationMs = incident.durationMs ?? 0;
        const isOngoing = incident.status === "down";
        const rootCause =
          incident.errorMessage ||
          (incident.statusCode
            ? `HTTP ${incident.statusCode}`
            : "Unknown error");

        return {
          id: incident._id,
          status: isOngoing ? "Ongoing" : "Resolved",
          isOngoing,
          rootCause,
          started: formatDateTime(startedAt),
          duration: formatDurationFromMs(durationMs),
        };
      }),
    [monitorIncidents],
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
        ssl: isTls ? "TLS/SSL check active" : "TLS/SSL not applicable",
      };
    } catch {
      return {
        domain: "Unavailable",
        ssl: "Unavailable",
      };
    }
  }, [monitor.url]);

  const domainExpiryLabel = useMemo(() => {
    if (monitor.domainExpiryMode !== "enabled") {
      return "Disabled";
    }
    if (!monitor.domainExpiryCheckedAt) {
      return "Checking...";
    }
    if (!monitor.domainExpiryAt) {
      return "Unavailable";
    }
    return formatShortDate(monitor.domainExpiryAt);
  }, [
    monitor.domainExpiryAt,
    monitor.domainExpiryCheckedAt,
    monitor.domainExpiryMode,
  ]);

  const sslExpiryLabel = useMemo(() => {
    if (monitor.sslExpiryMode !== "enabled") {
      return "Disabled";
    }
    if (!monitor.sslExpiryCheckedAt) {
      return "Checking...";
    }
    if (!monitor.sslExpiryAt) {
      return "Unavailable";
    }
    return formatShortDate(monitor.sslExpiryAt);
  }, [monitor.sslExpiryAt, monitor.sslExpiryCheckedAt, monitor.sslExpiryMode]);

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
                {monitor.protocol}/s monitor for {linkLabel}
              </p>
            )}
          </div>
        </div>

        <div className="monitor-details-actions">
          <button
            type="button"
            className="monitor-action-button"
            onClick={onRunCheck}
            disabled={isActionPending}
          >
            <Bell size={13} />
            Test Notification
          </button>
          <button
            type="button"
            className="monitor-action-button"
            onClick={isPausedOrPending ? onResume : onPause}
            disabled={isActionPending}
          >
            <span
              className="material-symbols-outlined monitor-pause-icon"
              aria-hidden="true"
            >
              {isPausedOrPending ? "play_circle" : "pause_circle"}
            </span>
            {isPausedOrPending ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            className="monitor-action-button"
            onClick={onEdit}
          >
            <span
              className="material-symbols-outlined monitor-edit-icon"
              aria-hidden="true"
            >
              settings
            </span>
            Edit
          </button>
          <div className="monitor-details-more-menu" ref={moreMenuRef}>
            <button
              type="button"
              className="monitor-details-more-button"
              aria-label="More actions"
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
                  Delete monitor
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
              <h3>Current status</h3>
              <p
                className={monitor.state === "up" ? "status-up" : "status-down"}
              >
                {statusLabel}
              </p>
              <span>Currently {monitor.uptimeLabel.toLowerCase()}</span>
            </article>
            <article>
              <h3>Last check</h3>
              <p>{isDataLoading ? "Loading..." : lastCheckLabel}</p>
              <span>Checked every {monitor.interval}</span>
            </article>
            <article className="monitor-last24-card">
              <div className="stat-row-head">
                <h3>Last 24 hours</h3>
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
              <span>
                {last24Summary.incidents} incidents, {last24Summary.downtime}
              </span>
            </article>
          </div>

          <section className="monitor-details-ranges-card">
            <article className="range-cell">
              <h3>Last 7 days</h3>
              <p>{windowStats.sevenDays.uptime}</p>
              <span>{windowStats.sevenDays.summary}</span>
            </article>
            <article className="range-cell">
              <h3>Last 30 days</h3>
              <p>{windowStats.thirtyDays.uptime}</p>
              <span>{windowStats.thirtyDays.summary}</span>
            </article>
            <article className="range-cell">
              <h3>Last 365 days</h3>
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
                <span>Open incidents</span>
                <ChevronDown size={13} />
              </button>
              <p>{monitor.uptime}</p>
              <span>{monitorIncidents.length} incidents total</span>
            </article>
          </section>

          <section className="monitor-details-response">
            <div className="response-header">
              <h3>Response time</h3>
              <div
                className="response-range-menu-wrap"
                ref={responseRangeMenuRef}
              >
                <button
                  type="button"
                  className={`response-range-button ${isResponseRangeMenuOpen ? "open" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isResponseRangeMenuOpen}
                  aria-label="Select response time window"
                  onClick={() =>
                    setIsResponseRangeMenuOpen((previousOpen) => !previousOpen)
                  }
                >
                  <span>{responseRangeOption.label}</span>
                  <ChevronDown size={13} />
                </button>
                {isResponseRangeMenuOpen ? (
                  <div className="response-range-menu" role="menu">
                    {RESPONSE_RANGE_OPTIONS.map((option) => (
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
                      No response data for this period
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
                <span>Average</span>
              </article>
              <article className="metric-min">
                <div className="metric-value">
                  <ArrowDownLeft size={14} />
                  <strong>{formatMs(responseStats.minimum)}</strong>
                </div>
                <span>Minimum</span>
              </article>
              <article className="metric-max">
                <div className="metric-value">
                  <ArrowUpLeft size={14} />
                  <strong>{formatMs(responseStats.maximum)}</strong>
                </div>
                <span>Maximum</span>
              </article>
            </div>
          </section>

          <section className="monitor-details-incidents">
            <div className="incidents-header">
              <h3>Latest incidents</h3>
              <button type="button" onClick={onExportLogs}>
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
              {latestIncidentRows.length === 0 ? (
                <div className="incidents-row">
                  <span>No incidents</span>
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
            <h3>Domain & SSL</h3>
            <p>Domain: {domainAndSsl.domain}</p>
            <p>SSL: {domainAndSsl.ssl}</p>
            <p>SSL expiry: {sslExpiryLabel}</p>
            {monitor.sslExpiryMode === "enabled" &&
            monitor.sslExpiryCheckedAt ? (
              <p>SSL checked: {formatDateTime(monitor.sslExpiryCheckedAt)}</p>
            ) : null}
            {monitor.sslExpiryMode === "enabled" && monitor.sslExpiryError ? (
              <p>SSL error: {monitor.sslExpiryError}</p>
            ) : null}
            <p>Domain expiry: {domainExpiryLabel}</p>
            {monitor.domainExpiryMode === "enabled" &&
            monitor.domainExpiryCheckedAt ? (
              <p>
                WHOIS checked: {formatDateTime(monitor.domainExpiryCheckedAt)}
              </p>
            ) : null}
            {monitor.domainExpiryMode === "enabled" &&
            monitor.domainExpiryError ? (
              <p>WHOIS error: {monitor.domainExpiryError}</p>
            ) : null}
          </article>
          <article className="monitor-side-card">
            <div className="monitor-side-card-head">
              <h3>Next maintenance</h3>
              <button
                type="button"
                className="side-card-settings-button"
                aria-label="Open maintenance settings"
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
                  {nextMaintenance.status.toUpperCase()} -{" "}
                  {formatDateTime(nextMaintenance.startAt)}
                </p>
                <p>{nextMaintenance.name}</p>
              </>
            ) : (
              <p>No maintenance planned</p>
            )}
            <button type="button" onClick={onOpenMaintenanceInfo}>
              Set up maintenance
            </button>
          </article>
          <article className="monitor-side-card">
            <div className="monitor-side-card-head">
              <h3>To be notified</h3>
              <button
                type="button"
                className="side-card-settings-button"
                aria-label="Open notification settings"
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
