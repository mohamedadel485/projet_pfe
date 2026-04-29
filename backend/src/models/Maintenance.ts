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

export default mongoose.model<IMaintenance>('Maintenance', maintenanceSchema);
