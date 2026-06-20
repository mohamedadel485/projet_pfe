import { useEffect, useState } from "react";
import { Eye, PauseCircle, Target, Trash2, UserRound } from "lucide-react";
import {
  deleteStatusPage,
  fetchMonitors,
  fetchStatusPages,
  isApiError,
  saveStatusPage,
  updateStatusPagePublish,
  type BackendMonitor,
  type BackendStatusPage,
} from "../../lib/api";
import {
  cacheStoredStatusPageFromBackend,
  cleanupLegacyMonitorStatusPageEntries,
  readLocalStatusPageSummaries,
  removeStatusPage,
  removeCachedPublicStatusPage,
  syncStoredStatusPageFromBackend,
  type StoredStatusPageSettings,
} from "./statusPageStorage";
import { useAppLanguage, type TranslationKey } from "../../lib/language";
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

const mapBackendStatusPageToRow = (
  statusPage: BackendStatusPage,
  monitorLookup: Map<string, BackendMonitor>,
  t: (key: TranslationKey, values?: Record<string, string | number | boolean | null | undefined>) => string,
): StatusPageRow => ({
  id: statusPage.id,
  name: statusPage.pageName?.trim() || t("statusPages.newPage"),
  monitorGroup: formatMonitorSummary(statusPage.monitorIds ?? [], monitorLookup, t),
  accessLevel: statusPage.passwordEnabled ? "Password protected" : "Public",
  status: statusPage.isPublished === false ? "Unpublished" : "Published",
  source: "backend",
});

type LocalStatusPageSummary = ReturnType<
  typeof readLocalStatusPageSummaries
>[number];

const formatMonitorSummary = (
  monitorIds: string[],
  monitorLookup: Map<string, BackendMonitor>,
  t: (key: TranslationKey, values?: Record<string, string | number | boolean | null | undefined>) => string,
): string => {
  const selectedMonitors = monitorIds
    .map((monitorId) => monitorLookup.get(monitorId))
    .filter((monitor): monitor is BackendMonitor => Boolean(monitor));

  if (selectedMonitors.length === 0) {
    return monitorIds.length > 0
      ? t("statusPages.summary.selectedCount", { count: monitorIds.length })
      : t("statusPages.summary.noneSelected");
  }

  if (selectedMonitors.length === 1) {
    const monitor = selectedMonitors[0];
    return monitor.url ? `${monitor.name} - ${monitor.url}` : monitor.name;
  }

  const firstMonitor = selectedMonitors[0];
  const suffix =
    selectedMonitors.length > 1 ? t("statusPages.summary.more", { count: selectedMonitors.length - 1 }) : "";
  return `${firstMonitor?.name || t("statusPages.summary.monitors")}${suffix}`;
};

const mapLocalStatusPageToRow = (
  summary: LocalStatusPageSummary,
  monitorLookup: Map<string, BackendMonitor>,
  t: (key: TranslationKey, values?: Record<string, string | number | boolean | null | undefined>) => string,
): StatusPageRow => {
  const settings = summary.settings as StoredStatusPageSettings;
  const pageName = settings.pageName?.trim() || t("statusPages.newPage");
  const accessLevel = settings.passwordEnabled
    ? "Password protected"
    : "Public";

  return {
    id: summary.id,
    name: pageName,
    monitorGroup: formatMonitorSummary(summary.monitorIds, monitorLookup, t),
    accessLevel,
    status: settings.isPublished === false ? "Unpublished" : "Published",
    source: "local",
  };
};

const shouldIgnoreMissingStatusPageDeleteError = (error: unknown): boolean =>
  isApiError(error) && [404, 410].includes(error.status);

