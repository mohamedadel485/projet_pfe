import mongoose, { Document, Schema } from "mongoose";

export type TokenType =
  | "access"
  | "refresh"
  | "reset_password"
  | "verify_email";

export interface IToken extends Document {
  user: mongoose.Types.ObjectId;
  token: string;
  type: TokenType;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tokenSchema = new Schema<IToken>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["access", "refresh", "reset_password", "verify_email"],
      required: true,
      index: true,
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

tokenSchema.index({ user: 1, type: 1 });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IToken>("Tokens", tokenSchema);
