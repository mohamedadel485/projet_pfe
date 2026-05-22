import mongoose, { Document, Schema } from 'mongoose';

export type IntegrationType = 'webhook' | 'slack' | 'telegram';
export type IntegrationEvent = 'up' | 'down';

export interface IIntegration extends Document {
  owner: mongoose.Types.ObjectId;
  type: IntegrationType;
  endpointUrl: string;
  customValue?: string;
  events: IntegrationEvent[];
  isActive: boolean;
  lastTriggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IIntegration>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['webhook', 'slack', 'telegram'],
      default: 'webhook',
      required: true,
    },
    endpointUrl: {
      type: String,
      required: true,
      trim: true,
    },
    customValue: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    events: {
      type: [String],
      enum: ['up', 'down'],
      default: ['up', 'down'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastTriggeredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

integrationSchema.index({ owner: 1, type: 1, isActive: 1 });

export default mongoose.model<IIntegration>('Integration', integrationSchema);
