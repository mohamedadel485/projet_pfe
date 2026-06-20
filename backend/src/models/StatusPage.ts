import mongoose, { Document, Schema } from "mongoose";

export interface IStatusPage extends Document {
  statusPageId: string;
  owner: mongoose.Types.ObjectId;
  pageName: string;
  monitorIds: string[];
  passwordEnabled: boolean;
  passwordHash?: string;
  isPublished: boolean;
  customDomain?: string;
  logoName?: string;
  logoPath?: string;
  density?: "wide" | "compact";
  alignment?: "left" | "center";
  nom?: string;
  moniteurs?: string[];
  statut?: string;
  creer(): Promise<IStatusPage>;
  modifier(updates: Partial<IStatusPage>): Promise<IStatusPage>;
  supprimer(): Promise<void>;
  createdAt: Date;
  updatedAt: Date;
}

const normalizeMonitorIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item !== "");
};

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
      ref: "Utilisateur",
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
    isPublished: {
      type: Boolean,
      default: true,
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
    logoPath: {
      type: String,
      trim: true,
    },
    density: {
      type: String,
      enum: ["wide", "compact"],
      default: "wide",
    },
    alignment: {
      type: String,
      enum: ["left", "center"],
      default: "left",
    },
  },
  {
    timestamps: true,
  },
);

statusPageSchema.index({ owner: 1, updatedAt: -1 });

statusPageSchema.virtual("nom").get(function (this: IStatusPage): string {
  return this.pageName;
});

statusPageSchema.virtual("nom").set(function (
  this: IStatusPage,
  value: unknown,
): void {
  if (typeof value === "string") {
    this.pageName = value;
  }
});

statusPageSchema.virtual("moniteurs").get(function (
  this: IStatusPage,
): string[] {
  return this.monitorIds;
});

statusPageSchema.virtual("moniteurs").set(function (
  this: IStatusPage,
  value: unknown,
): void {
  const normalized = normalizeMonitorIds(value);
  if (normalized) {
    this.monitorIds = normalized;
  }
});

statusPageSchema.virtual("statut").get(function (this: IStatusPage): string {
  return this.passwordEnabled ? "protected" : "public";
});

statusPageSchema.virtual("statut").set(function (
  this: IStatusPage,
  value: unknown,
): void {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    this.passwordEnabled = normalized === "protected";
  }
});

statusPageSchema.set("toJSON", { virtuals: true });
statusPageSchema.set("toObject", { virtuals: true });

statusPageSchema.methods.creer = async function (
  this: IStatusPage,
): Promise<IStatusPage> {
  await this.save();
  return this;
};

statusPageSchema.methods.modifier = async function (
  this: IStatusPage,
  updates: Partial<IStatusPage>,
): Promise<IStatusPage> {
  Object.assign(this, updates);
  await this.save();
  return this;
};

statusPageSchema.methods.supprimer = async function (
  this: IStatusPage,
): Promise<void> {
  await this.deleteOne();
};

export default mongoose.model<IStatusPage>("StatusPage", statusPageSchema);
