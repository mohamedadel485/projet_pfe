import mongoose, { Document, Schema } from "mongoose";

export type MonitorIpVersion =
  | "IPv4 / IPv6 (IPv4 Priority)"
  | "IPv6 / IPv4 (IPv6 Priority)"
  | "IPv4 only"
  | "IPv6 only";
export type MonitorProtocol = "http" | "https" | "ws" | "wss";
export type MonitorStatus = "up" | "down" | "paused" | "pending";
export type MonitorHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";
export type MonitorHttpMethodCompat = Lowercase<MonitorHttpMethod>;

const normalizeMonitorProtocol = (value: unknown): MonitorProtocol | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ["http", "https", "ws", "wss"].includes(normalized)
    ? (normalized as MonitorProtocol)
    : null;
};

const normalizeMonitorHttpMethod = (
  value: unknown,
): MonitorHttpMethod | null => {
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

const normalizeMonitorInterval = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

export interface IMonitor extends Document {
  name: string;
  url: string;
  type: MonitorProtocol;
  interval: number; // en minutes
  timeout: number; // en secondes
  status: MonitorStatus;
  pausedByMaintenance: boolean;
  manuallyResumed?: boolean; // L'utilisateur a manuellement repris le monitoring malgrÃ© la maintenance active
  isActive: boolean;
  emailNotificationsEnabled: boolean;
  owner: mongoose.Types.ObjectId;
  sharedWith: mongoose.Types.ObjectId[];
  httpMethod: MonitorHttpMethod;
  expectedStatusCode: number;
  ipVersion?: MonitorIpVersion;
  followRedirections?: boolean;
  upStatusCodeGroups?: Array<"2xx" | "3xx">;
  domainExpiryMode?: "enabled" | "disabled";
  domainExpiryAt?: Date;
  domainExpiryCheckedAt?: Date;
  domainExpiryError?: string;
  sslExpiryMode?: "enabled" | "disabled";
  sslExpiryAt?: Date;
  sslExpiryCheckedAt?: Date;
  sslExpiryError?: string;
  headers?: Record<string, string>;
  body?: string;
  responseValidation?: {
    field: "status";
    mode: "value" | "type";
    expectedValue?: string;
    expectedType?: "string" | "boolean" | "number";
  };
  port?: number;
  lastChecked?: Date;
  lastStatus?: "up" | "down";
  uptime: number; // pourcentage
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  responseTime: number; // en ms
  nom?: string;
  protocole?: MonitorProtocol;
  typeHTTP?: MonitorHttpMethodCompat;
  statut?: MonitorStatus;
  intervalle?: number;
  creer(): Promise<IMonitor>;
  modifier(updates: Partial<IMonitor>): Promise<IMonitor>;
  supprimer(): Promise<void>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const monitorSchema = new Schema<IMonitor>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["http", "https", "ws", "wss"],
      default: "https",
    },
    interval: {
      type: Number,
      default: 5, // 5 minutes par dÃ©faut
      min: 1,
    },
    timeout: {
      type: Number,
      default: 30, // 30 secondes par dÃ©faut
      min: 5,
      max: 300,
    },
    status: {
      type: String,
      enum: ["up", "down", "paused", "pending"],
      default: "pending",
    },
    pausedByMaintenance: {
      type: Boolean,
      default: false,
    },
    manuallyResumed: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    emailNotificationsEnabled: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Utilisateur",
      required: true,
    },
    sharedWith: [
      {
        type: Schema.Types.ObjectId,
        ref: "Utilisateur",
      },
    ],
    httpMethod: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      default: "GET",
    },
    expectedStatusCode: {
      type: Number,
      default: 200,
    },
    ipVersion: {
      type: String,
      enum: [
        "IPv4 / IPv6 (IPv4 Priority)",
        "IPv6 / IPv4 (IPv6 Priority)",
        "IPv4 only",
        "IPv6 only",
      ],
      default: "IPv4 / IPv6 (IPv4 Priority)",
    },
    followRedirections: {
      type: Boolean,
    },
    upStatusCodeGroups: {
      type: [String],
      enum: ["2xx", "3xx"],
    },
    domainExpiryMode: {
      type: String,
      enum: ["enabled", "disabled"],
      default: "disabled",
    },
    domainExpiryAt: {
      type: Date,
    },
    domainExpiryCheckedAt: {
      type: Date,
    },
    domainExpiryError: {
      type: String,
    },
    sslExpiryMode: {
      type: String,
      enum: ["enabled", "disabled"],
      default: "disabled",
    },
    sslExpiryAt: {
      type: Date,
    },
    sslExpiryCheckedAt: {
      type: Date,
    },
    sslExpiryError: {
      type: String,
    },
    headers: {
      type: Map,
      of: String,
    },
    body: {
      type: String,
    },
    responseValidation: {
      field: {
        type: String,
        enum: ["status"],
      },
      mode: {
        type: String,
        enum: ["value", "type"],
      },
      expectedValue: {
        type: String,
      },
      expectedType: {
        type: String,
        enum: ["string", "boolean", "number"],
      },
    },
    port: {
      type: Number,
    },
    lastChecked: {
      type: Date,
    },
    lastStatus: {
      type: String,
      enum: ["up", "down"],
    },
    uptime: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    totalChecks: {
      type: Number,
      default: 0,
    },
    successfulChecks: {
      type: Number,
      default: 0,
    },
    failedChecks: {
      type: Number,
      default: 0,
    },
    responseTime: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Index pour optimiser les requÃªtes
