import type { IIncident } from "../models/Incident";
import type { IMonitor } from "../models/Moniteur";
import type { IMonitorLog } from "../models/MonitorLog";

export type PredictionRiskLevel = "low" | "medium" | "high" | "critical";
export type PredictionType = "ssl_expiry" | "server_overload" | "downtime";

export interface PredictionDriver {
  label: string;
  value: string;
  impact: PredictionRiskLevel;
}

export interface MonitorPredictionEntry {
  type: PredictionType;
  title: string;
  riskLevel: PredictionRiskLevel;
  riskScore: number;
  confidence: number;
  forecastWindow: string;
  summary: string;
  recommendation: string;
  drivers: PredictionDriver[];
}

export interface MonitorPredictionReport {
  generatedAt: Date;
  overallRiskLevel: PredictionRiskLevel;
  overallRiskScore: number;
  summary: string;
  predictions: MonitorPredictionEntry[];
  signals: {
    sampleSize: number;
    recentChecks2h: number;
    recentChecks24h: number;
    recentFailureRate2h: number | null;
    recentFailureRate24h: number | null;
    consecutiveFailures: number;
    recentAverageResponseTime: number | null;
    baselineAverageResponseTime: number | null;
    responseTimeTrendPercent: number | null;
    recentIncidentCount24h: number;
    ongoingIncident: boolean;
    daysUntilSslExpiry: number | null;
  };
}

type PredictionMonitorSnapshot = Pick<
  IMonitor,
  | "name"
  | "status"
  | "interval"
  | "uptime"
  | "responseTime"
  | "sslExpiryMode"
  | "sslExpiryAt"
  | "sslExpiryCheckedAt"
  | "sslExpiryError"
>;

type PredictionLogSnapshot = Pick<
  IMonitorLog,
  "status" | "responseTime" | "errorMessage" | "checkedAt"
>;

type PredictionIncidentSnapshot = Pick<
  IIncident,
  "status" | "startedAt" | "resolvedAt" | "durationMs"
>;

interface PredictionInput {
  monitor: PredictionMonitorSnapshot;
  logs: PredictionLogSnapshot[];
  incidents: PredictionIncidentSnapshot[];
  now?: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SHORT_WINDOW_MS = 2 * HOUR_MS;
const BASELINE_WINDOW_MS = 24 * HOUR_MS;
const TIMEOUT_ERROR_PATTERN =
  /(timeout|timed out|socket hang up|econnreset|etimedout|ehostunreach|enotfound|eai_again)/i;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toTimestamp = (value: Date | string | undefined | null): number | null => {
  if (!value) return null;
  const timestamp =
    value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : timestamp;
};

const formatPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${round(value)}%`;
};

const formatMs = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value)} ms`;
};

const formatHours = (value: number): string => {
  if (value < 1) {
    return "< 1 hour";
  }

  if (value < 48) {
    return `${Math.round(value)} hour${Math.round(value) > 1 ? "s" : ""}`;
  }

  const days = round(value / 24);
  return `${days} day${days > 1 ? "s" : ""}`;
};

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const countConsecutiveFailures = (
  logsNewestFirst: PredictionLogSnapshot[],
): number => {
  let count = 0;
  for (const log of logsNewestFirst) {
    if (log.status !== "down") {
      break;
    }
    count += 1;
  }
  return count;
};

const scoreToRiskLevel = (score: number): PredictionRiskLevel => {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
};

const buildConfidence = (
  primarySampleCount: number,
  secondarySampleCount = 0,
  offset = 30,
): number =>
  clamp(offset + primarySampleCount * 6 + secondarySampleCount * 2, 25, 95);

const sortLogsNewestFirst = (
  logs: PredictionLogSnapshot[],
): PredictionLogSnapshot[] =>
  [...logs].sort((left, right) => {
    const leftTs = toTimestamp(left.checkedAt) ?? 0;
    const rightTs = toTimestamp(right.checkedAt) ?? 0;
    return rightTs - leftTs;
  });

const isWithinWindow = (
  value: Date | string | undefined | null,
  nowTs: number,
  windowMs: number,
): boolean => {
  const timestamp = toTimestamp(value);
  if (timestamp === null) return false;
  return timestamp >= nowTs - windowMs && timestamp <= nowTs;
};

const computeFailureRate = (logs: PredictionLogSnapshot[]): number | null => {
  if (logs.length === 0) return null;
  const failures = logs.filter((log) => log.status === "down").length;
  return (failures / logs.length) * 100;
};

const asDisplayValue = (value: number | null): string =>
  value === null ? "n/a" : String(Math.round(value));

