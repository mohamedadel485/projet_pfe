import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  readStoredStatusPageMonitorIds,
  writeStoredStatusPageMonitorIds,
} from './statusPageStorage';
import './status-page-monitors-page.css';

type StatusPageMonitorState = 'up' | 'down' | 'paused' | 'pending';
type MonitorSortOption = 'name-asc' | 'name-desc' | 'status-first' | 'uptime-high';

export interface StatusPageMonitorOption {
  id: string;
  name: string;
  url?: string;
  protocol: string;
  tags: string[];
  state: StatusPageMonitorState;
  uptime: string;
}

interface StatusPageMonitorsPageProps {
  statusPageId: string;
  statusPageName?: string;
  monitors: StatusPageMonitorOption[];
  onBackToMonitoring: () => void;
  onBackToStatusPages: () => void;
  onOpenGlobalSettings: () => void;
  onCreateMonitor?: () => void;
}

const monitorSortOptions: Array<{ value: MonitorSortOption; label: string }> = [
  { value: 'name-asc', label: 'Friendly name (A-Z)' },
  { value: 'name-desc', label: 'Friendly name (Z-A)' },
  { value: 'status-first', label: 'Status priority' },
  { value: 'uptime-high', label: 'Highest uptime' },
];

const statusOrder: Record<StatusPageMonitorState, number> = {
  down: 0,
  pending: 1,
  paused: 2,
  up: 3,
};

const formatStateLabel = (state: StatusPageMonitorState) => state.charAt(0).toUpperCase() + state.slice(1);

