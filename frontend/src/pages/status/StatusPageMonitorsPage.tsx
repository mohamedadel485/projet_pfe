import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppLanguage } from '../../lib/language';
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

const monitorSortOptions: MonitorSortOption[] = ['name-asc', 'name-desc', 'status-first', 'uptime-high'];

const statusOrder: Record<StatusPageMonitorState, number> = {
  down: 0,
  pending: 1,
  paused: 2,
  up: 3,
};

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
  const { t } = useAppLanguage();
  const [query, setQuery] = useState('');
  const [sortOption, setSortOption] = useState<MonitorSortOption>('name-asc');
  const isNewStatusPage = statusPageId === 'new';
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>(() =>
    readStoredSelectedMonitorIds(statusPageId, monitors, isNewStatusPage),
  );
  const [hydratedStatusPageId, setHydratedStatusPageId] = useState(statusPageId);
  const pageTitle = isNewStatusPage ? t('statusPageMonitors.title.create') : t('statusPageMonitors.title.monitors');
  const pageName = isNewStatusPage ? t('statusPageMonitors.page.newPage') : statusPageName || t('statusPages.newPage');
  const monitorIdsKey = monitors.map((monitor) => monitor.id).join('|');
  const monitorStateLabels: Record<StatusPageMonitorState, string> = {
    up: t('dashboard.monitor.status.up'),
    down: t('dashboard.monitor.status.down'),
    paused: t('dashboard.monitor.status.paused'),
    pending: t('dashboard.monitor.status.pending'),
  };
  const monitorSortLabels: Record<MonitorSortOption, string> = {
    'name-asc': t('statusPageMonitors.sort.nameAsc'),
    'name-desc': t('statusPageMonitors.sort.nameDesc'),
    'status-first': t('statusPageMonitors.sort.statusFirst'),
    'uptime-high': t('statusPageMonitors.sort.highestUptime'),
  };

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
            {t('menu.monitoring')}
          </button>
          <ChevronRight size={12} />
          <button type="button" onClick={onBackToStatusPages}>
            {t('statusPages.title')}
          </button>
        </nav>

        <div className="status-page-monitors-header-copy">
          <h1>{pageTitle}</h1>
          <p>{t('statusPageMonitors.subtitle')}</p>
        </div>
      </header>

      <div className="status-page-monitors-layout">
        <div className="status-page-monitors-main">
          <section className="status-page-monitors-card">
            <div className="status-page-monitors-card-head">
              <div>
                <h2>{t('statusPageMonitors.card.title')}</h2>
                <p>{t('statusPageMonitors.card.subtitle')}</p>
              </div>

              <label className="status-page-monitors-sort-shell">
                <select value={sortOption} onChange={(event) => setSortOption(event.target.value as MonitorSortOption)}>
                  {monitorSortOptions.map((option) => (
                    <option key={option} value={option}>
                      {monitorSortLabels[option]}
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
                  placeholder={t('statusPageMonitors.searchPlaceholder')}
                />
              </label>

              <div className="status-page-monitors-toolbar-actions">
                <button type="button" onClick={selectAllMonitors} disabled={monitors.length === 0}>
                  {t('statusPageMonitors.addAll')}
                </button>
                <button type="button" onClick={clearSelection} disabled={selectedMonitorIds.length === 0}>
                  {t('statusPageMonitors.clearSelection')}
                </button>
              </div>
            </div>

            <div className="status-page-monitors-stats">
              <article>
                <strong>{monitors.length}</strong>
                <span>{t('statusPageMonitors.availableMonitors')}</span>
              </article>
              <article>
                <strong>{selectedMonitorIds.length}</strong>
                <span>{t('statusPageMonitors.selected')}</span>
              </article>
              <article>
                <strong>{selectedHealthyCount}</strong>
                <span>{t('statusPageMonitors.healthyInSelection')}</span>
              </article>
            </div>

            <div className={`status-page-monitors-selection-panel ${selectedMonitorIds.length === 0 ? 'empty' : ''}`}>
              <div className="status-page-monitors-selection-copy">
                <h3>
                  {selectedMonitorIds.length === 0
                    ? t('statusPageMonitors.empty.selectionTitle')
                    : t('statusPageMonitors.selectionCount', { count: selectedMonitorIds.length })}
                </h3>
                <p>
                  {selectedMonitorIds.length === 0
                    ? t('statusPageMonitors.empty.selectionCopy')
                    : t('statusPageMonitors.selectionCopy')}
                </p>
              </div>

              {selectedPreview.length > 0 ? (
                <div className="status-page-monitors-selection-tags" aria-label={t('statusPageMonitors.selectedMonitorsAria')}>
                  {selectedPreview.map((monitor) => (
                    <span key={monitor.id}>{monitor.name}</span>
                  ))}
                  {selectedOverflowCount > 0 ? <span>{t('statusPageMonitors.more', { count: selectedOverflowCount })}</span> : null}
                </div>
              ) : null}
            </div>

            {monitors.length === 0 ? (
              <div className="status-page-monitors-empty-state">
                <h3>{t('statusPageMonitors.empty.noMonitorsTitle')}</h3>
                <p>{t('statusPageMonitors.empty.noMonitorsCopy')}</p>
                {onCreateMonitor ? (
                  <button type="button" onClick={onCreateMonitor}>
                    {t('statusPageMonitors.empty.createMonitor')}
                  </button>
                ) : null}
              </div>
            ) : visibleMonitors.length === 0 ? (
              <div className="status-page-monitors-empty-state">
                <h3>{t('statusPageMonitors.empty.noSearchTitle')}</h3>
                <p>{t('statusPageMonitors.empty.noSearchCopy')}</p>
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
                              {monitorStateLabels[monitor.state]}
                            </span>
                          </div>

                          <p>{monitor.url || t('statusPageMonitors.noUrlConfigured')}</p>

                          <div className="status-page-monitor-meta">
                            <span className="status-page-monitor-badge protocol">{monitor.protocol}</span>
                            {monitor.tags.map((tag) => (
                              <span className="status-page-monitor-badge" key={`${monitor.id}-${tag}`}>
                                {tag}
                              </span>
                            ))}
                            <span className="status-page-monitor-uptime">{t('statusPageMonitors.uptime', { value: monitor.uptime })}</span>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`status-page-monitor-toggle ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleMonitorSelection(monitor.id)}
                      >
                        {isSelected ? t('statusPageMonitors.added') : t('statusPageMonitors.add')}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="status-page-monitors-sidebar" aria-label={t('statusPageMonitors.sidebar.steps')}>
          <section className="status-page-monitors-sidebar-card">
            <p className="status-page-monitors-sidebar-label">{t('statusPageMonitors.sidebar.setupFlow')}</p>

            <div className="status-page-monitors-step active">
              <span className="status-page-monitors-step-index">1</span>
              <div className="status-page-monitors-step-copy">
                <strong>{t('statusPageMonitors.sidebar.monitors')}</strong>
                <small>{t('statusPageMonitors.sidebar.chooseVisible')}</small>
              </div>
            </div>

            <button type="button" className="status-page-monitors-step link" onClick={onOpenGlobalSettings}>
              <span className="status-page-monitors-step-index">2</span>
              <div className="status-page-monitors-step-copy">
                <strong>{t('statusPageMonitors.sidebar.globalSettings')}</strong>
                <small>{t('statusPageMonitors.sidebar.brandingAccessFeatures')}</small>
              </div>
              <ChevronRight size={15} />
            </button>
          </section>

          <section className="status-page-monitors-sidebar-card">
            <p className="status-page-monitors-sidebar-label">{t('statusPageMonitors.sidebar.summary')}</p>
            <h3>{pageName}</h3>
            <p className="status-page-monitors-sidebar-summary">
              {selectedMonitorIds.length > 0
                ? t('statusPageMonitors.sidebar.selectedForPage', { count: selectedMonitorIds.length })
                : t('statusPageMonitors.sidebar.noneSelectedYet')}
            </p>

            {selectedPreview.length > 0 ? (
              <div className="status-page-monitors-sidebar-selected">
                {selectedPreview.map((monitor) => (
                  <span key={`sidebar-${monitor.id}`}>{monitor.name}</span>
                ))}
                {selectedOverflowCount > 0 ? <span>{t('statusPageMonitors.more', { count: selectedOverflowCount })}</span> : null}
              </div>
            ) : null}

            <button type="button" className="status-page-monitors-primary-action" onClick={onOpenGlobalSettings}>
              {t('statusPageMonitors.sidebar.nextStep')}
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default StatusPageMonitorsPage;
