import mongoose, { Document, Schema } from "mongoose";

export type IntegrationType = "webhook" | "slack" | "telegram";
export type IntegrationEvent = "up" | "down";

export interface IIntegration extends Document {
  owner: mongoose.Types.ObjectId;
  type: IntegrationType;
  endpointUrl: string;
  customValue?: string;
  events: IntegrationEvent[];
  isActive: boolean;
  lastTriggeredAt?: Date;
  integrationType?: IntegrationType;
  eventType?: string;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IIntegration>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Utilisateur",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["webhook", "slack", "telegram"],
      default: "webhook",
      required: true,
    },
    endpointUrl: {
      type: String,
      required: true,
      trim: true,
    },
    customValue: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    events: {
      type: [String],
      enum: ["up", "down"],
      default: ["up", "down"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastTriggeredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

integrationSchema.index({ owner: 1, type: 1, isActive: 1 });

integrationSchema.virtual("integrationType").get(function (
  this: IIntegration,
): IntegrationType {
  return this.type;
});

integrationSchema.virtual("integrationType").set(function (
  this: IIntegration,
  value: unknown,
): void {
  if (
    typeof value === "string" &&
    ["webhook", "slack", "telegram"].includes(value.trim())
  ) {
    this.type = value.trim() as IntegrationType;
  }
});

integrationSchema.virtual("eventType").get(function (
  this: IIntegration,
): string {
  if (this.events.length === 0) {
    return "";
  }
  return this.events.join(",");
});

integrationSchema.virtual("eventType").set(function (
  this: IIntegration,
  value: unknown,
): void {
  if (typeof value === "string") {
    const normalized = value
      .split(",")
      .map((event) => event.trim())
      .filter(
        (event): event is IntegrationEvent =>
          event === "up" || event === "down",
      );
    if (normalized.length > 0) {
      this.events = normalized;
    }
    return;
  }

  if (Array.isArray(value)) {
    const normalized = value.filter(
      (event): event is IntegrationEvent => event === "up" || event === "down",
    );
    if (normalized.length > 0) {
      this.events = normalized;
    }
  }
});

integrationSchema.set("toJSON", { virtuals: true });
integrationSchema.set("toObject", { virtuals: true });

export default mongoose.model<IIntegration>("Integration", integrationSchema);
