import mongoose, { Document, Schema } from 'mongoose';

export interface IAccountRequest extends Document {
  name: string;
  email: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
}

const accountRequestSchema = new Schema<IAccountRequest>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    message: {
      type: String,
      required: false,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedAt: {
      type: Date,
      required: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour optimiser les requêtes
accountRequestSchema.index({ email: 1 });
accountRequestSchema.index({ status: 1 });
accountRequestSchema.index({ createdAt: -1 });

export default mongoose.model<IAccountRequest>('AccountRequest', accountRequestSchema);