const buildSslPrediction = (
  monitor: PredictionMonitorSnapshot,
  nowTs: number,
): { prediction: MonitorPredictionEntry; daysUntilSslExpiry: number | null } => {
  if (monitor.sslExpiryMode !== "enabled") {
    return {
      daysUntilSslExpiry: null,
      prediction: {
        type: "ssl_expiry",
        title: "SSL expiration",
        riskLevel: "low",
        riskScore: 12,
        confidence: 30,
        forecastWindow: "not monitored",
        summary:
          "SSL expiry monitoring is disabled, so certificate risk cannot be forecast yet.",
        recommendation:
          "Enable SSL checks to detect expiring certificates before they affect HTTPS availability.",
        drivers: [
          {
            label: "SSL monitoring",
            value: "Disabled",
            impact: "medium",
          },
        ],
      },
    };
  }

  const expiryTs = toTimestamp(monitor.sslExpiryAt);
  const checkedTs = toTimestamp(monitor.sslExpiryCheckedAt);
  const checkedHoursAgo =
    checkedTs === null ? null : Math.max(0, (nowTs - checkedTs) / HOUR_MS);
  const confidence = clamp(
    checkedHoursAgo === null ? 35 : 85 - Math.min(45, checkedHoursAgo * 2),
    35,
    92,
  );

  if (expiryTs === null) {
    return {
      daysUntilSslExpiry: null,
      prediction: {
        type: "ssl_expiry",
        title: "SSL expiration",
        riskLevel: monitor.sslExpiryError ? "medium" : "low",
        riskScore: monitor.sslExpiryError ? 42 : 20,
        confidence,
        forecastWindow: "unknown",
        summary: monitor.sslExpiryError
          ? "The SSL certificate could not be inspected, so expiry risk is currently unclear."
          : "The SSL certificate has not been inspected yet.",
        recommendation: monitor.sslExpiryError
          ? "Run a fresh check and verify that the endpoint exposes a valid TLS certificate."
          : "Wait for the next SSL inspection or trigger a manual check.",
        drivers: [
          {
            label: "Last SSL status",
            value: monitor.sslExpiryError?.trim() || "No SSL data yet",
            impact: monitor.sslExpiryError ? "medium" : "low",
          },
        ],
      },
    };
  }

  const hoursUntilExpiry = (expiryTs - nowTs) / HOUR_MS;
  const daysUntilSslExpiry = hoursUntilExpiry / 24;
  let riskScore = 10;
  let summary =
    "The SSL certificate is healthy and no short-term expiry issue is predicted.";
  let recommendation = "No immediate SSL action is required.";
  let forecastWindow = "next 30 days";

  if (hoursUntilExpiry <= 0) {
    riskScore = 100;
    summary =
      "The SSL certificate has expired. HTTPS availability is at immediate risk.";
    recommendation = "Renew the certificate immediately and verify the full TLS chain.";
    forecastWindow = "now";
  } else if (hoursUntilExpiry <= 48) {
    riskScore = 95;
    summary =
      "The SSL certificate expires very soon and HTTPS failures are likely if it is not renewed.";
    recommendation = "Renew the certificate within the next few hours.";
    forecastWindow = "next 48 hours";
  } else if (daysUntilSslExpiry <= 7) {
    riskScore = 80;
    summary =
      "The SSL certificate expires within a week. Short-term reliability risk is elevated.";
    recommendation = "Schedule the certificate renewal this week.";
    forecastWindow = "next 7 days";
  } else if (daysUntilSslExpiry <= 14) {
    riskScore = 55;
    summary =
      "The SSL certificate is approaching expiry and should be renewed soon.";
    recommendation = "Prepare a certificate renewal before the next maintenance window.";
    forecastWindow = "next 14 days";
  }

  return {
    daysUntilSslExpiry,
    prediction: {
      type: "ssl_expiry",
      title: "SSL expiration",
      riskLevel: scoreToRiskLevel(riskScore),
      riskScore,
      confidence,
      forecastWindow,
      summary,
      recommendation,
      drivers: [
        {
          label: "Time to expiry",
          value: formatHours(Math.abs(hoursUntilExpiry)),
          impact: scoreToRiskLevel(riskScore),
        },
        {
          label: "Last SSL check",
          value:
            checkedHoursAgo === null
              ? "Unknown"
              : `${Math.round(checkedHoursAgo)} hour${Math.round(checkedHoursAgo) !== 1 ? "s" : ""} ago`,
          impact: checkedHoursAgo !== null && checkedHoursAgo > 24 ? "medium" : "low",
        },
      ],
    },
  };
};

