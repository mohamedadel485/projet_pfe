import mongoose, { Document, Schema } from 'mongoose';

export interface IStatusPage extends Document {
  statusPageId: string;
  owner: mongoose.Types.ObjectId;
  pageName: string;
  monitorIds: string[];
  passwordEnabled: boolean;
  passwordHash?: string;
  customDomain?: string;
  logoName?: string;
  density?: 'wide' | 'compact';
  alignment?: 'left' | 'center';
  createdAt: Date;
  updatedAt: Date;
}

const statusPageSchema = new Schema<IStatusPage>(
  {
    statusPageId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pageName: {
      type: String,
      required: true,
      trim: true,
    },
    monitorIds: [
      {
        type: String,
        trim: true,
      },
    ],
    passwordEnabled: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    customDomain: {
      type: String,
      trim: true,
    },
    logoName: {
      type: String,
      trim: true,
    },
    density: {
      type: String,
      enum: ['wide', 'compact'],
      default: 'wide',
    },
    alignment: {
      type: String,
      enum: ['left', 'center'],
      default: 'left',
    },
  },
  {
    timestamps: true,
  }
);

statusPageSchema.index({ owner: 1, updatedAt: -1 });

export default mongoose.model<IStatusPage>('StatusPage', statusPageSchema);
