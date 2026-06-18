import mongoose, { Document, Schema } from 'mongoose';

export interface IMonitorLog extends Document {
  monitor: mongoose.Types.ObjectId;
  status: 'up' | 'down';
  responseTime: number; // en ms
  statusCode?: number;
  errorMessage?: string;
  checkedAt: Date;
}

const monitorLogSchema = new Schema<IMonitorLog>(
  {
    monitor: {
      type: Schema.Types.ObjectId,
      ref: 'Monitor',
      required: true,
    },
    status: {
      type: String,
      enum: ['up', 'down'],
      required: true,
    },
    responseTime: {
      type: Number,
      required: true,
    },
    statusCode: {
      type: Number,
    },
    errorMessage: {
      type: String,
    },
    checkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Index pour optimiser les requêtes
monitorLogSchema.index({ monitor: 1, checkedAt: -1 });

// TTL index pour auto-supprimer les logs après 30 jours
monitorLogSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model<IMonitorLog>('MonitorLog', monitorLogSchema);
