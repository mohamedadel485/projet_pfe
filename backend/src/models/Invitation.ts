import mongoose, { Document, Schema } from "mongoose";

export type InvitationRole = "admin" | "user";
export type InvitationStatus = "pending" | "accepted" | "expired";

export interface IInvitation extends Document {
  name?: string;
  email: string;
  token: string;
  invitedBy: mongoose.Types.ObjectId;
  monitorIds: mongoose.Types.ObjectId[];
  role?: InvitationRole;
  status: InvitationStatus;
  expiresAt: Date;
  nom?: string;
  dateEnvoi?: Date;
  statut?: InvitationStatus;
  createdAt: Date;
  updatedAt: Date;
  envoyer(): Promise<IInvitation>;
  accepter(): Promise<IInvitation>;
  refuser(): Promise<IInvitation>;
}

const invitationSchema = new Schema<IInvitation>(
  {
    name: {
      type: String,
      required: false,
      trim: true,
    },
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
      ref: "Utilisateur",
      required: true,
    },
    monitorIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Monitor",
      },
    ],
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index pour optimiser les requêtes
invitationSchema.index({ token: 1 }, { unique: true });
invitationSchema.index({ email: 1 });
invitationSchema.index({ expiresAt: 1 });

invitationSchema.virtual("nom").get(function (this: IInvitation): string {
  return this.name ?? "";
});

invitationSchema.virtual("nom").set(function (
  this: IInvitation,
  value: unknown,
): void {
  if (typeof value === "string") {
    this.name = value;
  }
});

invitationSchema.virtual("statut").get(function (
  this: IInvitation,
): InvitationStatus {
  return this.status;
});

invitationSchema.virtual("statut").set(function (
  this: IInvitation,
  value: unknown,
): void {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "pending" ||
      normalized === "accepted" ||
      normalized === "expired"
    ) {
      this.status = normalized as InvitationStatus;
    }
  }
});

invitationSchema.virtual("dateEnvoi").get(function (this: IInvitation): Date {
  return this.createdAt;
});

invitationSchema.virtual("dateEnvoi").set(function (
  this: IInvitation,
  value: unknown,
): void {
  if (value instanceof Date) {
    this.createdAt = value;
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      this.createdAt = parsed;
    }
  }
});

invitationSchema.set("toJSON", { virtuals: true });
invitationSchema.set("toObject", { virtuals: true });

invitationSchema.methods.envoyer = async function (
  this: IInvitation,
): Promise<IInvitation> {
  await this.save();
  return this;
};

invitationSchema.methods.accepter = async function (
  this: IInvitation,
): Promise<IInvitation> {
  this.status = "accepted";
  await this.save();
  return this;
};

invitationSchema.methods.refuser = async function (
  this: IInvitation,
): Promise<IInvitation> {
  this.status = "expired";
  await this.save();
  return this;
};

export default mongoose.model<IInvitation>("Invitation", invitationSchema);
