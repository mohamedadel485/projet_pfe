import { ChevronRight, Clock3, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  MONITOR_TRASH_TTL_MS,
  type DeletedMonitorTrashEntry,
} from '../../lib/monitorTrash';
import './MonitorTrashPage.css';

interface MonitorTrashPageProps {
  deletedMonitorTrash: DeletedMonitorTrashEntry[];
  trashClock: number;
  onBackToMonitoring: () => void;
  onRestoreMonitor: (monitorId: string) => void;
  restoringMonitorId?: string | null;
}

const formatTrashTimeRemaining = (expiresAt: number, now: number): string => {
  const remainingMs = Math.max(0, expiresAt - now);
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  if (remainingMinutes <= 0) {
    return 'Expired';
  }

  if (remainingMinutes === 1) {
    return '1 min left';
  }

  return `${remainingMinutes} min left`;
};

function MonitorTrashPage({
  deletedMonitorTrash,
  trashClock,
  onBackToMonitoring,
  onRestoreMonitor,
  restoringMonitorId,
}: MonitorTrashPageProps) {
  const activeTrashEntries = useMemo(
    () => deletedMonitorTrash.filter((entry) => entry.expiresAt > trashClock),
    [deletedMonitorTrash, trashClock],
  );

  const sortedTrashEntries = useMemo(
    () =>
      [...activeTrashEntries].sort((leftEntry, rightEntry) => {
        if (leftEntry.expiresAt !== rightEntry.expiresAt) {
          return leftEntry.expiresAt - rightEntry.expiresAt;
        }
        return rightEntry.deletedAt - leftEntry.deletedAt;
      }),
    [activeTrashEntries],
  );

  return (
    <section className="monitor-trash-page">
      <header className="monitor-trash-page-header">
        <nav aria-label="Breadcrumb" className="monitor-trash-page-breadcrumb">
          <button type="button" onClick={onBackToMonitoring}>
            Monitoring
          </button>
          <ChevronRight size={12} />
          <span>Trash</span>
        </nav>

        <div className="monitor-trash-page-hero">
          <div className="monitor-trash-page-title">
            <span className="monitor-trash-page-icon" aria-hidden="true">
              <Trash2 size={22} />
            </span>
            <div className="monitor-trash-page-title-copy">
              <h1>Trash</h1>
              <p>
                Deleted monitors stay here for{' '}
                {MONITOR_TRASH_TTL_MS / 60000} minutes before they disappear.
              </p>
            </div>
          </div>

          <div className="monitor-trash-page-actions">
            <div className="monitor-trash-page-count">
              <strong>{activeTrashEntries.length}</strong>
              <span>Deleted monitors</span>
            </div>
            <button
              type="button"
              className="monitor-trash-page-back-button"
              onClick={onBackToMonitoring}
            >
              Back to monitoring
            </button>
          </div>
        </div>
      </header>

      <div className="monitor-trash-page-body">
        {sortedTrashEntries.length === 0 ? (
          <div className="monitor-trash-page-empty">
            <span className="monitor-trash-page-empty-icon" aria-hidden="true">
              <Clock3 size={16} />
            </span>
            <div>
              <strong>No deleted monitors</strong>
              <p>
                Restored or expired items will disappear from this page
                automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="monitor-trash-page-list">
            {sortedTrashEntries.map((entry) => {
              const isRestoring = restoringMonitorId === entry.monitor._id;
              const isExpired = entry.expiresAt <= trashClock;

              return (
                <article className="monitor-trash-page-item" key={entry.monitor._id}>
                  <div className="monitor-trash-page-item-copy">
                    <strong>{entry.monitor.name}</strong>
                    <span>{entry.monitor.url}</span>
                  </div>

                  <div className="monitor-trash-page-item-meta">
                    <span className="monitor-trash-page-expiry">
                      <Clock3 size={11} aria-hidden="true" />
                      {formatTrashTimeRemaining(entry.expiresAt, trashClock)}
                    </span>
                    <button
                      type="button"
                      className="monitor-trash-page-restore-button"
                      onClick={() => {
                        onRestoreMonitor(entry.monitor._id);
                      }}
                      disabled={isExpired || isRestoring}
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default MonitorTrashPage;
