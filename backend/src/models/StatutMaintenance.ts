export const StatutMaintenance = {
  scheduled: "scheduled",
  ongoing: "ongoing",
  paused: "paused",
  completed: "completed",
  cancelled: "cancelled",
} as const;

export type StatutMaintenance =
  (typeof StatutMaintenance)[keyof typeof StatutMaintenance];

export default StatutMaintenance;
