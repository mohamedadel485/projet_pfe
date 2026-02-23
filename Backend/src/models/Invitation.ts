import mongoose, { Document, Schema } from 'mongoose';

export interface IInvitation extends Document {
  email: string;
  token: string;
  invitedBy: mongoose.Types.ObjectId;
  role: 'user';
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    token: {
      type: String,
      required: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      default: 'user',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired'],
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour optimiser les requêtes
invitationSchema.index({ token: 1 }, { unique: true });
invitationSchema.index({ email: 1 });
invitationSchema.index({ expiresAt: 1 });

export default mongoose.model<IInvitation>('Invitation', invitationSchema);