const buildOverloadPrediction = ({
  monitor,
  logsNewestFirst,
  nowTs,
}: {
  monitor: PredictionMonitorSnapshot;
  logsNewestFirst: PredictionLogSnapshot[];
  nowTs: number;
}): {
  prediction: MonitorPredictionEntry;
  recentAverageResponseTime: number | null;
  baselineAverageResponseTime: number | null;
  responseTimeTrendPercent: number | null;
  recentChecks2h: number;
} => {
  const recentLogs = logsNewestFirst.filter((log) =>
    isWithinWindow(log.checkedAt, nowTs, SHORT_WINDOW_MS),
  );
  const baselineLogs = logsNewestFirst.filter((log) => {
    const timestamp = toTimestamp(log.checkedAt);
    if (timestamp === null) return false;
    return timestamp >= nowTs - BASELINE_WINDOW_MS && timestamp < nowTs - SHORT_WINDOW_MS;
  });

  const recentValues = recentLogs.map((log) => Math.max(0, log.responseTime));
  const baselineValues = baselineLogs.map((log) => Math.max(0, log.responseTime));
  const fallbackBaseline = average(
    logsNewestFirst
      .slice(Math.max(0, Math.floor(logsNewestFirst.length / 2)))
      .map((log) => Math.max(0, log.responseTime)),
  );
  const recentAverageResponseTime =
    average(recentValues) ??
    (Number.isFinite(monitor.responseTime) ? monitor.responseTime : null);
  const baselineAverageResponseTime =
    average(baselineValues) ?? fallbackBaseline ?? recentAverageResponseTime;
  const responseTimeTrendPercent =
    recentAverageResponseTime !== null &&
    baselineAverageResponseTime !== null &&
    baselineAverageResponseTime > 0
      ? ((recentAverageResponseTime - baselineAverageResponseTime) /
          baselineAverageResponseTime) *
        100
      : null;

  const highLatencyThreshold =
    baselineAverageResponseTime !== null
      ? Math.max(1500, baselineAverageResponseTime * 1.8)
      : 1500;
  const highLatencyCount = recentLogs.filter(
    (log) => Math.max(0, log.responseTime) >= highLatencyThreshold,
  ).length;
  const timeoutCount = recentLogs.filter((log) =>
    TIMEOUT_ERROR_PATTERN.test(log.errorMessage ?? ""),
  ).length;
  const downCount = recentLogs.filter((log) => log.status === "down").length;
  const highLatencyRatio =
    recentLogs.length === 0 ? 0 : highLatencyCount / recentLogs.length;
  const failureRate2h = computeFailureRate(recentLogs) ?? 0;

  let riskScore = 0;

  if (recentAverageResponseTime !== null) {
    if (recentAverageResponseTime >= 5000) {
      riskScore += 40;
    } else if (recentAverageResponseTime >= 2500) {
      riskScore += 32;
    } else if (recentAverageResponseTime >= 1200) {
      riskScore += 22;
    } else if (recentAverageResponseTime >= 700) {
      riskScore += 12;
    }
  }

  if (responseTimeTrendPercent !== null) {
    if (responseTimeTrendPercent >= 150) {
      riskScore += 30;
    } else if (responseTimeTrendPercent >= 80) {
      riskScore += 22;
    } else if (responseTimeTrendPercent >= 35) {
      riskScore += 14;
    }
  }

  if (highLatencyRatio >= 0.5) {
    riskScore += 18;
  } else if (highLatencyRatio >= 0.25) {
    riskScore += 10;
  }

  if (timeoutCount >= 3) {
    riskScore += 18;
  } else if (timeoutCount >= 1) {
    riskScore += 10;
  }

  if (downCount >= 3) {
    riskScore += 15;
  } else if (downCount >= 1) {
    riskScore += 8;
  }

  if (recentLogs.length < 4) {
    riskScore = Math.min(riskScore, 45);
  }

  riskScore = clamp(riskScore, 0, 100);
  const riskLevel = scoreToRiskLevel(riskScore);
  const confidence = buildConfidence(recentLogs.length, baselineLogs.length, 28);

  let summary = "No strong overload signal is currently detected.";
  let recommendation =
    "Keep monitoring response-time drift and error spikes over the next checks.";

  if (riskLevel === "critical" || riskLevel === "high") {
    summary =
      "Response times are spiking and the service may become unstable within the next 2 hours.";
    recommendation =
      "Investigate upstream latency, autoscaling pressure, and recent timeout errors now.";
  } else if (riskLevel === "medium") {
    summary =
      "Latency is rising and the service shows early signs of overload.";
    recommendation =
      "Review recent performance regressions before they turn into user-visible instability.";
  } else if (recentLogs.length < 4) {
    summary = "There is not enough recent data to estimate overload risk confidently.";
    recommendation =
      "Collect a few more checks or reduce the interval for faster predictions.";
  }

  return {
    recentAverageResponseTime,
    baselineAverageResponseTime,
    responseTimeTrendPercent,
    recentChecks2h: recentLogs.length,
    prediction: {
      type: "server_overload",
      title: "Server overload",
      riskLevel,
      riskScore,
      confidence,
      forecastWindow: "next 2 hours",
      summary,
      recommendation,
      drivers: [
        {
          label: "Recent average",
          value: formatMs(recentAverageResponseTime),
          impact:
            recentAverageResponseTime !== null && recentAverageResponseTime >= 1200
              ? "high"
              : "low",
        },
        {
          label: "Trend vs baseline",
          value:
            responseTimeTrendPercent === null
              ? "n/a"
              : `${responseTimeTrendPercent >= 0 ? "+" : ""}${round(responseTimeTrendPercent)}%`,
          impact:
            responseTimeTrendPercent !== null && responseTimeTrendPercent >= 35
              ? "high"
              : "low",
        },
        {
          label: "Timeouts / failed checks",
          value: `${timeoutCount} / ${downCount}`,
          impact:
            timeoutCount > 0 || downCount > 0
              ? riskLevel === "low"
                ? "medium"
                : riskLevel
              : "low",
        },
      ],
    },
  };
};

