export const IntegrationType = {
  webhook: "webhook",
  slack: "slack",
  telegram: "telegram",
} as const;

export type IntegrationType =
  (typeof IntegrationType)[keyof typeof IntegrationType];

export default IntegrationType;
