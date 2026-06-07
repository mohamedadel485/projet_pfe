import { PredictionService } from "../../src/services/predictionService";

const predictionService = new PredictionService();

const NOW = new Date("2026-05-21T12:00:00.000Z");

const hoursAgo = (hours: number): Date =>
  new Date(NOW.getTime() - hours * 60 * 60 * 1000);

describe("PredictionService", () => {
  it("marks SSL expiry as critical when the certificate expires within 48 hours", () => {
    const report = predictionService.buildMonitorPrediction({
      monitor: {
        name: "api.example.com",
        status: "up",
        interval: 5,
        uptime: 99.98,
        responseTime: 140,
        sslExpiryMode: "enabled",
        sslExpiryAt: new Date("2026-05-22T10:00:00.000Z"),
        sslExpiryCheckedAt: hoursAgo(1),
        sslExpiryError: undefined,
      },
      logs: [
        {
          status: "up",
          responseTime: 120,
          checkedAt: hoursAgo(0.2),
          errorMessage: undefined,
        },
      ] as any,
      incidents: [],
      now: NOW,
    });

    const sslPrediction = report.predictions.find(
      (prediction) => prediction.type === "ssl_expiry",
    );

    expect(sslPrediction).toBeDefined();
    expect(sslPrediction?.riskLevel).toBe("critical");
    expect(sslPrediction?.summary).toContain("expires very soon");
    expect(report.signals.daysUntilSslExpiry).toBeLessThan(2);
  });

  it("detects server overload when response time degrades sharply with timeouts", () => {
    const baselineLogs = Array.from({ length: 8 }, (_, index) => ({
      status: "up" as const,
      responseTime: 240 + index * 12,
      checkedAt: hoursAgo(6 + index),
      errorMessage: undefined,
    }));

    const recentLogs = [
      {
        status: "up" as const,
        responseTime: 2600,
        checkedAt: hoursAgo(0.2),
        errorMessage: "timeout while connecting",
      },
      {
        status: "down" as const,
        responseTime: 4800,
        checkedAt: hoursAgo(0.5),
        errorMessage: "ETIMEDOUT",
      },
      {
        status: "up" as const,
        responseTime: 3200,
        checkedAt: hoursAgo(0.8),
        errorMessage: undefined,
      },
      {
        status: "down" as const,
        responseTime: 5200,
        checkedAt: hoursAgo(1.1),
        errorMessage: "socket hang up",
      },
      {
        status: "up" as const,
        responseTime: 2900,
        checkedAt: hoursAgo(1.4),
        errorMessage: undefined,
      },
    ];

    const report = predictionService.buildMonitorPrediction({
      monitor: {
        name: "core-api",
        status: "up",
        interval: 5,
        uptime: 98.7,
        responseTime: 3100,
        sslExpiryMode: "disabled",
        sslExpiryAt: undefined,
        sslExpiryCheckedAt: undefined,
        sslExpiryError: undefined,
      },
      logs: [...recentLogs, ...baselineLogs] as any,
      incidents: [],
      now: NOW,
    });

    const overloadPrediction = report.predictions.find(
      (prediction) => prediction.type === "server_overload",
    );

    expect(overloadPrediction).toBeDefined();
    expect(overloadPrediction?.riskLevel).toMatch(/high|critical/);
    expect(overloadPrediction?.summary).toContain("may become unstable");
    expect(report.signals.responseTimeTrendPercent).toBeGreaterThan(100);
  });

  it("raises downtime risk when failures chain together and an incident is ongoing", () => {
    const recentLogs = [
      {
        status: "down" as const,
        responseTime: 6000,
        checkedAt: hoursAgo(0.1),
        errorMessage: "ETIMEDOUT",
      },
      {
        status: "down" as const,
        responseTime: 5400,
        checkedAt: hoursAgo(0.4),
        errorMessage: "ETIMEDOUT",
      },
      {
        status: "down" as const,
        responseTime: 5100,
        checkedAt: hoursAgo(0.7),
        errorMessage: "Gateway timeout",
      },
      {
        status: "up" as const,
        responseTime: 900,
        checkedAt: hoursAgo(1.5),
        errorMessage: undefined,
      },
      {
        status: "down" as const,
        responseTime: 4300,
        checkedAt: hoursAgo(3),
        errorMessage: "timeout",
      },
    ];

    const report = predictionService.buildMonitorPrediction({
      monitor: {
        name: "payments",
        status: "down",
        interval: 5,
        uptime: 93.2,
        responseTime: 6100,
        sslExpiryMode: "enabled",
        sslExpiryAt: new Date("2026-07-01T00:00:00.000Z"),
        sslExpiryCheckedAt: hoursAgo(2),
        sslExpiryError: undefined,
      },
      logs: recentLogs as any,
      incidents: [
        {
          status: "ongoing",
          startedAt: hoursAgo(0.9),
          resolvedAt: undefined,
          durationMs: 0,
        } as any,
      ],
      now: NOW,
    });

    const downtimePrediction = report.predictions.find(
      (prediction) => prediction.type === "downtime",
    );

    expect(downtimePrediction).toBeDefined();
    expect(downtimePrediction?.riskLevel).toBe("critical");
    expect(downtimePrediction?.forecastWindow).toBe("now");
    expect(report.summary).toContain("continued downtime is critical");
    expect(report.signals.consecutiveFailures).toBe(3);
    expect(report.signals.ongoingIncident).toBe(true);
  });
});
