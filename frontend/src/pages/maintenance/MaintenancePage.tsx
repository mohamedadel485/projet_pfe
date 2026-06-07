import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Check, ChevronDown, Pause, RotateCcw, Search, Tag, Trash2, X } from 'lucide-react';
import { CiSliderHorizontal } from 'react-icons/ci';
import {
  createMaintenance,
  deleteMaintenance,
  fetchMaintenances,
  fetchMonitors,
  isApiError,
  pauseMaintenance,
  resumeMaintenance,
  startMaintenance,
  type BackendMaintenance,
  type BackendMaintenanceStatus,
  type BackendMonitor,
} from '../../lib/api';
import { useAppLanguage } from '../../lib/language';
import './maintenance-page.css';

interface MaintenancePageProps {
  authToken?: string | null;
  onCreateMonitor?: () => void;
  onOpenMaintenanceWindows?: () => void;
  onBackToMaintenanceOverview?: () => void;
  showWindowsOnly?: boolean;
}

type SortOption = 'newest' | 'oldest' | 'status';
type BulkAction = 'start' | 'pause' | 'resume' | 'delete';
type RepeatType = 'none' | 'daily' | 'weekly';
type MaintenanceConfirmationAction = Exclude<BulkAction, 'start'>;

interface Row {
  id: string;
  name: string;
  reason: string;
  status: BackendMaintenanceStatus;
  monitorId: string | null;
  monitorName: string;
  monitorUrl: string;
  startAt: string;
  endAt: string;
}

interface MaintenanceActionConfirmationState {
  action: MaintenanceConfirmationAction;
  ids: string[];
}

const maintenanceStatusDefaults: Record<BackendMaintenanceStatus, string> = {
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const maintenanceSortDefaults: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  status: 'Status',
};

const statusRank: Record<BackendMaintenanceStatus, number> = {
  ongoing: 0,
  paused: 1,
  scheduled: 2,
  completed: 3,
  cancelled: 4,
};

const statusFilterOptions: Array<'all' | BackendMaintenanceStatus> = [
  'all',
  'scheduled',
  'ongoing',
  'paused',
  'completed',
  'cancelled',
];

const sortOptions: SortOption[] = ['newest', 'oldest', 'status'];
const bulkActionOptions: MaintenanceConfirmationAction[] = ['pause', 'resume', 'delete'];
const maintenanceBulkActionDefaults: Record<BulkAction, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  delete: 'Delete',
};
const maintenanceActionConfirmationDefaults: Record<
  MaintenanceConfirmationAction,
  {
    title: string;
    description: (count: number) => string;
    badgeLabel: string;
    summaryNote: string;
    confirmLabel: string;
    accentClass: 'pause' | 'resume' | 'delete';
    icon: JSX.Element;
  }
> = {
  pause: {
    title: 'Pause maintenance?',
    description: (count) =>
      `This will pause ${count} selected maintenance window(s).`,
    badgeLabel: 'Temporary action',
    summaryNote: 'Checks will stop until you resume these windows.',
    confirmLabel: 'Pause now',
    accentClass: 'pause',
    icon: <Pause size={18} />,
  },
  resume: {
    title: 'Resume maintenance?',
    description: (count) =>
      `This will resume ${count} selected maintenance window(s).`,
    badgeLabel: 'Operational change',
    summaryNote: 'Monitoring will continue from the next scheduled cycle.',
    confirmLabel: 'Resume now',
    accentClass: 'resume',
    icon: <RotateCcw size={18} />,
  },
  delete: {
    title: 'Delete maintenance?',
    description: (count) =>
      `This will permanently delete ${count} selected maintenance window(s).`,
    badgeLabel: 'Permanent action',
    summaryNote: 'Deleted windows cannot be recovered later.',
    confirmLabel: 'Delete now',
    accentClass: 'delete',
    icon: <Trash2 size={18} />,
  },
};
const maintenanceRepeatDefaults: Array<{ value: RepeatType; label: string }> = [
  { value: 'none', label: 'Do not repeat' },
  { value: 'daily', label: 'Repeat daily (14 days)' },
  { value: 'weekly', label: 'Repeat weekly (6 weeks)' },
];

