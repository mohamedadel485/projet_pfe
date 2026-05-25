import mongoose, { Document, Schema } from 'mongoose';

export type MaintenanceStatus = 'scheduled' | 'ongoing' | 'paused' | 'completed' | 'cancelled';

export interface IMaintenance extends Document {
  name: string;
  reason: string;
  status: MaintenanceStatus;
  monitor: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  startAt: Date;
  endAt: Date;
  nom?: string;
  raison?: string;
  statutMaintenance?: MaintenanceStatus;
  dateDebut?: Date;
  dateFin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const maintenanceSchema = new Schema<IMaintenance>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'paused', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    monitor: {
      type: Schema.Types.ObjectId,
      ref: 'Monitor',
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      required: true,
      validate: {
        validator(this: IMaintenance, value: Date): boolean {
          if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
            return false;
          }
          if (!(this.startAt instanceof Date) || Number.isNaN(this.startAt.getTime())) {
            return false;
          }
          return value.getTime() > this.startAt.getTime();
        },
        message: 'La date de fin doit être après la date de début',
      },
    },
  },
  {
    timestamps: true,
  }
);

maintenanceSchema.index({ owner: 1, createdAt: -1 });
maintenanceSchema.index({ monitor: 1, startAt: 1, endAt: 1 });
maintenanceSchema.index({ status: 1, startAt: 1, endAt: 1 });

maintenanceSchema.virtual('nom').get(function (this: IMaintenance): string {
  return this.name;
});

maintenanceSchema.virtual('nom').set(function (
  this: IMaintenance,
  value: unknown,
): void {
  if (typeof value === 'string') {
    this.name = value;
  }
});

maintenanceSchema.virtual('raison').get(function (this: IMaintenance): string {
  return this.reason;
});

maintenanceSchema.virtual('raison').set(function (
  this: IMaintenance,
  value: unknown,
): void {
  if (typeof value === 'string') {
    this.reason = value;
  }
});

maintenanceSchema.virtual('statutMaintenance').get(function (
  this: IMaintenance,
): MaintenanceStatus {
  return this.status;
});

maintenanceSchema.virtual('statutMaintenance').set(function (
  this: IMaintenance,
  value: unknown,
): void {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (
      ['scheduled', 'ongoing', 'paused', 'completed', 'cancelled'].includes(
        normalized,
      )
    ) {
      this.status = normalized as MaintenanceStatus;
    }
  }
});

maintenanceSchema.virtual('dateDebut').get(function (this: IMaintenance): Date {
  return this.startAt;
});

maintenanceSchema.virtual('dateDebut').set(function (
  this: IMaintenance,
  value: unknown,
): void {
  if (value instanceof Date) {
    this.startAt = value;
    return;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      this.startAt = parsed;
    }
  }
});

maintenanceSchema.virtual('dateFin').get(function (this: IMaintenance): Date {
  return this.endAt;
});

maintenanceSchema.virtual('dateFin').set(function (
  this: IMaintenance,
  value: unknown,
): void {
  if (value instanceof Date) {
    this.endAt = value;
    return;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      this.endAt = parsed;
    }
  }
});

maintenanceSchema.set('toJSON', { virtuals: true });
maintenanceSchema.set('toObject', { virtuals: true });

export default mongoose.model<IMaintenance>('Maintenance', maintenanceSchema);
