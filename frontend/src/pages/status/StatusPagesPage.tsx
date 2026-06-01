import { useEffect, useState } from "react";
import { Eye, PauseCircle, Target, Trash2, UserRound } from "lucide-react";
import {
  deleteMonitor,
  deleteStatusPage,
  fetchMonitors,
  isApiError,
  saveStatusPage,
  type BackendMonitor,
} from "../../lib/api";
import {
  readLocalStatusPageSummaries,
  promoteStatusPageDraft,
  removeStatusPage,
  removeCachedPublicStatusPage,
  type StoredStatusPageSettings,
} from "./statusPageStorage";
import "./status-pages-page.css";

interface StatusPageRow {
  id: string;
  name: string;
  monitorGroup: string;
  accessLevel: string;
  status: string;
  source: "backend" | "local";
}

interface StatusPagesPageProps {
  authToken?: string | null;
  onOpenStatusPage: (statusPageId: string) => void;
  onOpenStatusPageMonitors: (statusPageId: string) => void;
  onPreviewStatusPage?: (statusPageId: string) => void;
  onCreateStatusPage?: () => void;
}

const mapMonitorToStatusPageRow = (monitor: BackendMonitor): StatusPageRow => ({
  id: monitor._id,
  name: monitor.name,
  monitorGroup: monitor.url,
  accessLevel: "Public",
  status: monitor.status === "paused" ? "Unpublished" : "Published",
  source: "backend",
});

type LocalStatusPageSummary = ReturnType<
  typeof readLocalStatusPageSummaries
>[number];

const formatMonitorSummary = (
  monitorIds: string[],
  monitorLookup: Map<string, BackendMonitor>,
): string => {
  const selectedMonitors = monitorIds
    .map((monitorId) => monitorLookup.get(monitorId))
    .filter((monitor): monitor is BackendMonitor => Boolean(monitor));

  if (selectedMonitors.length === 0) {
    return monitorIds.length > 0
      ? `${monitorIds.length} monitor${monitorIds.length > 1 ? "s" : ""} selected`
      : "No monitors selected";
  }

  if (selectedMonitors.length === 1) {
    const monitor = selectedMonitors[0];
    return monitor.url ? `${monitor.name} - ${monitor.url}` : monitor.name;
  }

  const firstMonitor = selectedMonitors[0];
  const suffix =
    selectedMonitors.length > 1 ? ` +${selectedMonitors.length - 1} more` : "";
  return `${firstMonitor?.name || "Monitors"}${suffix}`;
};

const mapLocalStatusPageToRow = (
  summary: LocalStatusPageSummary,
  monitorLookup: Map<string, BackendMonitor>,
): StatusPageRow => {
  const settings = summary.settings as StoredStatusPageSettings;
  const pageName = settings.pageName?.trim() || "New status page";
  const accessLevel = settings.passwordEnabled
    ? "Password protected"
    : "Public";

  return {
    id: summary.id,
    name: pageName,
    monitorGroup: formatMonitorSummary(summary.monitorIds, monitorLookup),
    accessLevel,
    status: "Published",
    source: "local",
  };
};

const shouldRemoveStaleLocalStatusPage = (error: unknown): boolean =>
  isApiError(error) && [403, 404, 410].includes(error.status);

const shouldIgnoreMissingStatusPageDeleteError = (error: unknown): boolean =>
  isApiError(error) && [404, 410].includes(error.status);

