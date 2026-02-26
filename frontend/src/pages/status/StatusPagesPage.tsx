import { useEffect, useState } from 'react';
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
}

const statusPageRows: StatusPageRow[] = Array.from({ length: 9 }, (_, index) => ({
  id: `status-page-${index + 1}`,
  name: 'Status page',
  monitorGroup: 'All monitors',
  accessLevel: 'Public',
  status: 'Published',
}));

function StatusPagesPage({ onOpenStatusPage }: StatusPagesPageProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const openStatusPageDetails = (statusPageId: string) => {
    onOpenStatusPage(statusPageId);
  };

  useEffect(() => {
    if (!openMenuId) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.status-pages-menu-wrap')) {
        setOpenMenuId(null);
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [openMenuId]);

  return (
    <section className="status-pages-page">
      <header className="status-pages-header">
        <h1>Status pages</h1>
        <button className="status-pages-create-button" type="button">
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

          {statusPageRows.map((statusPage, rowIndex) => (
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
                    onClick={() =>
                      setOpenMenuId((currentOpenId) =>
                        currentOpenId === statusPage.id ? null : statusPage.id
                      )
                    }
                  >
                    <EllipsisVertical size={12} />
                  </button>

                  {openMenuId === statusPage.id && (
                    <div
                      className={`status-pages-options-menu ${
                        rowIndex >= Math.max(statusPageRows.length - 4, 0) ? 'open-up' : ''
                      }`}
                      id={`status-page-menu-${statusPage.id}`}
                      role="menu"
                    >
                      <button
                        className="status-pages-menu-item"
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId(null);
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
                        }}
                      >
                        <span className="status-pages-menu-item-icon" aria-hidden="true">
                          <Trash2 size={14} />
                        </span>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
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