const maintenanceWeekdayDefaults = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const mapRow = (maintenance: BackendMaintenance): Row => ({
  id: maintenance._id,
  name: maintenance.name || 'Maintenance',
  reason: maintenance.reason || '',
  status: maintenance.status,
  monitorId: maintenance.monitor?._id ?? null,
  monitorName: maintenance.monitor?.name ?? 'Unknown monitor',
  monitorUrl: maintenance.monitor?.url ?? '',
  startAt: maintenance.startAt,
  endAt: maintenance.endAt,
});

const formatDateTime = (value: string, locale = 'en-US'): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date
    .toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\s(AM|PM)$/i, '$1');
};

const formatDuration = (startAt: string, endAt: string): string => {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '-';

  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

const toDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toTimeInput = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const combineDateAndTime = (dateInput: string, timeInput: string): Date | null => {
  const parsedDate = new Date(`${dateInput}T${timeInput}:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
};

const getRepeatStartDates = (
  repeatType: RepeatType,
  startDate: Date,
  weeklyDays: number[]
): Date[] => {
  if (repeatType === 'none') {
    return [startDate];
  }

  if (repeatType === 'daily') {
    return Array.from({ length: 14 }, (_, index) => new Date(startDate.getTime() + index * 86_400_000));
  }

  const selectedDays = new Set(weeklyDays);
  if (selectedDays.size === 0) {
    return [];
  }

  const nextDates: Date[] = [];
  for (let dayOffset = 0; dayOffset < 42; dayOffset += 1) {
    const candidate = new Date(startDate.getTime() + dayOffset * 86_400_000);
    if (selectedDays.has(candidate.getDay())) {
      nextDates.push(candidate);
    }
  }
  return nextDates;
};

const describeLoadError = (error: unknown, fallback: string): string => {
  if (isApiError(error)) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

function MaintenancePage({
  authToken,
  onCreateMonitor,
  onOpenMaintenanceWindows,
  onBackToMaintenanceOverview,
  showWindowsOnly = false,
}: MaintenancePageProps) {
  const requestToken = authToken ?? undefined;
  const { language, t } = useAppLanguage();
  const locale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-TN' : 'en-US';
  const statusLabel = language === 'fr'
    ? {
        scheduled: t('maintenance.status.scheduled'),
        ongoing: t('maintenance.status.ongoing'),
        paused: t('maintenance.status.paused'),
        completed: t('maintenance.status.completed'),
        cancelled: t('maintenance.status.cancelled'),
      }
    : maintenanceStatusDefaults;
  const sortLabel = language === 'fr'
    ? {
        newest: t('maintenance.sort.newest'),
        oldest: t('maintenance.sort.oldest'),
        status: t('maintenance.sort.status'),
      }
    : maintenanceSortDefaults;
  const bulkActionLabel = language === 'fr'
    ? {
        start: t('dashboard.actions.start'),
        pause: t('dashboard.actions.pause'),
        resume: t('dashboard.actions.resume'),
        delete: t('dashboard.actions.delete'),
      }
    : maintenanceBulkActionDefaults;
  const repeatOptions = language === 'fr'
    ? [
        { value: 'none' as RepeatType, label: 'Ne pas répéter' },
        { value: 'daily' as RepeatType, label: 'Répéter chaque jour (14 jours)' },
        { value: 'weekly' as RepeatType, label: 'Répéter chaque semaine (6 semaines)' },
      ]
    : maintenanceRepeatDefaults;
  const weekdayLabels = language === 'fr'
    ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    : maintenanceWeekdayDefaults;
  const maintenanceActionConfirmationContent = language === 'fr'
    ? {
        pause: {
          title: t('maintenance.confirm.pause.title'),
          description: (count: number) => t('maintenance.confirm.pause.description', { count }),
          badgeLabel: t('maintenance.confirm.pause.badge'),
          summaryNote: t('maintenance.confirm.pause.note'),
          confirmLabel: t('maintenance.confirm.pause.confirm'),
          accentClass: 'pause' as const,
          icon: <Pause size={18} />,
        },
        resume: {
          title: t('maintenance.confirm.resume.title'),
          description: (count: number) => t('maintenance.confirm.resume.description', { count }),
          badgeLabel: t('maintenance.confirm.resume.badge'),
          summaryNote: t('maintenance.confirm.resume.note'),
          confirmLabel: t('maintenance.confirm.resume.confirm'),
          accentClass: 'resume' as const,
          icon: <RotateCcw size={18} />,
        },
        delete: {
          title: t('maintenance.confirm.delete.title'),
          description: (count: number) => t('maintenance.confirm.delete.description', { count }),
          badgeLabel: t('maintenance.confirm.delete.badge'),
          summaryNote: t('maintenance.confirm.delete.note'),
          confirmLabel: t('maintenance.confirm.delete.confirm'),
          accentClass: 'delete' as const,
          icon: <Trash2 size={18} />,
        },
      }
    : maintenanceActionConfirmationDefaults;
  const [rows, setRows] = useState<Row[]>([]);
  const [monitors, setMonitors] = useState<BackendMonitor[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState<'all' | BackendMaintenanceStatus>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [isBulkActionsMenuOpen, setIsBulkActionsMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedMonitorId, setSelectedMonitorId] = useState('');
  const [windowName, setWindowName] = useState('');
  const [windowReason, setWindowReason] = useState('');
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const hasSelectedMaintenance = selectedIds.length > 0;
  const [maintenanceActionConfirmation, setMaintenanceActionConfirmation] =
    useState<MaintenanceActionConfirmationState | null>(null);
  const selectedMaintenanceRows = useMemo(() => {
    if (!maintenanceActionConfirmation) {
      return [];
    }

    const selectedIdsSet = new Set(maintenanceActionConfirmation.ids);
    return rows.filter((row) => selectedIdsSet.has(row.id));
  }, [maintenanceActionConfirmation, rows]);

  const bulkActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [maintenanceResult, monitorResult] = await Promise.allSettled([
        fetchMaintenances(requestToken),
        fetchMonitors(requestToken),
      ]);
      const nextRows = maintenanceResult.status === 'fulfilled'
        ? maintenanceResult.value.maintenances.map(mapRow)
        : [];
      const nextMonitors = monitorResult.status === 'fulfilled'
        ? monitorResult.value.monitors
        : [];

      setRows(nextRows);
      setMonitors(nextMonitors);
      setSelectedIds((previous) => previous.filter((id) => nextRows.some((row) => row.id === id)));

      if (nextMonitors.length > 0) {
        setSelectedMonitorId((currentId) => {
          if (currentId && nextMonitors.some((monitor) => monitor._id === currentId)) {
            return currentId;
          }
          return nextMonitors[0]._id;
        });
      } else {
        setSelectedMonitorId('');
      }

      const maintenanceError =
        maintenanceResult.status === 'rejected'
          ? describeLoadError(maintenanceResult.reason, 'Unable to load maintenance.')
          : null;
      const monitorError =
        monitorResult.status === 'rejected'
          ? describeLoadError(monitorResult.reason, 'Unable to load monitors.')
          : null;
      setErrorMessage(maintenanceError ?? monitorError);
    } catch (error) {
      setErrorMessage(describeLoadError(error, 'Unable to load maintenance.'));
      setRows([]);
      setMonitors([]);
    } finally {
      setIsLoading(false);
    }
  }, [requestToken]);

  useEffect(() => {
    const now = new Date(Date.now() + 10 * 60_000);
    setStartDate(toDateInput(now));
    setStartTime(toTimeInput(now));
    setWeeklyDays([now.getDay()]);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!(bulkActionsMenuRef.current?.contains(target) ?? false)) {
        setIsBulkActionsMenuOpen(false);
      }
      if (!(statusMenuRef.current?.contains(target) ?? false)) {
        setIsStatusMenuOpen(false);
      }
      if (!(sortMenuRef.current?.contains(target) ?? false)) {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsBulkActionsMenuOpen(false);
      setIsStatusMenuOpen(false);
      setIsSortMenuOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const visibleRows = useMemo(() => {
    const activeSet = new Set<BackendMaintenanceStatus>(['scheduled', 'ongoing', 'paused']);
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (activeOnly && !activeSet.has(row.status)) return false;
      if (normalizedSearch === '') return true;
      return [row.name, row.reason, row.monitorName, row.monitorUrl].join(' ').toLowerCase().includes(normalizedSearch);
    });

    filtered.sort((a, b) => {
      if (sortOption === 'status') {
        const statusDiff = statusRank[a.status] - statusRank[b.status];
        if (statusDiff !== 0) return statusDiff;
      }
      const timeDiff = new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
      return sortOption === 'oldest' ? -timeDiff : timeDiff;
    });
    return filtered;
  }, [activeOnly, rows, searchQuery, sortOption, statusFilter]);

  const ongoing = rows.filter((row) => row.status === 'ongoing').length;
  const scheduled = rows.filter((row) => row.status === 'scheduled').length;
  const paused = rows.filter((row) => row.status === 'paused').length;
  const completed = rows.filter((row) => row.status === 'completed').length;
  const nextWindow = [...rows]
    .filter((row) => row.status === 'scheduled')
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] ?? null;

  const selectedStatusLabel = statusFilter === 'all' ? t('maintenance.filter.allStatus') : statusLabel[statusFilter];

  const runAction = async (action: BulkAction, ids: string[]) => {
    if (ids.length === 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const run = (id: string) =>
      action === 'start'
        ? startMaintenance(id, requestToken)
          : action === 'pause'
            ? pauseMaintenance(id, requestToken)
            : action === 'resume'
              ? resumeMaintenance(id, requestToken)
            : deleteMaintenance(id, requestToken);

    const results = await Promise.allSettled(ids.map((id) => run(id)));
    const failed = results.filter((result) => result.status === 'rejected');
    const successCount = results.length - failed.length;

    if (failed.length > 0) {
      const firstReason = failed[0].reason;
      if (isApiError(firstReason)) setErrorMessage(firstReason.message || t('maintenance.errors.actionFailed'));
      else if (firstReason instanceof Error) setErrorMessage(firstReason.message);
      else setErrorMessage(t('maintenance.errors.actionFailed'));
    }

    if (successCount > 0) {
      setSuccessMessage(t('maintenance.success.updated', { count: successCount }));
    }

    setSelectedIds([]);
    await loadData();
  };

  const promptMaintenanceAction = (
    action: MaintenanceConfirmationAction,
    ids: string[],
  ) => {
    if (ids.length === 0) return;
    setMaintenanceActionConfirmation({ action, ids: [...ids] });
  };

  const confirmMaintenanceAction = async () => {
    if (!maintenanceActionConfirmation) return;

    const { action, ids } = maintenanceActionConfirmation;
    setMaintenanceActionConfirmation(null);
    await runAction(action, ids);
  };

  const handleToggleWeeklyDay = (day: number) => {
    setWeeklyDays((currentDays) =>
      currentDays.includes(day) ? currentDays.filter((value) => value !== day) : [...currentDays, day].sort((a, b) => a - b)
    );
  };

  const handleCreateMaintenance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedMonitorId) {
      setErrorMessage(t('maintenance.errors.selectMonitor'));
      onCreateMonitor?.();
      return;
    }

    const baseStartDate = combineDateAndTime(startDate, startTime);
    if (!baseStartDate) {
      setErrorMessage(t('maintenance.errors.invalidDateTime'));
      return;
    }

    const parsedDuration = Number(durationMinutes);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 5 || parsedDuration > 1440) {
      setErrorMessage(t('maintenance.errors.durationRange'));
      return;
    }

    const startDates = getRepeatStartDates(repeatType, baseStartDate, weeklyDays);
    if (startDates.length === 0) {
      setErrorMessage(t('maintenance.errors.weeklyDaySelection'));
      return;
    }

    setIsCreating(true);

    const createRequests = startDates.map((start) => {
      const end = new Date(start.getTime() + parsedDuration * 60_000);
      return createMaintenance({
        monitorId: selectedMonitorId,
        name: windowName.trim() === '' ? undefined : windowName.trim(),
        reason: windowReason.trim(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      }, requestToken);
    });

    const results = await Promise.allSettled(createRequests);
    const failed = results.filter((result) => result.status === 'rejected');
    const successCount = results.length - failed.length;

    if (failed.length > 0) {
      const firstReason = failed[0].reason;
      if (isApiError(firstReason)) setErrorMessage(firstReason.message || t('maintenance.errors.createFailed'));
      else if (firstReason instanceof Error) setErrorMessage(firstReason.message);
      else setErrorMessage(t('maintenance.errors.createFailed'));
    }

    if (successCount > 0) {
      setSuccessMessage(t('maintenance.success.created', { count: successCount }));
      setWindowName('');
      setWindowReason('');
    }

    await loadData();
    setIsCreating(false);
  };

  const monitorCount = new Set(rows.map((row) => row.monitorId).filter((id): id is string => id !== null)).size;

  return (
    <>
      <div className="panel-main maintenance-main-panel">
        <header className="workspace-top">
          <h1>{t('maintenance.title')}</h1>
          <div className="primary-button-wrap maintenance-header-actions">
            {showWindowsOnly ? (
              <button className="chip-button" type="button" onClick={onBackToMaintenanceOverview}>
                {t('maintenance.backToMaintenance')}
              </button>
            ) : (
              <>
                <button className="chip-button" type="button" onClick={onOpenMaintenanceWindows}>
                  {t('maintenance.showMaintenances')}
                </button>
              </>
            )}
          </div>
        </header>

        {errorMessage ? <p className="monitor-table-feedback error">{errorMessage}</p> : null}
        {successMessage ? <p className="monitor-table-feedback maintenance-success">{successMessage}</p> : null}

        {!showWindowsOnly ? (
          <section className="maintenance-hero">
          <div className="maintenance-hero-copy">
            <p className="maintenance-hero-eyebrow">{t('maintenance.hero.kicker')}</p>
            <h2>
              {t('maintenance.hero.titleLead')} <span>{t('maintenance.hero.titleHighlight')}</span>.
            </h2>
            <p>{t('maintenance.hero.description')}</p>
            <ul>
              <li>{t('maintenance.hero.bulletOne')}</li>
              <li>{t('maintenance.hero.bulletTwo')}</li>
              <li>{t('maintenance.hero.bulletThree')}</li>
            </ul>
            <p className="maintenance-hero-note">{t('maintenance.hero.note')}</p>
          </div>

          <form id="maintenance-create-form" className="maintenance-create-card" onSubmit={handleCreateMaintenance}>
            <h3>{t('maintenance.create.title')}</h3>

            <label>
              {t('maintenance.create.monitor')}
              <select
                value={selectedMonitorId}
                onChange={(event) => setSelectedMonitorId(event.target.value)}
                disabled={monitors.length === 0 || isCreating}
                required
              >
                {monitors.length === 0 ? (
                  <option value="">{t('maintenance.create.noMonitor')}</option>
                ) : (
                  monitors.map((monitor) => (
                    <option key={monitor._id} value={monitor._id}>
                      {monitor.name} - {monitor.url}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label>
              {t('maintenance.create.repeat')}
              <select value={repeatType} onChange={(event) => setRepeatType(event.target.value as RepeatType)} disabled={isCreating}>
                {repeatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {repeatType === 'weekly' ? (
              <div className="maintenance-weekdays">
                <p>{t('maintenance.create.weekdays')}</p>
                <div className="maintenance-weekday-grid">
                  {weekdayLabels.map((label, day) => {
                    const selected = weeklyDays.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        className={selected ? 'active' : ''}
                        onClick={() => handleToggleWeeklyDay(day)}
                        disabled={isCreating}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="maintenance-create-grid">
              <label>
                {t('maintenance.create.startDate')}
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={isCreating} required />
              </label>
              <label>
                {t('maintenance.create.startTime')}
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} disabled={isCreating} required />
              </label>
            </div>

            <label>
              {t('maintenance.create.duration')}
              <input
                type="number"
                min={5}
                max={1440}
                step={5}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                disabled={isCreating}
                required
              />
            </label>

            <label>
              {t('maintenance.create.windowTitle')}
              <input
                type="text"
                maxLength={120}
                placeholder={t('maintenance.create.windowTitlePlaceholder')}
                value={windowName}
                onChange={(event) => setWindowName(event.target.value)}
                disabled={isCreating}
              />
            </label>

            <label>
              {t('maintenance.create.reason')}
              <textarea
                rows={3}
                maxLength={500}
                placeholder={t('maintenance.create.reasonPlaceholder')}
                value={windowReason}
                onChange={(event) => setWindowReason(event.target.value)}
                disabled={isCreating}
              />
            </label>

            <div className="maintenance-create-actions">
              <button
                className="chip-button"
                type="button"
                onClick={() => {
                  setWindowName('');
                  setWindowReason('');
                  setRepeatType('none');
                }}
                disabled={isCreating}
              >
                {t('maintenance.create.reset')}
              </button>
              <button
                className="primary-button primary-button-main"
                type="submit"
                disabled={monitors.length === 0 || isCreating}
              >
                <span>{isCreating ? t('maintenance.create.creating') : t('maintenance.create.submit')}</span>
              </button>
            </div>
          </form>
          </section>
        ) : null}

        {showWindowsOnly ? (
          <>
            <div className="filter-bar maintenance-filter-bar">
          <div className="chip-row maintenance-chip-row">
            <button
              type="button"
              className="chip-button chip-counter"
              onClick={() =>
                setSelectedIds(
                  selectedIds.length === visibleRows.length ? [] : visibleRows.map((row) => row.id)
                )
              }
            >
              <span className="counter-dot" aria-hidden="true" />
              {selectedIds.length}/{visibleRows.length}
            </button>
            <div className="bulk-actions-wrap" ref={bulkActionsMenuRef}>
              <button
                className={`chip-button bulk-actions-trigger ${isBulkActionsMenuOpen ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  setIsBulkActionsMenuOpen((prev) => !prev);
                  setIsStatusMenuOpen(false);
                  setIsSortMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={isBulkActionsMenuOpen}
              >
                {t('dashboard.bulkActions')}
                <ChevronDown size={16} />
              </button>

              {isBulkActionsMenuOpen ? (
                <div className="bulk-actions-menu" role="menu">
                  {bulkActionOptions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      role="menuitem"
                      className={action === 'delete' ? 'delete' : ''}
                      disabled={!hasSelectedMaintenance}
                      onClick={() => {
                        promptMaintenanceAction(action, selectedIds);
                        setIsBulkActionsMenuOpen(false);
                      }}
                    >
                      <span className="bulk-actions-menu-icon" aria-hidden="true">
                        {action === 'pause' ? (
                          <Pause size={14} />
                        ) : action === 'resume' ? (
                          <RotateCcw size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </span>
                      <span>{bulkActionLabel[action]}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="monitor-tag-wrap" ref={statusMenuRef}>
              <button
                className={`chip-button monitor-tag-trigger ${isStatusMenuOpen || statusFilter !== 'all' ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  setIsStatusMenuOpen((prev) => !prev);
                  setIsBulkActionsMenuOpen(false);
                  setIsSortMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={isStatusMenuOpen}
              >
                <Tag size={20} />
                <span className="monitor-tag-label">{selectedStatusLabel}</span>
                <ChevronDown size={16} />
              </button>

              {isStatusMenuOpen ? (
                <div className="monitor-tag-menu" role="menu">
                  {statusFilterOptions.map((option) => {
                    const selected = statusFilter === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className={selected ? 'selected' : ''}
                        onClick={() => {
                          setStatusFilter(option);
                          setIsStatusMenuOpen(false);
                        }}
                      >
                        <span>{option === 'all' ? t('maintenance.filter.allStatus') : statusLabel[option]}</span>
                        {selected ? <Check size={15} aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="search-row maintenance-search-row">
            <label className="search-box maintenance-search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder={t('maintenance.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="monitor-sort-wrap" ref={sortMenuRef}>
              <button
                className={`chip-button monitor-sort-trigger ${isSortMenuOpen ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  setIsSortMenuOpen((prev) => !prev);
                  setIsBulkActionsMenuOpen(false);
                  setIsStatusMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={isSortMenuOpen}
              >
                <ArrowUpDown size={20} />
                <span className="monitor-sort-label">{sortLabel[sortOption]}</span>
                <ChevronDown size={16} />
              </button>

              {isSortMenuOpen ? (
                <div className="monitor-sort-menu" role="menu">
                  {sortOptions.map((option) => {
                    const selected = sortOption === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className={selected ? 'selected' : ''}
                        onClick={() => {
                          setSortOption(option);
                          setIsSortMenuOpen(false);
                        }}
                      >
                        <span>{sortLabel[option]}</span>
                        {selected ? <Check size={15} aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              className={`chip-button monitor-filter-trigger ${activeOnly ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveOnly((prev) => !prev)}
            >
              <CiSliderHorizontal size={20} />
              {activeOnly ? t('maintenance.filter.activeOnly') : t('dashboard.filter.button')}
            </button>
          </div>
        </div>

          <div className="table-card">
          <div className="table-head">
            <span>{t('maintenance.table.title')}</span>
            <div className="action-row">
              <button
                className="action-button"
                type="button"
                onClick={() => {
                  promptMaintenanceAction('pause', selectedIds);
                }}
                disabled={!hasSelectedMaintenance}
              >
                <span className="action-icon-circle" aria-hidden="true">
                  <Pause size={11} />
                </span>
                <span>{t('dashboard.actions.pause')}</span>
              </button>
              <button
                className="action-button"
                type="button"
                onClick={() => {
                  promptMaintenanceAction('delete', selectedIds);
                }}
                disabled={!hasSelectedMaintenance}
              >
                <span className="action-icon-circle" aria-hidden="true">
                  <Trash2 size={11} />
                </span>
                <span>{t('dashboard.actions.delete')}</span>
              </button>
              <button
                className="action-button"
                type="button"
                onClick={() => {
                  promptMaintenanceAction('resume', selectedIds);
                }}
                disabled={!hasSelectedMaintenance}
              >
                <span className="action-icon-circle" aria-hidden="true">
                  <RotateCcw size={11} />
                </span>
                <span>{t('dashboard.actions.resume')}</span>
              </button>
            </div>
          </div>

          <div className="monitor-table">
            {isLoading ? (
              <p className="monitor-table-feedback">{t('maintenance.loading')}</p>
            ) : visibleRows.length === 0 ? (
              <p className="monitor-table-feedback">{t('maintenance.empty')}</p>
            ) : (
              visibleRows.map((row) => {
                const selected = selectedIds.includes(row.id);

                return (
                  <article key={row.id} className={`maintenance-window-row ${selected ? 'selected' : ''}`}>
                    <div className="maintenance-window-main">
                      <button
                        type="button"
                        className={`monitor-checkbox ${selected ? 'selected' : ''}`}
                        onClick={() =>
                          setSelectedIds((current) =>
                            current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]
                          )
                        }
                      />
                      <div className="maintenance-window-copy">
                        <strong>{row.name}</strong>
                        <p>{row.monitorName}</p>
                        <span>{row.reason || t('maintenance.noReasonProvided')}</span>
                      </div>
                    </div>

                    <div className={`maintenance-status-pill ${row.status}`}>
                      {statusLabel[row.status]}
                    </div>

                    <div className="maintenance-window-time">
                      <strong>{formatDateTime(row.startAt, locale)}</strong>
                      <span>{formatDateTime(row.endAt, locale)}</span>
                    </div>

                    <div className="maintenance-window-duration">{formatDuration(row.startAt, row.endAt)}</div>
                  </article>
                );
              })
            )}
          </div>
          </div>
          </>
        ) : null}
      </div>

      {showWindowsOnly ? (
        <aside className="status-panel">
        <section className="status-card">
          <h3>{t('dashboard.status.current')}</h3>
          <div className="status-grid maintenance-status-grid">
            <article>
              <strong>{ongoing}</strong>
              <span>{t('maintenance.status.ongoing')}</span>
            </article>
            <article>
              <strong>{scheduled}</strong>
              <span>{t('maintenance.status.scheduled')}</span>
            </article>
            <article>
              <strong>{paused}</strong>
              <span>{t('maintenance.status.paused')}</span>
            </article>
          </div>
          <p className="status-hint">{t('maintenance.statusHint', { count: ongoing + paused })}</p>
        </section>

        <section className="status-card">
          <h3>{t('maintenance.insights')}</h3>
          <div className="hours-row">
            <div className="hours-col">
              <p className="hours-uptime">{rows.length}</p>
              <span className="hours-label">{t('maintenance.totalMaintenance')}</span>
            </div>
            <div className="hours-col">
              <p className="hours-value">{completed}</p>
              <span className="hours-label">{t('maintenance.completed')}</span>
            </div>
          </div>
          <div className="hours-row">
            <div className="hours-col">
              <p className="hours-meta">{monitorCount}</p>
              <span className="hours-label">{t('maintenance.affectedMonitors')}</span>
            </div>
            <div className="hours-col">
              <p className="hours-value">{nextWindow ? '1' : '0'}</p>
              <span className="hours-label">{t('maintenance.upcoming')}</span>
            </div>
          </div>
          <p className="status-hint">
            {nextWindow
              ? `${t('maintenance.nextPrefix')} ${formatDateTime(nextWindow.startAt, locale)}`
              : t('maintenance.noUpcoming')}
          </p>
        </section>
        </aside>
      ) : null}

      {maintenanceActionConfirmation ? (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMaintenanceActionConfirmation(null);
            }
          }}
        >
          <div
            className={`modal-container maintenance-confirm-modal monitor-action-modal monitor-action-modal-${maintenanceActionConfirmation.action} monitor-action-${maintenanceActionConfirmation.action}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="maintenance-action-confirmation-title"
          >
            <div className="modal-header">
              <h2 id="maintenance-action-confirmation-title">
                <span
                  className="monitor-action-modal-title-icon"
                  aria-hidden="true"
                >
                  {
                    maintenanceActionConfirmationContent[
                      maintenanceActionConfirmation.action
                    ].icon
                  }
                </span>
                {
                  maintenanceActionConfirmationContent[
                    maintenanceActionConfirmation.action
                  ].title
                }
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                aria-label={t('maintenance.confirm.close')}
                onClick={() => setMaintenanceActionConfirmation(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body maintenance-confirm-body monitor-action-modal-body">
              <section className="monitor-action-modal-hero maintenance-confirm-hero">
                <div className="monitor-action-modal-badge-wrap">
                  <span
                    className={`monitor-action-modal-badge maintenance-confirm-badge maintenance-confirm-badge-${maintenanceActionConfirmationContent[maintenanceActionConfirmation.action].accentClass}`}
                  >
                    {
                      maintenanceActionConfirmationContent[
                        maintenanceActionConfirmation.action
                      ].badgeLabel
                    }
                  </span>
                  <span className="monitor-action-modal-badge soft">
                    {t('maintenance.confirm.selectionCount', { count: maintenanceActionConfirmation.ids.length })}
                  </span>
                </div>

                <p className="monitor-action-modal-text">
                  {
                    maintenanceActionConfirmationContent[
                      maintenanceActionConfirmation.action
                    ].description(maintenanceActionConfirmation.ids.length)
                  }
                </p>
                <p className="maintenance-confirm-note">
                  {
                    maintenanceActionConfirmationContent[
                      maintenanceActionConfirmation.action
                    ].summaryNote
                  }
                </p>
              </section>

              <section className="monitor-action-modal-selection maintenance-confirm-selection">
                <div className="monitor-action-modal-selection-header">
                  <Tag size={14} />
                  <span>{t('maintenance.confirm.selectedWindows')}</span>
                </div>
                <div className="monitor-action-modal-chips">
                  {selectedMaintenanceRows.slice(0, 3).map((row) => (
                    <span
                      key={row.id}
                      className="monitor-action-modal-chip"
                      title={`${row.name} on ${row.monitorName}`}
                    >
                      {row.name}
                    </span>
                  ))}
                  {selectedMaintenanceRows.length > 3 ? (
                    <span className="monitor-action-modal-chip more">
                      {t('maintenance.confirm.more', { count: selectedMaintenanceRows.length - 3 })}
                    </span>
                  ) : null}
                </div>
              </section>

              <div className="monitor-action-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setMaintenanceActionConfirmation(null)}
                >
                  {t('maintenance.confirm.cancel')}
                </button>
                <button
                  type="button"
                  className={`primary-button monitor-action-confirm-button ${maintenanceActionConfirmation.action}`}
                  onClick={() => {
                    void confirmMaintenanceAction();
                  }}
                >
                  {
                    maintenanceActionConfirmationContent[
                      maintenanceActionConfirmation.action
                    ].confirmLabel
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MaintenancePage;
