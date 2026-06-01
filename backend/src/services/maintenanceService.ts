import mongoose from 'mongoose';
import Monitor from '../models/Monitor';
import Maintenance, { MaintenanceStatus } from '../models/Maintenance';

const ACTIVE_MAINTENANCE_STATUSES: MaintenanceStatus[] = ['ongoing', 'paused'];

const normalizeObjectId = (value: unknown): string | null => {
  if (!mongoose.isValidObjectId(value)) {
    return null;
  }

  return String(value);
};

class MaintenanceService {
  getStatusForWindow(startAt: Date, endAt: Date, now: Date = new Date()): MaintenanceStatus {
    const startTime = startAt.getTime();
    const endTime = endAt.getTime();
    const nowTime = now.getTime();

    if (nowTime >= endTime) {
      return 'completed';
    }
    if (nowTime >= startTime) {
      return 'ongoing';
    }
    return 'scheduled';
  }

  async refreshMaintenanceStates(now: Date = new Date()): Promise<void> {
    const toStart = await Maintenance.find({
      status: 'scheduled',
      startAt: { $lte: now },
      endAt: { $gt: now },
    }).select('monitor');

    if (toStart.length > 0) {
      await Maintenance.updateMany(
        {
          status: 'scheduled',
          startAt: { $lte: now },
          endAt: { $gt: now },
        },
        {
          $set: { status: 'ongoing' },
        }
      );
    }

    const toComplete = await Maintenance.find({
      status: { $in: ['scheduled', 'ongoing', 'paused'] },
      endAt: { $lte: now },
    }).select('monitor');

    if (toComplete.length > 0) {
      await Maintenance.updateMany(
        {
          status: { $in: ['scheduled', 'ongoing', 'paused'] },
          endAt: { $lte: now },
        },
        {
          $set: { status: 'completed' },
        }
      );
    }

    const monitorIds = new Set<string>();
    const startingMonitorIds = new Set<string>();
    for (const entry of toStart) {
      const monitorId = normalizeObjectId(entry.monitor);
      if (!monitorId) continue;
      monitorIds.add(monitorId);
      startingMonitorIds.add(monitorId);
    }
    for (const entry of toComplete) {
      const monitorId = normalizeObjectId(entry.monitor);
      if (!monitorId) continue;
      monitorIds.add(monitorId);
    }

    if (monitorIds.size === 0) return;
    
    // Pour les monitors où une maintenance démarre, réinitialiser le flag manuallyResumed
    if (startingMonitorIds.size > 0) {
      await Monitor.updateMany(
        { _id: { $in: Array.from(startingMonitorIds) } },
        { $set: { manuallyResumed: false } }
      );
    }
    
    await Promise.all(
      Array.from(monitorIds).map(async (monitorId) => {
        try {
          await this.syncMonitorMaintenanceState(monitorId, now);
        } catch (error) {
          console.warn(
            `Impossible de synchroniser la maintenance pour le monitor ${monitorId}:`,
            error,
          );
        }
      }),
    );
  }

  async syncMonitorMaintenanceState(monitorId: string, now: Date = new Date()): Promise<void> {
    if (!mongoose.isValidObjectId(monitorId)) {
      return;
    }

    const monitor = await Monitor.findById(monitorId);
    if (!monitor) return;

    const activeMaintenanceCount = await Maintenance.countDocuments({
      monitor: monitor._id,
      status: { $in: ACTIVE_MAINTENANCE_STATUSES },
      startAt: { $lte: now },
      endAt: { $gt: now },
    });

    const hasActiveMaintenance = activeMaintenanceCount > 0;

    if (hasActiveMaintenance) {
      // Si l'utilisateur a manuellement repris le monitoring, on respecte son choix
      if (monitor.manuallyResumed === true) {
        return;
      }

      const shouldUpdate = monitor.status !== 'paused' || monitor.pausedByMaintenance !== true;
      if (!shouldUpdate) return;

      monitor.status = 'paused';
      monitor.pausedByMaintenance = true;
      await monitor.save();
      return;
    }

    // La maintenance est terminée
    if (monitor.pausedByMaintenance !== true && monitor.manuallyResumed !== true) return;

    if (monitor.status === 'paused') {
      monitor.status = 'pending';
    }
    monitor.pausedByMaintenance = false;
    monitor.manuallyResumed = false; // Réinitialiser le flag de reprise manuelle
    await monitor.save();
  }
}

export default new MaintenanceService();
