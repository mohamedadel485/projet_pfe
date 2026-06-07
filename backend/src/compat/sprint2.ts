import Monitor, {
  type IMonitor,
  type MonitorHttpMethod,
  type MonitorHttpMethodCompat,
  type MonitorProtocol,
  type MonitorStatus,
} from "../models/Moniteur";
import StatusPage, { type IStatusPage } from "../models/StatusPage";
import Incident, { type IIncident } from "../models/Incident";

const normalizeMonitorProtocol = (value: unknown): MonitorProtocol | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ["http", "https", "ws", "wss"].includes(normalized)
    ? (normalized as MonitorProtocol)
    : null;
};

const normalizeMonitorHttpMethod = (value: unknown): MonitorHttpMethod | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
  ].includes(normalized)
    ? (normalized as MonitorHttpMethod)
    : null;
};

const normalizeMonitorStatus = (value: unknown): MonitorStatus | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ["up", "down", "paused", "pending"].includes(normalized)
    ? (normalized as MonitorStatus)
    : null;
};

const normalizeIncidentStatus = (
  value: unknown,
): IIncident["status"] | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "up" || normalized === "resolved") {
    return "resolved";
  }
  if (normalized === "down" || normalized === "ongoing") {
    return "ongoing";
  }
  return null;
};

Monitor.schema.virtual("nom").get(function (this: IMonitor): string {
  return this.name;
});

Monitor.schema.virtual("nom").set(function (this: IMonitor, value: unknown): void {
  if (typeof value === "string") {
    this.name = value;
  }
});

Monitor.schema.virtual("protocole").get(function (this: IMonitor): MonitorProtocol {
  return this.type;
});

Monitor.schema.virtual("protocole").set(function (
  this: IMonitor,
  value: unknown,
): void {
  const normalized = normalizeMonitorProtocol(value);
  if (normalized) {
    this.type = normalized;
  }
});

Monitor.schema.virtual("typeHTTP").get(function (
  this: IMonitor,
): MonitorHttpMethodCompat {
  const method =
    typeof this.httpMethod === "string" && this.httpMethod.trim() !== ""
      ? this.httpMethod
      : "GET";
  return method.toLowerCase() as MonitorHttpMethodCompat;
});

Monitor.schema.virtual("typeHTTP").set(function (
  this: IMonitor,
  value: unknown,
): void {
  const normalized = normalizeMonitorHttpMethod(value);
  if (normalized) {
    this.httpMethod = normalized;
  }
});

Monitor.schema.virtual("statut").get(function (this: IMonitor): MonitorStatus {
  return this.status;
});

Monitor.schema.virtual("statut").set(function (
  this: IMonitor,
  value: unknown,
): void {
  const normalized = normalizeMonitorStatus(value);
  if (normalized) {
    this.status = normalized;
  }
});

Monitor.schema.set("toJSON", { virtuals: true });
Monitor.schema.set("toObject", { virtuals: true });

Monitor.schema.methods.creer = async function (
  this: IMonitor,
): Promise<IMonitor> {
  await this.save();
  return this;
};

Monitor.schema.methods.modifier = async function (
  this: IMonitor,
  updates: Partial<IMonitor>,
): Promise<IMonitor> {
  Object.assign(this, updates);
  await this.save();
  return this;
};

Monitor.schema.methods.supprimer = async function (
  this: IMonitor,
): Promise<void> {
  await this.deleteOne();
};

StatusPage.schema.virtual("nom").get(function (this: IStatusPage): string {
  return this.pageName;
});

StatusPage.schema.virtual("nom").set(function (
  this: IStatusPage,
  value: unknown,
): void {
  if (typeof value === "string") {
    this.pageName = value;
  }
});

StatusPage.schema.virtual("moniteurs").get(function (this: IStatusPage): string[] {
  return this.monitorIds;
});

StatusPage.schema.virtual("moniteurs").set(function (
  this: IStatusPage,
  value: unknown,
): void {
  if (Array.isArray(value)) {
    this.monitorIds = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  }
});

StatusPage.schema.virtual("statut").get(function (this: IStatusPage): string {
  return this.passwordEnabled ? "protected" : "public";
});

StatusPage.schema.virtual("statut").set(function (
  this: IStatusPage,
  value: unknown,
): void {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    this.passwordEnabled = normalized === "protected";
  }
});

StatusPage.schema.set("toJSON", { virtuals: true });
StatusPage.schema.set("toObject", { virtuals: true });

StatusPage.schema.methods.creer = async function (
  this: IStatusPage,
): Promise<IStatusPage> {
  await this.save();
  return this;
};

StatusPage.schema.methods.modifier = async function (
  this: IStatusPage,
  updates: Partial<IStatusPage>,
): Promise<IStatusPage> {
  Object.assign(this, updates);
  await this.save();
  return this;
};

StatusPage.schema.methods.supprimer = async function (
  this: IStatusPage,
): Promise<void> {
  await this.deleteOne();
};

Incident.schema.virtual("description").get(function (this: IIncident): string {
  return this.errorMessage || `${this.monitorName} - ${this.monitorUrl}`;
});

Incident.schema.virtual("description").set(function (
  this: IIncident,
  value: unknown,
): void {
  if (typeof value === "string") {
    this.errorMessage = value;
  }
});

Incident.schema.virtual("dateDebut").get(function (this: IIncident): Date {
  return this.startedAt;
});

Incident.schema.virtual("dateDebut").set(function (
  this: IIncident,
  value: unknown,
): void {
  if (value instanceof Date) {
    this.startedAt = value;
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      this.startedAt = parsed;
    }
  }
});

Incident.schema.virtual("dateFin").get(function (this: IIncident): Date | undefined {
  return this.resolvedAt;
});

Incident.schema.virtual("dateFin").set(function (
  this: IIncident,
  value: unknown,
): void {
  if (value == null) {
    this.resolvedAt = undefined;
    return;
  }

  if (value instanceof Date) {
    this.resolvedAt = value;
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      this.resolvedAt = parsed;
    }
  }
});

Incident.schema.virtual("statut").get(function (this: IIncident): string {
  return this.status;
});

Incident.schema.virtual("statut").set(function (
  this: IIncident,
  value: unknown,
): void {
  const normalized = normalizeIncidentStatus(value);
  if (normalized) {
    this.status = normalized;
  }
});

Incident.schema.set("toJSON", { virtuals: true });
Incident.schema.set("toObject", { virtuals: true });

export {};
