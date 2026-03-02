import Monitor from '../models/Monitor';
import Maintenance, { MaintenanceStatus } from '../models/Maintenance';

const ACTIVE_MAINTENANCE_STATUSES: MaintenanceStatus[] = ['ongoing', 'paused'];

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
    for (const entry of toStart) {
      monitorIds.add(String(entry.monitor));
    }
    for (const entry of toComplete) {
      monitorIds.add(String(entry.monitor));
    }

    if (monitorIds.size === 0) return;
    await Promise.all(Array.from(monitorIds).map((monitorId) => this.syncMonitorMaintenanceState(monitorId, now)));
  }

  async syncMonitorMaintenanceState(monitorId: string, now: Date = new Date()): Promise<void> {
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
      const shouldUpdate = monitor.status !== 'paused' || monitor.pausedByMaintenance !== true;
      if (!shouldUpdate) return;

      monitor.status = 'paused';
      monitor.pausedByMaintenance = true;
      await monitor.save();
      return;
    }

    if (monitor.pausedByMaintenance !== true) return;

    if (monitor.status === 'paused') {
      monitor.status = 'pending';
    }
    monitor.pausedByMaintenance = false;
    await monitor.save();
  }
}

export default new MaintenanceService();