function StatusPagesPage({
  authToken,
  onOpenStatusPage,
  onOpenStatusPageMonitors,
  onPreviewStatusPage,
  onCreateStatusPage,
}: StatusPagesPageProps) {
  const [statusPageRows, setStatusPageRows] = useState<StatusPageRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [loadRowsError, setLoadRowsError] = useState<string | null>(null);
  const [deletingStatusPageId, setDeletingStatusPageId] = useState<
    string | null
  >(null);

  const openStatusPageDetails = (statusPageId: string) => {
    onOpenStatusPage(statusPageId);
  };

  const handleDeleteStatusPage = async (statusPage: StatusPageRow) => {
    if (!statusPage.id || deletingStatusPageId) return;

    setDeletingStatusPageId(statusPage.id);
    setLoadRowsError(null);

    try {
      if (statusPage.source === "local") {
        try {
          await deleteStatusPage(statusPage.id, authToken ?? undefined);
        } catch (error) {
          if (!shouldIgnoreMissingStatusPageDeleteError(error)) {
            throw error;
          }
        }

        removeStatusPage(statusPage.id);
        setStatusPageRows((currentRows) =>
          currentRows.filter((row) => row.id !== statusPage.id),
        );
        removeCachedPublicStatusPage(statusPage.id);
        return;
      }

      if (statusPage.source === "backend") {
        await deleteMonitor(statusPage.id, authToken ?? undefined);
        setStatusPageRows((currentRows) =>
          currentRows.filter((row) => row.id !== statusPage.id),
        );
      }

      removeCachedPublicStatusPage(statusPage.id);
    } catch (error) {
      if (isApiError(error)) {
        setLoadRowsError(error.message || "Unable to delete status page.");
      } else if (error instanceof Error && error.message.trim() !== "") {
        setLoadRowsError(error.message);
      } else {
        setLoadRowsError("Unable to delete status page.");
      }
    } finally {
      setDeletingStatusPageId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadStatusPageRows = async () => {
      setIsLoadingRows(true);
      setLoadRowsError(null);
      const localStatusPageSummaries = readLocalStatusPageSummaries();
      const pruneStaleLocalStatusPages = (
        syncResults: PromiseSettledResult<unknown>[],
      ) => {
        const staleStatusPageIds = new Set<string>();

        syncResults.forEach((result, index) => {
          if (
            result.status !== "rejected" ||
            !shouldRemoveStaleLocalStatusPage(result.reason)
          ) {
            return;
          }

          const staleStatusPageId = localStatusPageSummaries[index]?.id?.trim();
          if (staleStatusPageId) {
            staleStatusPageIds.add(staleStatusPageId);
          }
        });

        staleStatusPageIds.forEach((statusPageId) => {
          removeStatusPage(statusPageId);
        });
      };

      const localStatusPageSync = Promise.allSettled(
        localStatusPageSummaries.map(async (summary) => {
          const response = await saveStatusPage(
            summary.id,
            {
              pageName: summary.settings.pageName?.trim() || "Status page",
              monitorIds: summary.monitorIds,
              passwordEnabled: summary.settings.passwordEnabled ?? false,
              password:
                (summary.settings.passwordEnabled ?? false)
                  ? (summary.settings.password || "").trim()
                  : "",
              customDomain: summary.settings.customDomain?.trim(),
              logoName: summary.settings.logoName?.trim(),
              density: summary.settings.density,
              alignment: summary.settings.alignment,
            },
            authToken ?? undefined,
          );

          const resolvedStatusPageId = response.statusPage.id?.trim();
          if (resolvedStatusPageId && resolvedStatusPageId !== summary.id) {
            promoteStatusPageDraft(summary.id, resolvedStatusPageId);
          }

          return response;
        }),
      );

      try {
        const response = await fetchMonitors();
        const localStatusPageSyncResults = await localStatusPageSync;
        pruneStaleLocalStatusPages(localStatusPageSyncResults);
        if (cancelled) return;

        const refreshedLocalStatusPageSummaries =
          readLocalStatusPageSummaries();
        const monitorLookup = new Map(
          response.monitors.map((monitor) => [monitor._id, monitor]),
        );
        const nextLocalStatusPageRows = refreshedLocalStatusPageSummaries.map(
          (summary) => mapLocalStatusPageToRow(summary, monitorLookup),
        );
        const backendStatusPageRows = response.monitors.map(
          mapMonitorToStatusPageRow,
        );

        setStatusPageRows([
          ...nextLocalStatusPageRows,
          ...backendStatusPageRows,
        ]);
      } catch (error) {
        const localStatusPageSyncResults = await localStatusPageSync;
        pruneStaleLocalStatusPages(localStatusPageSyncResults);
        if (cancelled) return;

        const refreshedLocalStatusPageSummaries =
          readLocalStatusPageSummaries();
        const refreshedLocalStatusPageRows =
          refreshedLocalStatusPageSummaries.map((summary) =>
            mapLocalStatusPageToRow(summary, new Map()),
          );
        setStatusPageRows(refreshedLocalStatusPageRows);
        if (isApiError(error)) {
          setLoadRowsError(error.message || "Unable to load status pages.");
          return;
        }

        if (error instanceof Error && error.message.trim() !== "") {
          setLoadRowsError(error.message);
          return;
        }

        setLoadRowsError("Unable to load status pages.");
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

  return (
    <section className="status-pages-page">
      <header className="status-pages-header">
        <h1>Status pages</h1>
        <button
          className="status-pages-create-button"
          type="button"
          onClick={() => onCreateStatusPage?.()}
        >
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
            <p className="status-pages-table-feedback">
              Loading status pages...
            </p>
          ) : loadRowsError ? (
            <p className="status-pages-table-feedback error">{loadRowsError}</p>
          ) : statusPageRows.length === 0 ? (
            <p className="status-pages-table-feedback">
              No status pages found.
            </p>
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
                  if (event.key === "Enter" || event.key === " ") {
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
                    className="status-pages-action-button view"
                    type="button"
                    aria-label="Consulter la page de status"
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
                  <button
                    className="status-pages-action-button"
                    type="button"
                    aria-label="Open status page monitors"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenStatusPageMonitors(statusPage.id);
                    }}
                  >
                    <Target size={12} />
                  </button>
                  <button
                    className="status-pages-action-button"
                    type="button"
                    aria-label={
                      statusPage.status === "Published"
                        ? "Un-publish status page"
                        : "Publish status page"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      setStatusPageRows((currentRows) =>
                        currentRows.map((row) =>
                          row.id === statusPage.id
                            ? {
                                ...row,
                                status:
                                  row.status === "Published"
                                    ? "Unpublished"
                                    : "Published",
                              }
                            : row,
                        ),
                      );
                    }}
                  >
                    <PauseCircle size={12} />
                  </button>
                  <button
                    className="status-pages-action-button delete"
                    type="button"
                    aria-label="Delete status page"
                    disabled={deletingStatusPageId === statusPage.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteStatusPage(statusPage);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
