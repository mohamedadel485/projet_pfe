import mongoose, { Document, Schema } from 'mongoose';

export type MonitorIpVersion =
  | 'IPv4 / IPv6 (IPv4 Priority)'
  | 'IPv6 / IPv4 (IPv6 Priority)'
  | 'IPv4 only'
  | 'IPv6 only';

export interface IMonitor extends Document {
  name: string;
  url: string;
  type: 'http' | 'https' | 'ws' | 'wss';
  interval: number; // en minutes
  timeout: number; // en secondes
  status: 'up' | 'down' | 'paused' | 'pending';
  pausedByMaintenance: boolean;
  isActive: boolean;
  owner: mongoose.Types.ObjectId;
  sharedWith: mongoose.Types.ObjectId[];
  httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  expectedStatusCode: number;
  ipVersion?: MonitorIpVersion;
  followRedirections?: boolean;
  upStatusCodeGroups?: Array<'2xx' | '3xx'>;
  domainExpiryMode?: 'enabled' | 'disabled';
  domainExpiryAt?: Date;
  domainExpiryCheckedAt?: Date;
  domainExpiryError?: string;
  sslExpiryMode?: 'enabled' | 'disabled';
  sslExpiryAt?: Date;
  sslExpiryCheckedAt?: Date;
  sslExpiryError?: string;
  headers?: Record<string, string>;
  body?: string;
  responseValidation?: {
    field: 'status';
    mode: 'value' | 'type';
    expectedValue?: string;
    expectedType?: 'string' | 'boolean' | 'number';
  };
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
    pausedByMaintenance: {
      type: Boolean,
      default: false,
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
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      default: 'GET',
    },
    expectedStatusCode: {
      type: Number,
      default: 200,
    },
    ipVersion: {
      type: String,
      enum: [
        'IPv4 / IPv6 (IPv4 Priority)',
        'IPv6 / IPv4 (IPv6 Priority)',
        'IPv4 only',
        'IPv6 only',
      ],
      default: 'IPv4 / IPv6 (IPv4 Priority)',
    },
    followRedirections: {
      type: Boolean,
    },
    upStatusCodeGroups: {
      type: [String],
      enum: ['2xx', '3xx'],
    },
    domainExpiryMode: {
      type: String,
      enum: ['enabled', 'disabled'],
      default: 'disabled',
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
      enum: ['enabled', 'disabled'],
      default: 'disabled',
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
        enum: ['status'],
      },
      mode: {
        type: String,
        enum: ['value', 'type'],
      },
      expectedValue: {
        type: String,
      },
      expectedType: {
        type: String,
        enum: ['string', 'boolean', 'number'],
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