monitorSchema.index({ owner: 1 });
monitorSchema.index({ sharedWith: 1 });
monitorSchema.index({ status: 1 });

monitorSchema.virtual("nom").get(function (this: IMonitor): string {
  return this.name;
});

monitorSchema.virtual("nom").set(function (
  this: IMonitor,
  value: unknown,
): void {
  if (typeof value === "string") {
    this.name = value;
  }
});

monitorSchema.virtual("protocole").get(function (
  this: IMonitor,
): MonitorProtocol {
  return this.type;
});

monitorSchema.virtual("protocole").set(function (
  this: IMonitor,
  value: unknown,
): void {
  const normalized = normalizeMonitorProtocol(value);
  if (normalized) {
    this.type = normalized;
  }
});

monitorSchema.virtual("typeHTTP").get(function (
  this: IMonitor,
): MonitorHttpMethodCompat {
  const method =
    typeof this.httpMethod === "string" && this.httpMethod.trim() !== ""
      ? this.httpMethod
      : "GET";
  return method.toLowerCase() as MonitorHttpMethodCompat;
});

monitorSchema.virtual("typeHTTP").set(function (
  this: IMonitor,
  value: unknown,
): void {
  const normalized = normalizeMonitorHttpMethod(value);
  if (normalized) {
    this.httpMethod = normalized;
  }
});

monitorSchema.virtual("statut").get(function (this: IMonitor): MonitorStatus {
  return this.status;
});

monitorSchema.virtual("statut").set(function (
  this: IMonitor,
  value: unknown,
): void {
  const normalized = normalizeMonitorStatus(value);
  if (normalized) {
    this.status = normalized;
  }
});

monitorSchema.virtual("intervalle").get(function (this: IMonitor): number {
  return this.interval;
});

monitorSchema.virtual("intervalle").set(function (
  this: IMonitor,
  value: unknown,
): void {
  const normalized = normalizeMonitorInterval(value);
  if (normalized !== null) {
    this.interval = normalized;
  }
});

monitorSchema.set("toJSON", { virtuals: true });
monitorSchema.set("toObject", { virtuals: true });

monitorSchema.methods.creer = async function (
  this: IMonitor,
): Promise<IMonitor> {
  await this.save();
  return this;
};

monitorSchema.methods.modifier = async function (
  this: IMonitor,
  updates: Partial<IMonitor>,
): Promise<IMonitor> {
  Object.assign(this, updates);
  await this.save();
  return this;
};

monitorSchema.methods.supprimer = async function (
  this: IMonitor,
): Promise<void> {
  await this.deleteOne();
};

export default mongoose.model<IMonitor>("Monitor", monitorSchema);

export type Moniteur = IMonitor;
