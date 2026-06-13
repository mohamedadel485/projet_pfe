import mongoose, { Document, Schema } from "mongoose";

export interface IDemandeCompte extends Document {
  name: string;
  email: string;
  message?: string;
  status: "pending" | "approved" | "rejected";
  nom?: string;
  dateDemande?: Date;
  statut?: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  accepter(approvedBy?: mongoose.Types.ObjectId): Promise<IDemandeCompte>;
  refuser(): Promise<IDemandeCompte>;
}

const demandeCompteSchema = new Schema<IDemandeCompte>(
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
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedAt: {
      type: Date,
      required: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Utilisateur",
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

// Index pour optimiser les requêtes
demandeCompteSchema.index({ email: 1 });
demandeCompteSchema.index({ status: 1 });
demandeCompteSchema.index({ createdAt: -1 });

demandeCompteSchema.virtual("nom").get(function (this: IDemandeCompte): string {
  return this.name;
});

demandeCompteSchema.virtual("nom").set(function (
  this: IDemandeCompte,
  value: unknown,
): void {
  if (typeof value === "string") {
    this.name = value;
  }
});

demandeCompteSchema.virtual("dateDemande").get(function (
  this: IDemandeCompte,
): Date {
  return this.createdAt;
});

demandeCompteSchema.virtual("dateDemande").set(function (
  this: IDemandeCompte,
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

demandeCompteSchema.virtual("statut").get(function (
  this: IDemandeCompte,
): IDemandeCompte["status"] {
  return this.status;
});

demandeCompteSchema.virtual("statut").set(function (
  this: IDemandeCompte,
  value: unknown,
): void {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "pending" ||
      normalized === "approved" ||
      normalized === "rejected"
    ) {
      this.status = normalized as IDemandeCompte["status"];
    }
  }
});

demandeCompteSchema.set("toJSON", { virtuals: true });
demandeCompteSchema.set("toObject", { virtuals: true });

demandeCompteSchema.methods.accepter = async function (
  this: IDemandeCompte,
  approvedBy?: mongoose.Types.ObjectId,
): Promise<IDemandeCompte> {
  this.status = "approved";
  this.approvedAt = new Date();
  if (approvedBy) {
    this.approvedBy = approvedBy;
  }
  await this.save();
  return this;
};

demandeCompteSchema.methods.refuser = async function (
  this: IDemandeCompte,
): Promise<IDemandeCompte> {
  this.status = "rejected";
  await this.save();
  return this;
};

export default mongoose.model<IDemandeCompte>(
  "DemandeCompte",
  demandeCompteSchema,
  "accountrequests",
);
