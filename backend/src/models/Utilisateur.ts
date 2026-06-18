import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import Maintenance from "./Maintenance";
import Integration from "./Integration";
import type { IMaintenance } from "./Maintenance";
import type { IIntegration } from "./Integration";

export type UserRole = "super_admin" | "admin" | "user";
export type UserStatus = "active" | "inactive";

export interface IUserPublicProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  status: UserStatus;
}

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  avatar?: string | null;
  isActive: boolean;
  nom?: string;
  motDePasse?: string;
  statut?: UserStatus;
  invitedBy?: mongoose.Types.ObjectId;
  invitationToken?: string;
  invitationExpires?: Date;
  passwordResetCode?: string;
  passwordResetExpires?: Date;
  loginOtpCode?: string;
  loginOtpExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  authenticate(candidatePassword: string): Promise<boolean>;
  sAuthentifier(candidatePassword: string): Promise<boolean>;
  consulterProfil(): IUserPublicProfile;
  modifierProfil(updates: {
    name?: string;
    email?: string;
    avatar?: string | null;
  }): Promise<IUser>;
  reinitialiserMotDePasse(newPassword: string): Promise<IUser>;
  consulterMaintenance(): Promise<IMaintenance[]>;
  superviserIntegration(): Promise<IIntegration[]>;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "Utilisateur" },
    invitationToken: { type: String },
    invitationExpires: { type: Date },
    passwordResetCode: { type: String },
    passwordResetExpires: { type: Date },
    loginOtpCode: { type: String },
    loginOtpExpires: { type: Date },
  },
  { timestamps: true },
);

userSchema.virtual("status").get(function (this: IUser): UserStatus {
  return this.isActive ? "active" : "inactive";
});

userSchema.virtual("status").set(function (this: IUser, value: unknown): void {
  if (typeof value === "boolean") {
    this.isActive = value;
    return;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    this.isActive = normalized !== "inactive";
  }
});

userSchema.virtual("nom").get(function (this: IUser): string {
  return this.name;
});

userSchema.virtual("nom").set(function (this: IUser, value: unknown): void {
  if (typeof value === "string") {
    this.name = value;
  }
});

userSchema.virtual("statut").get(function (this: IUser): UserStatus {
  return this.isActive ? "active" : "inactive";
});

userSchema.virtual("statut").set(function (this: IUser, value: unknown): void {
  if (typeof value === "boolean") {
    this.isActive = value;
    return;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    this.isActive = normalized !== "inactive";
  }
});

userSchema.virtual("motDePasse").get(function (this: IUser): string {
  return this.password;
});

userSchema.virtual("motDePasse").set(function (
  this: IUser,
  value: unknown,
): void {
  if (typeof value === "string") {
    this.password = value;
  }
});

userSchema.virtual("DateDeCreation").get(function (this: IUser): Date {
  return this.createdAt;
});

userSchema.virtual("DateDeCreation").set(function (
  this: IUser,
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

userSchema.virtual("Actif").get(function (this: IUser): boolean {
  return this.isActive;
});

userSchema.virtual("Actif").set(function (this: IUser, value: unknown): void {
  if (typeof value === "boolean") {
    this.isActive = value;
    return;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    this.isActive = normalized !== "inactive" && normalized !== "false";
  }
});

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err as Error);
  }
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.authenticate = async function (
  this: IUser,
  candidatePassword: string,
): Promise<boolean> {
  return this.comparePassword(candidatePassword);
};

userSchema.methods.sAuthentifier = async function (
  this: IUser,
  candidatePassword: string,
): Promise<boolean> {
  return this.comparePassword(candidatePassword);
};

userSchema.methods.consulterProfil = function (
  this: IUser,
): IUserPublicProfile {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    avatar: this.avatar || null,
    status: this.isActive ? "active" : "inactive",
  };
};

userSchema.methods.modifierProfil = async function (
  this: IUser,
  updates: {
    name?: string;
    email?: string;
    avatar?: string | null;
  },
): Promise<IUser> {
  if (typeof updates.name === "string") {
    this.name = updates.name;
  }

  if (typeof updates.email === "string") {
    this.email = updates.email;
  }

  if (updates.avatar !== undefined) {
    this.avatar = updates.avatar;
  }

  await this.save();
  return this;
};

userSchema.methods.reinitialiserMotDePasse = async function (
  this: IUser,
  newPassword: string,
): Promise<IUser> {
  this.password = newPassword;
  await this.save();
  return this;
};

userSchema.methods.consulterMaintenance = async function (
  this: IUser,
): Promise<IMaintenance[]> {
  return Maintenance.find({ owner: this._id }).sort({
    startAt: -1,
    createdAt: -1,
  });
};

userSchema.methods.superviserIntegration = async function (
  this: IUser,
): Promise<IIntegration[]> {
  return Integration.find({ owner: this._id }).sort({ createdAt: -1 });
};

export default mongoose.model<IUser>("Utilisateur", userSchema, "users");

export type Utilisateur = IUser;