function StatusPagesPage({
  authToken,
  onOpenStatusPage,
  onOpenStatusPageMonitors,
  onPreviewStatusPage,
  onCreateStatusPage,
}: StatusPagesPageProps) {
  const { t } = useAppLanguage();
  const [statusPageRows, setStatusPageRows] = useState<StatusPageRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [loadRowsError, setLoadRowsError] = useState<string | null>(null);
  const [deletingStatusPageId, setDeletingStatusPageId] = useState<
    string | null
  >(null);
  const [publishingStatusPageId, setPublishingStatusPageId] = useState<
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
        await deleteStatusPage(statusPage.id, authToken ?? undefined);
        setStatusPageRows((currentRows) =>
          currentRows.filter((row) => row.id !== statusPage.id),
        );
        removeStatusPage(statusPage.id);
      }

      removeCachedPublicStatusPage(statusPage.id);
    } catch (error) {
      if (isApiError(error)) {
        setLoadRowsError(error.message || t("statusPages.deleteError"));
      } else if (error instanceof Error && error.message.trim() !== "") {
        setLoadRowsError(error.message);
      } else {
        setLoadRowsError(t("statusPages.deleteError"));
      }
    } finally {
      setDeletingStatusPageId(null);
    }
  };

  const handleTogglePublishStatus = async (statusPage: StatusPageRow) => {
    if (!statusPage.id || publishingStatusPageId) return;

    const nextIsPublished = statusPage.status !== "Published";
    const previousStatus = statusPage.status;

    setPublishingStatusPageId(statusPage.id);
    setLoadRowsError(null);
    setStatusPageRows((currentRows) =>
      currentRows.map((row) =>
        row.id === statusPage.id
          ? {
              ...row,
              status: nextIsPublished ? "Published" : "Unpublished",
            }
          : row,
      ),
    );

    try {
      if (statusPage.source === "backend") {
        await updateStatusPagePublish(
          statusPage.id,
          nextIsPublished,
          authToken ?? undefined,
        );
        syncStoredStatusPageFromBackend(statusPage.id, {
          isPublished: nextIsPublished,
        });
        if (!nextIsPublished) {
          removeCachedPublicStatusPage(statusPage.id);
        }
        return;
      }

      const currentSettings = readLocalStatusPageSummaries().find(
        (summary) => summary.id === statusPage.id,
      )?.settings;

      if (currentSettings) {
        syncStoredStatusPageFromBackend(statusPage.id, {
          ...currentSettings,
          isPublished: nextIsPublished,
        });
      }

      await saveStatusPage(
        statusPage.id,
        {
          pageName: statusPage.name,
          monitorIds:
            readLocalStatusPageSummaries().find(
              (summary) => summary.id === statusPage.id,
            )?.monitorIds ?? [],
          passwordEnabled: currentSettings?.passwordEnabled ?? false,
          password:
            (currentSettings?.passwordEnabled ?? false)
              ? (currentSettings?.password || "").trim()
              : "",
          customDomain: currentSettings?.customDomain?.trim(),
          logoName: currentSettings?.logoName?.trim(),
          density: currentSettings?.density,
          alignment: currentSettings?.alignment,
          isPublished: nextIsPublished,
        },
        authToken ?? undefined,
      );

      if (!nextIsPublished) {
        removeCachedPublicStatusPage(statusPage.id);
      }
    } catch (error) {
      setStatusPageRows((currentRows) =>
        currentRows.map((row) =>
          row.id === statusPage.id ? { ...row, status: previousStatus } : row,
        ),
      );

      if (isApiError(error)) {
        setLoadRowsError(error.message || t("statusPages.publishError"));
      } else if (error instanceof Error && error.message.trim() !== "") {
        setLoadRowsError(error.message);
      } else {
        setLoadRowsError(t("statusPages.publishError"));
      }
    } finally {
      setPublishingStatusPageId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadStatusPageRows = async () => {
      setIsLoadingRows(true);
      setLoadRowsError(null);

      let backendStatusPages: BackendStatusPage[] = [];

      try {
        try {
          const statusPagesResponse = await fetchStatusPages(authToken ?? undefined);
          backendStatusPages = statusPagesResponse.statusPages ?? [];
        } catch (statusPagesError) {
          if (!isApiError(statusPagesError) || statusPagesError.status !== 404) {
            throw statusPagesError;
          }
        }

        const backendStatusPageIds = new Set(
          backendStatusPages.map((statusPage) => statusPage.id),
        );
        backendStatusPages.forEach((statusPage) => {
          cacheStoredStatusPageFromBackend(statusPage.id, statusPage);
        });

        const monitorsResponse = await fetchMonitors();
        cleanupLegacyMonitorStatusPageEntries(
          monitorsResponse.monitors.map((monitor) => monitor._id),
        );
        if (cancelled) return;

        const localStatusPageSummaries = readLocalStatusPageSummaries().filter(
          (summary) => !backendStatusPageIds.has(summary.id),
        );
        const monitorLookup = new Map(
          monitorsResponse.monitors.map((monitor) => [monitor._id, monitor]),
        );
        const nextLocalStatusPageRows = localStatusPageSummaries.map(
          (summary) => mapLocalStatusPageToRow(summary, monitorLookup, t),
        );
        const backendStatusPageRows = backendStatusPages.map(
          (statusPage) => mapBackendStatusPageToRow(statusPage, monitorLookup, t),
        );

        setStatusPageRows([
          ...nextLocalStatusPageRows,
          ...backendStatusPageRows,
        ]);
        setLoadRowsError(null);
      } catch (error) {
        if (cancelled) return;

        const refreshedLocalStatusPageSummaries =
          readLocalStatusPageSummaries();
        const refreshedLocalStatusPageRows =
          refreshedLocalStatusPageSummaries.map((summary) =>
            mapLocalStatusPageToRow(summary, new Map(), t),
          );
        setStatusPageRows(refreshedLocalStatusPageRows);
        if (isApiError(error)) {
          setLoadRowsError(error.message || t("statusPages.loadError"));
          return;
        }

        if (error instanceof Error && error.message.trim() !== "") {
          setLoadRowsError(error.message);
          return;
        }

        setLoadRowsError(t("statusPages.loadError"));
      } finally {
        if (!cancelled) {
          setIsLoadingRows(false);
        }
      }
    };

    void loadStatusPageRows();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadStatusPageRows();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authToken, t]);

  return (
    <section className="status-pages-page">
      <header className="status-pages-header">
        <h1>{t("statusPages.title")}</h1>
        <button
          className="status-pages-create-button"
          type="button"
          onClick={() => onCreateStatusPage?.()}
        >
          {t("statusPages.create")}
        </button>
      </header>

      <div className="status-pages-table">
        <div className="status-pages-table-grid">
          <div className="status-pages-table-head">
            <span>{t("statusPages.columns.name")}</span>
            <span>{t("statusPages.columns.accessLevel")}</span>
            <span>{t("statusPages.columns.status")}</span>
            <span>{t("statusPages.columns.actions")}</span>
          </div>

          {isLoadingRows ? (
            <p className="status-pages-table-feedback">{t("statusPages.loading")}</p>
          ) : loadRowsError ? (
            <p className="status-pages-table-feedback error">{loadRowsError}</p>
          ) : statusPageRows.length === 0 ? (
            <p className="status-pages-table-feedback">{t("statusPages.empty")}</p>
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
                  <span>
                    {statusPage.accessLevel === "Public"
                      ? t("statusPages.access.public")
                      : t("statusPages.access.passwordProtected")}
                  </span>
                </div>

                <p className="status-pages-status-cell">
                  {statusPage.status === "Published"
                    ? t("statusPages.status.published")
                    : statusPage.status === "Unpublished"
                      ? t("statusPages.status.unpublished")
                      : statusPage.status}
                </p>

                <div
                  className="status-pages-actions-cell"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <button
                    className="status-pages-action-button view"
                    type="button"
                    aria-label={t("statusPages.actions.view")}
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
                    aria-label={t("statusPages.actions.monitors")}
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
                        ? t("statusPages.actions.unpublish")
                        : t("statusPages.actions.publish")
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleTogglePublishStatus(statusPage);
                    }}
                    disabled={publishingStatusPageId === statusPage.id}
                  >
                    <PauseCircle size={12} />
                  </button>
                  <button
                    className="status-pages-action-button delete"
                    type="button"
                    aria-label={t("statusPages.actions.delete")}
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

export default StatusPagesPage;
