import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EllipsisVertical,
  Eye,
  PauseCircle,
  PencilLine,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react';
import { deleteMonitor, fetchMonitors, isApiError, type BackendMonitor } from '../../lib/api';
import './status-pages-page.css';

interface StatusPageRow {
  id: string;
  name: string;
  monitorGroup: string;
  accessLevel: string;
  status: string;
}

interface StatusPagesPageProps {
  onOpenStatusPage: (statusPageId: string) => void;
  onOpenStatusPageMonitors: (statusPageId: string) => void;
  onPreviewStatusPage?: (statusPageId: string) => void;
  onCreateStatusPage?: () => void;
}

const mapMonitorToStatusPageRow = (monitor: BackendMonitor): StatusPageRow => ({
  id: monitor._id,
  name: monitor.name,
  monitorGroup: monitor.url,
  accessLevel: 'Public',
  status: monitor.status === 'paused' ? 'Unpublished' : 'Published',
});

function StatusPagesPage({
  onOpenStatusPage,
  onOpenStatusPageMonitors,
  onPreviewStatusPage,
  onCreateStatusPage,
}: StatusPagesPageProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openMenuPosition, setOpenMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [statusPageRows, setStatusPageRows] = useState<StatusPageRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [loadRowsError, setLoadRowsError] = useState<string | null>(null);
  const [deletingMonitorId, setDeletingMonitorId] = useState<string | null>(null);

  const openStatusPageDetails = (statusPageId: string) => {
    onOpenStatusPage(statusPageId);
  };

  const handleDeleteStatusPage = async (monitorId: string) => {
    if (!monitorId || deletingMonitorId) return;

    setDeletingMonitorId(monitorId);
    setLoadRowsError(null);

    try {
      await deleteMonitor(monitorId);
      setStatusPageRows((currentRows) => currentRows.filter((row) => row.id !== monitorId));
    } catch (error) {
      if (isApiError(error)) {
        setLoadRowsError(error.message || 'Unable to delete monitor.');
      } else if (error instanceof Error && error.message.trim() !== '') {
        setLoadRowsError(error.message);
      } else {
        setLoadRowsError('Unable to delete monitor.');
      }
    } finally {
      setDeletingMonitorId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadStatusPageRows = async () => {
      setIsLoadingRows(true);
      setLoadRowsError(null);

      try {
        const response = await fetchMonitors();
        if (cancelled) return;

        setStatusPageRows(response.monitors.map(mapMonitorToStatusPageRow));
      } catch (error) {
        if (cancelled) return;

        setStatusPageRows([]);
        if (isApiError(error)) {
          setLoadRowsError(error.message || 'Unable to load status pages.');
          return;
        }

        if (error instanceof Error && error.message.trim() !== '') {
          setLoadRowsError(error.message);
          return;
        }

        setLoadRowsError('Unable to load status pages.');
      } finally {
        if (!cancelled) {
          setIsLoadingRows(false);
        }
      }
    };

    void loadStatusPageRows();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!openMenuId) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.status-pages-menu-wrap') && !target?.closest('.status-pages-options-menu')) {
        setOpenMenuId(null);
        setOpenMenuPosition(null);
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
        setOpenMenuPosition(null);
      }
    };

    const handleViewportChange = () => {
      setOpenMenuId(null);
      setOpenMenuPosition(null);
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleDocumentKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [openMenuId]);

  return (
    <section className="status-pages-page">
      <header className="status-pages-header">
        <h1>Status pages</h1>
        <button className="status-pages-create-button" type="button" onClick={() => onCreateStatusPage?.()}>
          Create Status page
        </button>
      </header>

      <div className="status-pages-table">
        <div className="status-pages-table-grid">
          <div className="status-pages-table-head">
            <span>Name</span>
            <span>Access level</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {isLoadingRows ? (
            <p className="status-pages-table-feedback">Loading status pages...</p>
          ) : loadRowsError ? (
            <p className="status-pages-table-feedback error">{loadRowsError}</p>
          ) : statusPageRows.length === 0 ? (
            <p className="status-pages-table-feedback">No monitors found.</p>
          ) : (
            statusPageRows.map((statusPage) => (
              <article
                className="status-pages-row"
                key={statusPage.id}
                role="button"
                tabIndex={0}
                onClick={() => openStatusPageDetails(statusPage.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openStatusPageDetails(statusPage.id);
                  }
                }}
              >
                <div className="status-pages-name-cell">
                  <span className="status-pages-name-icon" aria-hidden="true">
                    <span className="status-pages-name-icon-core" />
                  </span>
                  <div className="status-pages-name-copy">
                    <strong>{statusPage.name}</strong>
                    <span>{statusPage.monitorGroup}</span>
                  </div>
                </div>

                <div className="status-pages-access-cell">
                  <UserRound size={11} />
                  <span>{statusPage.accessLevel}</span>
                </div>

                <p className="status-pages-status-cell">{statusPage.status}</p>

                <div
                  className="status-pages-actions-cell"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    aria-label="View status page"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (onPreviewStatusPage) {
                        onPreviewStatusPage(statusPage.id);
                        return;
                      }
                      openStatusPageDetails(statusPage.id);
                    }}
                  >
                    <Eye size={12} />
                  </button>
                  <div
                    className="status-pages-menu-wrap"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <button
                      className="status-pages-more-button"
                      type="button"
                      aria-label="More actions"
                      aria-expanded={openMenuId === statusPage.id}
                      aria-controls={`status-page-menu-${statusPage.id}`}
                      onClick={(event) => {
                        const trigger = event.currentTarget;
                        const rect = trigger.getBoundingClientRect();
                        const menuWidth = 220;
                        const menuHeight = 46 * 4 + 2;
                        const openUp = rect.bottom + 8 + menuHeight > window.innerHeight - 8;
                        const top = openUp ? rect.top - menuHeight - 8 : rect.bottom + 8;
                        const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));

                        setOpenMenuId((currentOpenId) => {
                          if (currentOpenId === statusPage.id) {
                            setOpenMenuPosition(null);
                            return null;
                          }
                          setOpenMenuPosition({ top, left });
                          return statusPage.id;
                        });
                      }}
                    >
                      <EllipsisVertical size={12} />
                    </button>

                    {openMenuId === statusPage.id && openMenuPosition
                      ? createPortal(
                          <div
                            className="status-pages-options-menu status-pages-options-menu-floating"
                            id={`status-page-menu-${statusPage.id}`}
                            role="menu"
                            style={{ top: `${openMenuPosition.top}px`, left: `${openMenuPosition.left}px` }}
                          >
                            <button
                              className="status-pages-menu-item"
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenMenuId(null);
                                setOpenMenuPosition(null);
                                onOpenStatusPageMonitors(statusPage.id);
                              }}
                            >
                              <span className="status-pages-menu-item-icon" aria-hidden="true">
                                <Target size={14} />
                              </span>
                              <span>Monitors</span>
                            </button>
                            <button
                              className="status-pages-menu-item"
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenMenuId(null);
                                setOpenMenuPosition(null);
                                openStatusPageDetails(statusPage.id);
                              }}
                            >
                              <span className="status-pages-menu-item-icon" aria-hidden="true">
                                <PencilLine size={14} />
                              </span>
                              <span>Global settings</span>
                            </button>
                            <button
                              className="status-pages-menu-item"
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenMenuId(null);
                                setOpenMenuPosition(null);
                                setStatusPageRows((currentRows) =>
                                  currentRows.map((row) =>
                                    row.id === statusPage.id
                                      ? {
                                          ...row,
                                          status: row.status === 'Published' ? 'Unpublished' : 'Published',
                                        }
                                      : row,
                                  ),
                                );
                              }}
                            >
                              <span className="status-pages-menu-item-icon" aria-hidden="true">
                                <PauseCircle size={14} />
                              </span>
                              <span>Un-publish</span>
                            </button>
                            <button
                              className="status-pages-menu-item delete"
                              type="button"
                              role="menuitem"
                              disabled={deletingMonitorId === statusPage.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenMenuId(null);
                                setOpenMenuPosition(null);
                                void handleDeleteStatusPage(statusPage.id);
                              }}
                            >
                              <span className="status-pages-menu-item-icon" aria-hidden="true">
                                <Trash2 size={14} />
                              </span>
                              <span>{deletingMonitorId === statusPage.id ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          </div>,
                          document.body,
                        )
                      : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default StatusPagesPage;