const buildDowntimePrediction = ({
  monitor,
  logsNewestFirst,
  incidents,
  overloadRiskScore,
  nowTs,
}: {
  monitor: PredictionMonitorSnapshot;
  logsNewestFirst: PredictionLogSnapshot[];
  incidents: PredictionIncidentSnapshot[];
  overloadRiskScore: number;
  nowTs: number;
}): {
  prediction: MonitorPredictionEntry;
  recentChecks24h: number;
  recentFailureRate2h: number | null;
  recentFailureRate24h: number | null;
  consecutiveFailures: number;
  recentIncidentCount24h: number;
  ongoingIncident: boolean;
} => {
  const recent2hLogs = logsNewestFirst.filter((log) =>
    isWithinWindow(log.checkedAt, nowTs, SHORT_WINDOW_MS),
  );
  const recent24hLogs = logsNewestFirst.filter((log) =>
    isWithinWindow(log.checkedAt, nowTs, DAY_MS),
  );
  const recentFailureRate2h = computeFailureRate(recent2hLogs);
  const recentFailureRate24h = computeFailureRate(recent24hLogs);
  const consecutiveFailures = countConsecutiveFailures(logsNewestFirst);
  const recentIncidentCount24h = incidents.filter((incident) =>
    isWithinWindow(incident.startedAt, nowTs, DAY_MS),
  ).length;
  const ongoingIncident = incidents.some((incident) => incident.status === "ongoing");

  let riskScore = 0;

  if (monitor.status === "down") {
    riskScore += 45;
  }
  if (ongoingIncident) {
    riskScore += 35;
  }

  if (consecutiveFailures >= 4) {
    riskScore += 30;
  } else if (consecutiveFailures >= 2) {
    riskScore += 20;
  } else if (consecutiveFailures >= 1) {
    riskScore += 10;
  }

  if ((recentFailureRate2h ?? 0) >= 50) {
    riskScore += 30;
  } else if ((recentFailureRate2h ?? 0) >= 20) {
    riskScore += 20;
  } else if ((recentFailureRate2h ?? 0) >= 5) {
    riskScore += 10;
  }

  if ((recentFailureRate24h ?? 0) >= 20) {
    riskScore += 15;
  } else if ((recentFailureRate24h ?? 0) >= 5) {
    riskScore += 8;
  }

  if (recentIncidentCount24h >= 2) {
    riskScore += 15;
  } else if (recentIncidentCount24h >= 1) {
    riskScore += 8;
  }

  if (monitor.uptime < 95) {
    riskScore += 12;
  } else if (monitor.uptime < 99) {
    riskScore += 5;
  }

  riskScore += Math.round(overloadRiskScore * 0.2);
  riskScore = clamp(riskScore, 0, 100);

  const riskLevel = scoreToRiskLevel(riskScore);
  const confidence = buildConfidence(
    recent24hLogs.length,
    incidents.length,
    ongoingIncident ? 36 : 30,
  );

  let summary = "Short-term downtime risk is currently limited.";
  let recommendation =
    "Continue normal monitoring and review the monitor after major deploys or traffic spikes.";

  if (monitor.status === "down" || ongoingIncident) {
    summary =
      "The service is already degraded and the risk of continued downtime is critical.";
    recommendation =
      "Prioritize recovery, then review the incident pattern and its trigger.";
  } else if (riskLevel === "critical" || riskLevel === "high") {
    summary =
      "This service is likely to become unstable in the next 2 hours.";
    recommendation =
      "Inspect recent failures, latency spikes, and incident causes before the risk converts into downtime.";
  } else if (riskLevel === "medium") {
    summary =
      "Short-term downtime risk is elevated and should be watched closely.";
    recommendation =
      "Track the next checks closely and validate recent infrastructure or application changes.";
  } else if (recent24hLogs.length < 4) {
    summary =
      "There is not enough recent data to estimate downtime risk confidently.";
    recommendation =
      "Collect additional check history to improve prediction confidence.";
  }

  return {
    recentChecks24h: recent24hLogs.length,
    recentFailureRate2h,
    recentFailureRate24h,
    consecutiveFailures,
    recentIncidentCount24h,
    ongoingIncident,
    prediction: {
      type: "downtime",
      title: "Downtime risk",
      riskLevel,
      riskScore,
      confidence,
      forecastWindow: monitor.status === "down" ? "now" : "next 2 hours",
      summary,
      recommendation,
      drivers: [
        {
          label: "Failure rate (2h)",
          value: formatPercent(recentFailureRate2h),
          impact:
            recentFailureRate2h !== null && recentFailureRate2h >= 20
              ? "high"
              : recentFailureRate2h !== null && recentFailureRate2h >= 5
                ? "medium"
                : "low",
        },
        {
          label: "Consecutive failures",
          value: asDisplayValue(consecutiveFailures),
          impact:
            consecutiveFailures >= 2
              ? "high"
              : consecutiveFailures >= 1
                ? "medium"
                : "low",
        },
        {
          label: "Incidents in 24h",
          value: `${recentIncidentCount24h}${ongoingIncident ? " (1 ongoing)" : ""}`,
          impact:
            ongoingIncident || recentIncidentCount24h >= 2
              ? "high"
              : recentIncidentCount24h >= 1
                ? "medium"
                : "low",
        },
      ],
    },
  };
};

