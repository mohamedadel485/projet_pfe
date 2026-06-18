import mongoose, { Document, Schema } from 'mongoose';

export interface IIncident extends Document {
  monitor: mongoose.Types.ObjectId;
  monitorName: string;
  monitorUrl: string;
  monitorType: 'http' | 'https' | 'ws' | 'wss';
  expectedStatusCode: number;
  status: 'ongoing' | 'resolved';
  startedAt: Date;
  resolvedAt?: Date;
  durationMs: number;
  statusCode?: number;
  errorMessage?: string;
  firstCheckedAt: Date;
  lastCheckedAt: Date;
  description?: string;
  dateDebut?: Date;
  dateFin?: Date;
  statut?: string;
  createdAt: Date;
  updatedAt: Date;
}

const normalizeIncidentStatus = (
  value: unknown,
): IIncident["status"] | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "up" || normalized === "resolved") {
    return "resolved";
  }
  if (normalized === "down" || normalized === "ongoing") {
    return "ongoing";
  }
  return null;
};

const incidentSchema = new Schema<IIncident>(
  {
    monitor: {
      type: Schema.Types.ObjectId,
      ref: 'Monitor',
      required: true,
    },
    monitorName: {
      type: String,
      required: true,
      trim: true,
    },
    monitorUrl: {
      type: String,
      required: true,
      trim: true,
    },
    monitorType: {
      type: String,
      enum: ['http', 'https', 'ws', 'wss'],
      required: true,
    },
    expectedStatusCode: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['ongoing', 'resolved'],
      default: 'ongoing',
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    statusCode: {
      type: Number,
    },
    errorMessage: {
      type: String,
    },
    firstCheckedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastCheckedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

incidentSchema.index({ monitor: 1, status: 1 });
incidentSchema.index({ startedAt: -1 });
incidentSchema.index({ resolvedAt: -1 });

incidentSchema.virtual("description").get(function (this: IIncident): string {
  return this.errorMessage || `${this.monitorName} - ${this.monitorUrl}`;
});

incidentSchema.virtual("description").set(function (
  this: IIncident,
  value: unknown,
): void {
  if (typeof value === "string") {
    this.errorMessage = value;
  }
});

incidentSchema.virtual("dateDebut").get(function (this: IIncident): Date {
  return this.startedAt;
});

incidentSchema.virtual("dateDebut").set(function (
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

incidentSchema.virtual("dateFin").get(function (
  this: IIncident,
): Date | undefined {
  return this.resolvedAt;
});

incidentSchema.virtual("dateFin").set(function (
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

incidentSchema.virtual("statut").get(function (this: IIncident): string {
  return this.status;
});

incidentSchema.virtual("statut").set(function (
  this: IIncident,
  value: unknown,
): void {
  const normalized = normalizeIncidentStatus(value);
  if (normalized) {
    this.status = normalized;
  }
});

incidentSchema.set("toJSON", { virtuals: true });
incidentSchema.set("toObject", { virtuals: true });

export default mongoose.model<IIncident>('Incident', incidentSchema);