const parseUptimeValue = (uptime: string) => {
  const parsed = Number.parseFloat(uptime.replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const readStoredSelectedMonitorIds = (
  statusPageId: string,
  monitors: StatusPageMonitorOption[],
  isNewStatusPage: boolean,
) => {
  const validMonitorIds = new Set(monitors.map((monitor) => monitor.id));
  let nextSelectedMonitorIds = readStoredStatusPageMonitorIds(statusPageId).filter((monitorId) =>
    validMonitorIds.has(monitorId),
  );

  if (nextSelectedMonitorIds.length === 0 && !isNewStatusPage && validMonitorIds.has(statusPageId)) {
    nextSelectedMonitorIds = [statusPageId];
  }

  return nextSelectedMonitorIds;
};

function StatusPageMonitorsPage({
  statusPageId,
  statusPageName,
  monitors,
  onBackToMonitoring,
  onBackToStatusPages,
  onOpenGlobalSettings,
  onCreateMonitor,
}: StatusPageMonitorsPageProps) {
  const [query, setQuery] = useState('');
  const [sortOption, setSortOption] = useState<MonitorSortOption>('name-asc');
  const isNewStatusPage = statusPageId === 'new';
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>(() =>
    readStoredSelectedMonitorIds(statusPageId, monitors, isNewStatusPage),
  );
  const [hydratedStatusPageId, setHydratedStatusPageId] = useState(statusPageId);
  const pageTitle = isNewStatusPage ? 'Create status page' : 'Status page monitors';
  const pageName = isNewStatusPage ? 'New status page' : statusPageName || 'Status page';
  const monitorIdsKey = monitors.map((monitor) => monitor.id).join('|');

  useEffect(() => {
    setSelectedMonitorIds(readStoredSelectedMonitorIds(statusPageId, monitors, isNewStatusPage));
    setHydratedStatusPageId(statusPageId);
  }, [isNewStatusPage, monitorIdsKey, statusPageId]);

  useEffect(() => {
    if (hydratedStatusPageId !== statusPageId) return;

    writeStoredStatusPageMonitorIds(statusPageId, selectedMonitorIds);
  }, [hydratedStatusPageId, selectedMonitorIds, statusPageId]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleMonitors = [...monitors]
    .filter((monitor) => {
      if (normalizedQuery.length === 0) return true;

      return (
        monitor.name.toLowerCase().includes(normalizedQuery) ||
        (monitor.url ?? '').toLowerCase().includes(normalizedQuery) ||
        monitor.protocol.toLowerCase().includes(normalizedQuery) ||
        monitor.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    })
    .sort((leftMonitor, rightMonitor) => {
      if (sortOption === 'name-desc') {
        return rightMonitor.name.localeCompare(leftMonitor.name);
      }

      if (sortOption === 'status-first') {
        const statusDifference = statusOrder[leftMonitor.state] - statusOrder[rightMonitor.state];
        if (statusDifference !== 0) return statusDifference;
      }

      if (sortOption === 'uptime-high') {
        const uptimeDifference = parseUptimeValue(rightMonitor.uptime) - parseUptimeValue(leftMonitor.uptime);
        if (uptimeDifference !== 0) return uptimeDifference;
      }

      return leftMonitor.name.localeCompare(rightMonitor.name);
    });

  const selectedMonitors = monitors.filter((monitor) => selectedMonitorIds.includes(monitor.id));
  const selectedHealthyCount = selectedMonitors.filter((monitor) => monitor.state === 'up').length;
  const selectedPreview = selectedMonitors.slice(0, 3);
  const selectedOverflowCount = Math.max(0, selectedMonitors.length - selectedPreview.length);

  const toggleMonitorSelection = (monitorId: string) => {
    setSelectedMonitorIds((currentSelectedIds) =>
      currentSelectedIds.includes(monitorId)
        ? currentSelectedIds.filter((currentMonitorId) => currentMonitorId !== monitorId)
        : [...currentSelectedIds, monitorId],
    );
  };

  const selectAllMonitors = () => {
    setSelectedMonitorIds(monitors.map((monitor) => monitor.id));
  };

  const clearSelection = () => {
    setSelectedMonitorIds([]);
  };

  return (
    <section className="status-page-monitors-page">
      <header className="status-page-monitors-header">
        <nav aria-label="Breadcrumb" className="status-page-monitors-breadcrumb">
          <button type="button" onClick={onBackToMonitoring}>
            Monitoring
          </button>
          <ChevronRight size={12} />
          <button type="button" onClick={onBackToStatusPages}>
            Status pages
          </button>
        </nav>

        <div className="status-page-monitors-header-copy">
          <h1>{pageTitle}</h1>
          <p>Select the monitors that should appear on this public status page.</p>
        </div>
      </header>

      <div className="status-page-monitors-layout">
        <div className="status-page-monitors-main">
          <section className="status-page-monitors-card">
            <div className="status-page-monitors-card-head">
              <div>
                <h2>Monitors on status page</h2>
                <p>
                  Search, sort and pick the services you want to expose. You can update this selection again later.
                </p>
              </div>

              <label className="status-page-monitors-sort-shell">
                <select value={sortOption} onChange={(event) => setSortOption(event.target.value as MonitorSortOption)}>
                  {monitorSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
            </div>

            <div className="status-page-monitors-toolbar">
              <label className="status-page-monitors-search">
                <Search size={15} />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Add monitors by name, URL, protocol or tag"
                />
              </label>

              <div className="status-page-monitors-toolbar-actions">
                <button type="button" onClick={selectAllMonitors} disabled={monitors.length === 0}>
                  Add all monitors
                </button>
                <button type="button" onClick={clearSelection} disabled={selectedMonitorIds.length === 0}>
                  Clear selection
                </button>
              </div>
            </div>

            <div className="status-page-monitors-stats">
              <article>
                <strong>{monitors.length}</strong>
                <span>Available monitors</span>
              </article>
              <article>
                <strong>{selectedMonitorIds.length}</strong>
                <span>Selected</span>
              </article>
              <article>
                <strong>{selectedHealthyCount}</strong>
                <span>Healthy in selection</span>
              </article>
            </div>

            <div className={`status-page-monitors-selection-panel ${selectedMonitorIds.length === 0 ? 'empty' : ''}`}>
              <div className="status-page-monitors-selection-copy">
                <h3>
                  {selectedMonitorIds.length === 0
                    ? 'Add monitors to this status page'
                    : `${selectedMonitorIds.length} monitor${selectedMonitorIds.length > 1 ? 's' : ''} selected`}
                </h3>
                <p>
                  {selectedMonitorIds.length === 0
                    ? 'Choose monitors from the list below or add every monitor with one click.'
                    : 'These monitors will be the ones shown first when visitors open this status page.'}
                </p>
              </div>

              {selectedPreview.length > 0 ? (
                <div className="status-page-monitors-selection-tags" aria-label="Selected monitors">
                  {selectedPreview.map((monitor) => (
                    <span key={monitor.id}>{monitor.name}</span>
                  ))}
                  {selectedOverflowCount > 0 ? <span>+{selectedOverflowCount} more</span> : null}
                </div>
              ) : null}
            </div>

            {monitors.length === 0 ? (
              <div className="status-page-monitors-empty-state">
                <h3>No monitors created yet</h3>
                <p>Create a monitor first, then come back here to attach it to your status page.</p>
                {onCreateMonitor ? (
                  <button type="button" onClick={onCreateMonitor}>
                    Create monitor
                  </button>
                ) : null}
              </div>
            ) : visibleMonitors.length === 0 ? (
              <div className="status-page-monitors-empty-state">
                <h3>No monitors match this search</h3>
                <p>Try a different name, URL, protocol or tag.</p>
              </div>
            ) : (
              <div className="status-page-monitors-list">
                {visibleMonitors.map((monitor) => {
                  const isSelected = selectedMonitorIds.includes(monitor.id);

                  return (
                    <article className={`status-page-monitor-item ${isSelected ? 'selected' : ''}`} key={monitor.id}>
                      <button
                        type="button"
                        className="status-page-monitor-main-button"
                        onClick={() => toggleMonitorSelection(monitor.id)}
                        aria-pressed={isSelected}
                      >
                        <span className={`status-page-monitor-check ${isSelected ? 'selected' : ''}`} aria-hidden="true">
                          {isSelected ? <Check size={14} /> : null}
                        </span>

                        <div className="status-page-monitor-copy">
                          <div className="status-page-monitor-title-row">
                            <strong>{monitor.name}</strong>
                            <span className={`status-page-monitor-state ${monitor.state}`}>
                              {formatStateLabel(monitor.state)}
                            </span>
                          </div>

                          <p>{monitor.url || 'No URL configured'}</p>

                          <div className="status-page-monitor-meta">
                            <span className="status-page-monitor-badge protocol">{monitor.protocol}</span>
                            {monitor.tags.map((tag) => (
                              <span className="status-page-monitor-badge" key={`${monitor.id}-${tag}`}>
                                {tag}
                              </span>
                            ))}
                            <span className="status-page-monitor-uptime">Uptime {monitor.uptime}</span>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`status-page-monitor-toggle ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleMonitorSelection(monitor.id)}
                      >
                        {isSelected ? 'Added' : 'Add'}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="status-page-monitors-sidebar" aria-label="Status page steps">
          <section className="status-page-monitors-sidebar-card">
            <p className="status-page-monitors-sidebar-label">Setup flow</p>

            <div className="status-page-monitors-step active">
              <span className="status-page-monitors-step-index">1</span>
              <div className="status-page-monitors-step-copy">
                <strong>Monitors</strong>
                <small>Choose what will be visible</small>
              </div>
            </div>

            <button type="button" className="status-page-monitors-step link" onClick={onOpenGlobalSettings}>
              <span className="status-page-monitors-step-index">2</span>
              <div className="status-page-monitors-step-copy">
                <strong>Global settings</strong>
                <small>Branding, access and features</small>
              </div>
              <ChevronRight size={15} />
            </button>
          </section>

          <section className="status-page-monitors-sidebar-card">
            <p className="status-page-monitors-sidebar-label">Summary</p>
            <h3>{pageName}</h3>
            <p className="status-page-monitors-sidebar-summary">
              {selectedMonitorIds.length > 0
                ? `${selectedMonitorIds.length} monitor${selectedMonitorIds.length > 1 ? 's' : ''} selected for this page.`
                : 'No monitors selected yet.'}
            </p>

            {selectedPreview.length > 0 ? (
              <div className="status-page-monitors-sidebar-selected">
                {selectedPreview.map((monitor) => (
                  <span key={`sidebar-${monitor.id}`}>{monitor.name}</span>
                ))}
                {selectedOverflowCount > 0 ? <span>+{selectedOverflowCount} more</span> : null}
              </div>
            ) : null}

            <button type="button" className="status-page-monitors-primary-action" onClick={onOpenGlobalSettings}>
              Next step: Global settings
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default StatusPageMonitorsPage;