export class PredictionService {
  buildMonitorPrediction({
    monitor,
    logs,
    incidents,
    now = new Date(),
  }: PredictionInput): MonitorPredictionReport {
    const nowTs = now.getTime();
    const logsNewestFirst = sortLogsNewestFirst(logs);
    const { prediction: sslPrediction, daysUntilSslExpiry } = buildSslPrediction(
      monitor,
      nowTs,
    );
    const overload = buildOverloadPrediction({
      monitor,
      logsNewestFirst,
      nowTs,
    });
    const downtime = buildDowntimePrediction({
      monitor,
      logsNewestFirst,
      incidents,
      overloadRiskScore: overload.prediction.riskScore,
      nowTs,
    });

    const predictions = [
      sslPrediction,
      overload.prediction,
      downtime.prediction,
    ].sort((left, right) => right.riskScore - left.riskScore);
    const primaryPrediction = predictions[0];
    const overallRiskScore = primaryPrediction?.riskScore ?? 0;
    const overallRiskLevel = scoreToRiskLevel(overallRiskScore);
    const summary =
      overallRiskLevel === "low"
        ? "No critical predictive signal is currently detected for this monitor."
        : primaryPrediction.summary;

    return {
      generatedAt: now,
      overallRiskLevel,
      overallRiskScore,
      summary,
      predictions,
      signals: {
        sampleSize: logsNewestFirst.length,
        recentChecks2h: overload.recentChecks2h,
        recentChecks24h: downtime.recentChecks24h,
        recentFailureRate2h:
          downtime.recentFailureRate2h === null
            ? null
            : round(downtime.recentFailureRate2h),
        recentFailureRate24h:
          downtime.recentFailureRate24h === null
            ? null
            : round(downtime.recentFailureRate24h),
        consecutiveFailures: downtime.consecutiveFailures,
        recentAverageResponseTime:
          overload.recentAverageResponseTime === null
            ? null
            : Math.round(overload.recentAverageResponseTime),
        baselineAverageResponseTime:
          overload.baselineAverageResponseTime === null
            ? null
            : Math.round(overload.baselineAverageResponseTime),
        responseTimeTrendPercent:
          overload.responseTimeTrendPercent === null
            ? null
            : round(overload.responseTimeTrendPercent),
        recentIncidentCount24h: downtime.recentIncidentCount24h,
        ongoingIncident: downtime.ongoingIncident,
        daysUntilSslExpiry:
          daysUntilSslExpiry === null ? null : round(daysUntilSslExpiry),
      },
    };
  }
}

export default new PredictionService();
