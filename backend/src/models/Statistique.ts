import type { IMonitor } from "./Monitor";

export interface IStatistique {
  id: string;
  uptime: number;
  downtime: number;
  disponibilite: number;
  calculer(source?: StatistiqueSource): IStatistique;
}

export type StatistiqueSource = Pick<
  IMonitor,
  "uptime" | "totalChecks" | "successfulChecks" | "failedChecks"
> & {
  id?: string;
};

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

export class Statistique implements IStatistique {
  id: string;

  uptime: number;

  downtime: number;

  disponibilite: number;

  constructor(data?: Partial<Pick<IStatistique, "id" | "uptime" | "downtime" | "disponibilite">>) {
    this.id =
      data?.id ??
      `stat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.uptime = clampPercentage(data?.uptime ?? 0);
    this.downtime = clampPercentage(data?.downtime ?? 0);
    this.disponibilite = clampPercentage(data?.disponibilite ?? this.uptime);
  }

  calculer(source?: StatistiqueSource): IStatistique {
    if (source) {
      if (source.totalChecks > 0) {
        this.uptime = clampPercentage(
          (source.successfulChecks / source.totalChecks) * 100,
        );
      } else {
        this.uptime = clampPercentage(source.uptime);
      }
    }

    this.downtime = clampPercentage(100 - this.uptime);
    this.disponibilite = this.uptime;
    return this;
  }
}

export default Statistique;
