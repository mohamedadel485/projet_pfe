import mongoose, { Document, Schema } from 'mongoose';

export interface IMonitor extends Document {
  name: string;
  url: string;
  type: 'http' | 'https' | 'ws' | 'wss';
  interval: number; // en minutes
  timeout: number; // en secondes
  status: 'up' | 'down' | 'paused' | 'pending';
  isActive: boolean;
  owner: mongoose.Types.ObjectId;
  sharedWith: mongoose.Types.ObjectId[];
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  expectedStatusCode: number;
  headers?: Record<string, string>;
  body?: string;
  port?: number;
  lastChecked?: Date;
  lastStatus?: 'up' | 'down';
  uptime: number; // pourcentage
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  responseTime: number; // en ms
  createdAt: Date;
  updatedAt: Date;
  deleredAt?: Date;
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
      enum: ['http', 'https', 'ws', 'wss'],
      default: 'https',
    },
    interval: {
      type: Number,
      default: 5, // 5 minutes par défaut
      min: 1,
    },
    timeout: {
      type: Number,
      default: 30, // 30 secondes par défaut
      min: 5,
      max: 300,
    },
    status: {
      type: String,
      enum: ['up', 'down', 'paused', 'pending'],
      default: 'pending',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedWith: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    httpMethod: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
      default: 'GET',
    },
    expectedStatusCode: {
      type: Number,
      default: 200,
    },
    headers: {
      type: Map,
      of: String,
    },
    body: {
      type: String,
    },
    port: {
      type: Number,
    },
    lastChecked: {
      type: Date,
    },
    lastStatus: {
      type: String,
      enum: ['up', 'down'],
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
  }
);

// Index pour optimiser les requêtes
monitorSchema.index({ owner: 1 });
monitorSchema.index({ sharedWith: 1 });
monitorSchema.index({ status: 1 });

export default mongoose.model<IMonitor>('Monitor', monitorSchema);
