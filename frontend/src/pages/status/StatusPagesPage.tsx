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
  onPreviewStatusPage?: (statusPageId: string) => void;
  onCreateStatusPage?: () => void;
}

const STATUS_PAGE_ROWS: StatusPageRow[] = [
  {
    id: 'status-page-1',
    name: 'Status page',
    monitorGroup: 'All monitors',
    accessLevel: 'Public',
    status: 'Published',
  },
];

function StatusPagesPage({ onOpenStatusPage, onPreviewStatusPage, onCreateStatusPage }: StatusPagesPageProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openMenuPosition, setOpenMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [statusPageRows, setStatusPageRows] = useState<StatusPageRow[]>(STATUS_PAGE_ROWS);

  const openStatusPageDetails = (statusPageId: string) => {
    onOpenStatusPage(statusPageId);
  };

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

          {statusPageRows.map((statusPage) => (
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
                              openStatusPageDetails(statusPage.id);
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
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId(null);
                              setOpenMenuPosition(null);
                              setStatusPageRows((currentRows) => currentRows.filter((row) => row.id !== statusPage.id));
                            }}
                          >
                            <span className="status-pages-menu-item-icon" aria-hidden="true">
                              <Trash2 size={14} />
                            </span>
                            <span>Delete</span>
                          </button>
                        </div>,
                        document.body,
                      )
                    : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default StatusPagesPage;
