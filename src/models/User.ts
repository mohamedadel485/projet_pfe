import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "super_admin" | "admin" | "user";

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  avatar?: string | null;
  role: UserRole;
  isActive: boolean;
  invitedBy?: mongoose.Types.ObjectId;
  invitationToken?: string;
  invitationExpires?: Date;
  passwordResetCode?: string;
  passwordResetExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String, default: null },
    role: {
      type: String,
      enum: ["super_admin", "admin", "user"],
      default: "user",
    },
    isActive: { type: Boolean, default: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    invitationToken: { type: String },
    invitationExpires: { type: Date },
    passwordResetCode: { type: String },
    passwordResetExpires: { type: Date },
  },
  { timestamps: true },
);

// Hash password avant sauvegarde
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

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>("User", userSchema);
