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
  createdAt: Date;
  updatedAt: Date;
}

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

export default mongoose.model<IIncident>('Incident', incidentSchema);
