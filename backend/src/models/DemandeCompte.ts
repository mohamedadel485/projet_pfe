import mongoose, { Document, Schema } from "mongoose";

export interface IDemandeCompte extends Document {
  name: string;
  email: string;
  message?: string;
  status: "pending" | "approved" | "rejected";
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
