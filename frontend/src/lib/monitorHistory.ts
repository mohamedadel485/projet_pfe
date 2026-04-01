import type { BackendMonitor, BackendMonitorLog } from './api';

export type HistoryBarState = 'up' | 'warning' | 'down';

export const HISTORY_BAR_COUNT = 32;
export const HISTORY_WINDOW_MINUTES = 24 * 60;
export const MINUTES_PER_HISTORY_BAR = HISTORY_WINDOW_MINUTES / HISTORY_BAR_COUNT;

export const parseUptimePercent = (value: string): number => {
  const parsed = Number(value.replace('%', ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
};

const buildHistoryFromUptime = (
  uptime: number,
  status: BackendMonitor['status'],
  barCount: number,
): HistoryBarState[] => {
  if (status === 'paused' || status === 'pending') {
    return Array.from({ length: barCount }, () => 'warning');
  }

  const safeUptime = Number.isFinite(uptime) ? Math.min(100, Math.max(0, uptime)) : 0;
  const downtime = 100 - safeUptime;

  let downBars = Math.round((downtime / 100) * barCount);
  if (downtime > 0 && downBars === 0) {
    downBars = 1;
  }
  downBars = Math.min(barCount, downBars);

  const history = Array.from({ length: barCount }, () => 'up' as HistoryBarState);

  if (status === 'down') {
    history[barCount - 1] = 'down';
    downBars = Math.max(0, downBars - 1);
  } else {
    downBars = Math.min(barCount - 1, downBars);
  }

  if (downBars === 0) {
    return history;
  }

  let downPlaced = 0;
  for (let index = 0; index < barCount - 1; index += 1) {
    const expectedDownPlaced = Math.round(((index + 1) * downBars) / (barCount - 1));
    if (expectedDownPlaced > downPlaced) {
      history[index] = 'down';
      downPlaced += 1;
    }
  }

  return history;
};

export const buildMonitorHistoryBars = ({
  uptime,
  status,
  logsNewestFirst = [],
  barCount = HISTORY_BAR_COUNT,
}: {
  uptime: number;
  status: BackendMonitor['status'];
  logsNewestFirst?: BackendMonitorLog[];
  barCount?: number;
}): HistoryBarState[] => {
  if (status === 'paused' || status === 'pending') {
    return Array.from({ length: barCount }, () => 'warning');
  }

  if (logsNewestFirst.length < barCount) {
    return buildHistoryFromUptime(uptime, status, barCount);
  }

  const recentBars = logsNewestFirst
    .slice(0, barCount)
    .reverse()
    .map((log) => (log.status === 'down' ? 'down' : 'up'));

  recentBars[barCount - 1] = status;
  return recentBars;
};
