import Incident from '../models/Incident';
import { IMonitor } from '../models/Monitor';

interface CheckResultLike {
  status: 'up' | 'down';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
}

interface RecordMonitorIncidentInput {
  monitor: IMonitor;
  result: CheckResultLike;
  checkedAt: Date;
}

class IncidentService {
  private buildMonitorSnapshot(monitor: IMonitor): {
    monitorName: string;
    monitorUrl: string;
    monitorType: IMonitor['type'];
    expectedStatusCode: number;
  } {
    return {
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      monitorType: monitor.type,
      expectedStatusCode: monitor.expectedStatusCode,
    };
  }

  private buildDuration(startedAt: Date, endedAt: Date): number {
    return Math.max(0, endedAt.getTime() - startedAt.getTime());
  }

  async recordMonitorCheck(input: RecordMonitorIncidentInput): Promise<void> {
    const { monitor, result, checkedAt } = input;
    const snapshot = this.buildMonitorSnapshot(monitor);
    const ongoingIncident = await Incident.findOne({
      monitor: monitor._id,
      status: 'ongoing',
    }).sort({ startedAt: -1 });

    if (result.status === 'down') {
      if (ongoingIncident) {
        ongoingIncident.monitorName = snapshot.monitorName;
        ongoingIncident.monitorUrl = snapshot.monitorUrl;
        ongoingIncident.monitorType = snapshot.monitorType;
        ongoingIncident.expectedStatusCode = snapshot.expectedStatusCode;
        ongoingIncident.lastCheckedAt = checkedAt;
        ongoingIncident.durationMs = this.buildDuration(ongoingIncident.startedAt, checkedAt);
        if (typeof result.statusCode === 'number' && typeof ongoingIncident.statusCode !== 'number') {
          ongoingIncident.statusCode = result.statusCode;
        }
        if (!ongoingIncident.errorMessage && result.errorMessage) {
          ongoingIncident.errorMessage = result.errorMessage;
        }

        await ongoingIncident.save();
        return;
      }

      await Incident.create({
        monitor: monitor._id,
        ...snapshot,
        status: 'ongoing',
        startedAt: checkedAt,
        firstCheckedAt: checkedAt,
        lastCheckedAt: checkedAt,
        durationMs: 0,
        statusCode: result.statusCode,
        errorMessage: result.errorMessage,
      });
      return;
    }

    if (!ongoingIncident) {
      return;
    }

    ongoingIncident.monitorName = snapshot.monitorName;
    ongoingIncident.monitorUrl = snapshot.monitorUrl;
    ongoingIncident.monitorType = snapshot.monitorType;
    ongoingIncident.expectedStatusCode = snapshot.expectedStatusCode;
    ongoingIncident.status = 'resolved';
    ongoingIncident.resolvedAt = checkedAt;
    ongoingIncident.lastCheckedAt = checkedAt;
    ongoingIncident.durationMs = this.buildDuration(ongoingIncident.startedAt, checkedAt);

    if (typeof result.statusCode === 'number' && typeof ongoingIncident.statusCode !== 'number') {
      ongoingIncident.statusCode = result.statusCode;
    }
    if (!ongoingIncident.errorMessage && result.errorMessage) {
      ongoingIncident.errorMessage = result.errorMessage;
    }

    await ongoingIncident.save();
  }
}

export default new IncidentService();
