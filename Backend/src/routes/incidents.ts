import { Router, Response } from 'express';
import Monitor from '../models/Monitor';
import MonitorLog from '../models/MonitorLog';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

interface IncidentMonitorPayload {
  _id: string;
  name: string;
  url: string;
  type: 'http' | 'https' | 'ws' | 'wss';
  expectedStatusCode: number;
}

interface AggregatedIncident {
  _id: string;
  monitor: IncidentMonitorPayload | null;
  status: 'up' | 'down';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
  startedAt: string;
  resolvedAt: string | null;
  durationMs: number;
}

/**
 * GET /api/incidents
 * Lister les incidents agrégés (transitions down -> up), comme UptimeRobot.
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { limit = 100, page = 1, status } = req.query;
      const parsedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
      const parsedPage = Math.max(1, Number(page) || 1);
      const skip = (parsedPage - 1) * parsedLimit;

      const accessibleMonitors = await Monitor.find({
        $or: [{ owner: req.user!._id }, { sharedWith: req.user!._id }],
      })
        .select('_id name url type expectedStatusCode')
        .lean();

      const monitorIds = accessibleMonitors.map((monitor) => monitor._id);
      if (monitorIds.length === 0) {
        res.json({
          incidents: [],
          pagination: {
            total: 0,
            page: parsedPage,
            limit: parsedLimit,
            pages: 0,
          },
        });
        return;
      }

      const monitorById = new Map<string, IncidentMonitorPayload>(
        accessibleMonitors.map((monitor) => [
          String(monitor._id),
          {
            _id: String(monitor._id),
            name: monitor.name,
            url: monitor.url,
            type: monitor.type,
            expectedStatusCode: monitor.expectedStatusCode,
          },
        ])
      );

      const logQuery: {
        monitor: { $in: typeof monitorIds };
      } = {
        monitor: { $in: monitorIds },
      };

      const logs = await MonitorLog.find(logQuery)
        .sort({ monitor: 1, checkedAt: 1 })
        .lean();

      const openIncidentByMonitor = new Map<
        string,
        {
          startedAt: Date;
          firstLog: typeof logs[number];
        }
      >();
      const incidents: AggregatedIncident[] = [];

      for (const log of logs) {
        const monitorId = String(log.monitor);
        const openedIncident = openIncidentByMonitor.get(monitorId);

        if (log.status === 'down') {
          if (!openedIncident) {
            openIncidentByMonitor.set(monitorId, {
              startedAt: new Date(log.checkedAt),
              firstLog: log,
            });
          }
          continue;
        }

        if (openedIncident) {
          const startedAt = openedIncident.startedAt;
          const resolvedAt = new Date(log.checkedAt);
          const durationMs = Math.max(0, resolvedAt.getTime() - startedAt.getTime());

          incidents.push({
            _id: String(openedIncident.firstLog._id),
            monitor: monitorById.get(monitorId) ?? null,
            status: 'up',
            responseTime: durationMs,
            statusCode: openedIncident.firstLog.statusCode,
            errorMessage: openedIncident.firstLog.errorMessage,
            checkedAt: startedAt.toISOString(),
            startedAt: startedAt.toISOString(),
            resolvedAt: resolvedAt.toISOString(),
            durationMs,
          });

          openIncidentByMonitor.delete(monitorId);
        }
      }

      const now = Date.now();
      for (const [monitorId, openedIncident] of openIncidentByMonitor.entries()) {
        const startedAt = openedIncident.startedAt;
        const durationMs = Math.max(0, now - startedAt.getTime());

        incidents.push({
          _id: String(openedIncident.firstLog._id),
          monitor: monitorById.get(monitorId) ?? null,
          status: 'down',
          responseTime: durationMs,
          statusCode: openedIncident.firstLog.statusCode,
          errorMessage: openedIncident.firstLog.errorMessage,
          checkedAt: startedAt.toISOString(),
          startedAt: startedAt.toISOString(),
          resolvedAt: null,
          durationMs,
        });
      }

      incidents.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      const filteredIncidents =
        status === 'up' || status === 'down'
          ? incidents.filter((incident) => incident.status === status)
          : incidents;

      const total = filteredIncidents.length;
      const paginatedIncidents = filteredIncidents.slice(skip, skip + parsedLimit);

      res.json({
        incidents: paginatedIncidents,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          pages: Math.ceil(total / parsedLimit),
        },
      });
    } catch (error: any) {
      console.error('Erreur récupération incidents:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des incidents' });
    }
  }
);

export default router;
