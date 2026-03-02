import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Check, ChevronDown, Pause, Play, RotateCcw, Search, Tag, Trash2, Wrench } from 'lucide-react';
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
import './maintenance-page.css';

interface MaintenancePageProps {
  onCreateMonitor?: () => void;
  onOpenMaintenanceWindows?: () => void;
  onBackToMaintenanceOverview?: () => void;
  showWindowsOnly?: boolean;
}

type SortOption = 'newest' | 'oldest' | 'status';
type BulkAction = 'start' | 'pause' | 'resume' | 'delete';
type RepeatType = 'none' | 'daily' | 'weekly';

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

const statusLabel: Record<BackendMaintenanceStatus, string> = {
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const sortLabel: Record<SortOption, string> = {
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
const bulkActionOptions: BulkAction[] = ['start', 'pause', 'resume', 'delete'];
const bulkActionLabel: Record<BulkAction, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  delete: 'Delete',
};
const repeatOptions: Array<{ value: RepeatType; label: string }> = [
  { value: 'none', label: 'Do not repeat' },
  { value: 'daily', label: 'Repeat daily (14 days)' },
  { value: 'weekly', label: 'Repeat weekly (6 weeks)' },
];

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date
    .toLocaleString('en-US', {
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

function MaintenancePage({
  onCreateMonitor,
  onOpenMaintenanceWindows,
  onBackToMaintenanceOverview,
  showWindowsOnly = false,
}: MaintenancePageProps) {
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

  const bulkActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [maintenanceData, monitorData] = await Promise.all([fetchMaintenances(), fetchMonitors()]);
      const mapped = maintenanceData.maintenances.map(mapRow);
      setRows(mapped);
      setMonitors(monitorData.monitors);
      setSelectedIds((previous) => previous.filter((id) => mapped.some((row) => row.id === id)));

      if (monitorData.monitors.length > 0) {
        setSelectedMonitorId((currentId) => {
          if (currentId && monitorData.monitors.some((monitor) => monitor._id === currentId)) {
            return currentId;
          }
          return monitorData.monitors[0]._id;
        });
      } else {
        setSelectedMonitorId('');
      }
    } catch (error) {
      if (isApiError(error)) {
        const normalizedMessage = (error.message || '').toLowerCase();
        if (error.status === 404 && normalizedMessage.includes('route non trouvee')) {
          setErrorMessage('Maintenance endpoint not found on current backend. Restart project backend.');
        } else {
          setErrorMessage(error.message || 'Unable to load maintenance.');
        }
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to load maintenance.');
      }
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date(Date.now() + 10 * 60_000);
    setStartDate(toDateInput(now));
    setStartTime(toTimeInput(now));
    setWeeklyDays([now.getDay()]);
    void loadData();
  }, []);

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

  const selectedStatusLabel = statusFilter === 'all' ? 'All status' : statusLabel[statusFilter];

  const runAction = async (action: BulkAction, ids: string[]) => {
    if (ids.length === 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const run = (id: string) =>
      action === 'start'
        ? startMaintenance(id)
        : action === 'pause'
          ? pauseMaintenance(id)
          : action === 'resume'
            ? resumeMaintenance(id)
            : deleteMaintenance(id);

    const results = await Promise.allSettled(ids.map((id) => run(id)));
    const failed = results.filter((result) => result.status === 'rejected');
    const successCount = results.length - failed.length;

    if (failed.length > 0) {
      const firstReason = failed[0].reason;
      if (isApiError(firstReason)) setErrorMessage(firstReason.message || 'Maintenance action failed.');
      else if (firstReason instanceof Error) setErrorMessage(firstReason.message);
      else setErrorMessage('Maintenance action failed.');
    }

    if (successCount > 0) {
      setSuccessMessage(`${successCount} maintenance updated.`);
    }

    setSelectedIds([]);
    await loadData();
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
      setErrorMessage('Select a monitor first.');
      onCreateMonitor?.();
      return;
    }

    const baseStartDate = combineDateAndTime(startDate, startTime);
    if (!baseStartDate) {
      setErrorMessage('Invalid start date or start time.');
      return;
    }

    const parsedDuration = Number(durationMinutes);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 5 || parsedDuration > 1440) {
      setErrorMessage('Duration must be between 5 and 1440 minutes.');
      return;
    }

    const startDates = getRepeatStartDates(repeatType, baseStartDate, weeklyDays);
    if (startDates.length === 0) {
      setErrorMessage('Select at least one day for weekly repeat.');
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
      });
    });

    const results = await Promise.allSettled(createRequests);
    const failed = results.filter((result) => result.status === 'rejected');
    const successCount = results.length - failed.length;

    if (failed.length > 0) {
      const firstReason = failed[0].reason;
      if (isApiError(firstReason)) setErrorMessage(firstReason.message || 'Unable to create maintenance.');
      else if (firstReason instanceof Error) setErrorMessage(firstReason.message);
      else setErrorMessage('Unable to create maintenance.');
    }

    if (successCount > 0) {
      setSuccessMessage(`${successCount} maintenance created.`);
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
          <h1>Maintenance</h1>
          <div className="primary-button-wrap maintenance-header-actions">
            {showWindowsOnly ? (
              <button className="chip-button" type="button" onClick={onBackToMaintenanceOverview}>
                Back to maintenance
              </button>
            ) : (
              <>
                <button className="chip-button" type="button" onClick={onOpenMaintenanceWindows}>
                  Show maintenances
                </button>
                <button
                  className="primary-button primary-button-main"
                  type="button"
                  onClick={() => {
                    const formElement = document.getElementById('maintenance-create-form');
                    formElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <Wrench size={14} />
                  <span>Plan maintenance</span>
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
            <p className="maintenance-hero-eyebrow">Maintenance</p>
            <h2>
              Plan your <span>maintenance</span>.
            </h2>
            <p>
              Schedule regular or one-time maintenance and keep incidents clean while planned work is in progress.
              Alerts can stay silent during active maintenance periods.
            </p>
            <ul>
              <li>One-time maintenance</li>
              <li>Daily repeat (next 14 days)</li>
              <li>Weekly repeat (next 6 weeks)</li>
            </ul>
            <p className="maintenance-hero-note">All maintenance features are available in this version.</p>
          </div>

          <form id="maintenance-create-form" className="maintenance-create-card" onSubmit={handleCreateMaintenance}>
            <h3>Create maintenance</h3>

            <label>
              Monitor
              <select
                value={selectedMonitorId}
                onChange={(event) => setSelectedMonitorId(event.target.value)}
                disabled={monitors.length === 0 || isCreating}
                required
              >
                {monitors.length === 0 ? (
                  <option value="">No monitor available</option>
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
              Repeat
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
                <p>Days in week to repeat</p>
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
                Start date
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={isCreating} required />
              </label>
              <label>
                Start time
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} disabled={isCreating} required />
              </label>
            </div>

            <label>
              Duration (minutes)
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
              Title
              <input
                type="text"
                maxLength={120}
                placeholder="Optional title"
                value={windowName}
                onChange={(event) => setWindowName(event.target.value)}
                disabled={isCreating}
              />
            </label>

            <label>
              Reason
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Reason for maintenance"
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
                Reset
              </button>
              <button className="primary-button primary-button-main" type="submit" disabled={monitors.length === 0 || isCreating}>
                {isCreating ? 'Creating...' : 'Create maintenance'}
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
                Bulk actions
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
                      onClick={() => {
                        void runAction(action, selectedIds);
                        setIsBulkActionsMenuOpen(false);
                      }}
                    >
                      <span className="bulk-actions-menu-icon" aria-hidden="true">
                        {action === 'start' ? (
                          <Play size={14} />
                        ) : action === 'pause' ? (
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
                        <span>{option === 'all' ? 'All status' : statusLabel[option]}</span>
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
                placeholder="Search by name or url"
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
              {activeOnly ? 'Active only' : 'Filter'}
            </button>
          </div>
        </div>

          <div className="table-card">
          <div className="table-head">
            <span>Maintenance</span>
            <div className="action-row">
              <button className="action-button" type="button" onClick={() => { void runAction('start', selectedIds); }}>
                <span className="action-icon-circle" aria-hidden="true">
                  <Play size={11} />
                </span>
                <span>Start</span>
              </button>
              <button className="action-button" type="button" onClick={() => { void runAction('pause', selectedIds); }}>
                <span className="action-icon-circle" aria-hidden="true">
                  <Pause size={11} />
                </span>
                <span>Pause</span>
              </button>
              <button className="action-button" type="button" onClick={() => { void runAction('delete', selectedIds); }}>
                <span className="action-icon-circle" aria-hidden="true">
                  <Trash2 size={11} />
                </span>
                <span>Delete</span>
              </button>
              <button className="action-button" type="button" onClick={() => { void runAction('resume', selectedIds); }}>
                <span className="action-icon-circle" aria-hidden="true">
                  <RotateCcw size={11} />
                </span>
                <span>Resume</span>
              </button>
            </div>
          </div>

          <div className="monitor-table">
            {isLoading ? (
              <p className="monitor-table-feedback">Loading maintenance...</p>
            ) : visibleRows.length === 0 ? (
              <p className="monitor-table-feedback">No maintenance planned.</p>
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
                        <span>{row.reason || 'No reason provided'}</span>
                      </div>
                    </div>

                    <div className={`maintenance-status-pill ${row.status}`}>
                      {statusLabel[row.status]}
                    </div>

                    <div className="maintenance-window-time">
                      <strong>{formatDateTime(row.startAt)}</strong>
                      <span>{formatDateTime(row.endAt)}</span>
                    </div>

                    <div className="maintenance-window-duration">{formatDuration(row.startAt, row.endAt)}</div>

                    <div className="maintenance-window-actions">
                      <button type="button" onClick={() => { void runAction('start', [row.id]); }} aria-label="Start">
                        <Play size={12} />
                      </button>
                      <button type="button" onClick={() => { void runAction('pause', [row.id]); }} aria-label="Pause">
                        <Pause size={12} />
                      </button>
                      <button type="button" onClick={() => { void runAction('resume', [row.id]); }} aria-label="Resume">
                        <RotateCcw size={12} />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => { void runAction('delete', [row.id]); }}
                        aria-label="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
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
          <h3>Current status</h3>
          <div className="status-grid maintenance-status-grid">
            <article>
              <strong>{ongoing}</strong>
              <span>Ongoing</span>
            </article>
            <article>
              <strong>{scheduled}</strong>
              <span>Scheduled</span>
            </article>
            <article>
              <strong>{paused}</strong>
              <span>Paused</span>
            </article>
          </div>
          <p className="status-hint">{ongoing + paused} active maintenance</p>
        </section>

        <section className="status-card">
          <h3>Insights</h3>
          <div className="hours-row">
            <div className="hours-col">
              <p className="hours-uptime">{rows.length}</p>
              <span className="hours-label">Total maintenance</span>
            </div>
            <div className="hours-col">
              <p className="hours-value">{completed}</p>
              <span className="hours-label">Completed</span>
            </div>
          </div>
          <div className="hours-row">
            <div className="hours-col">
              <p className="hours-meta">{monitorCount}</p>
              <span className="hours-label">Affected monitors</span>
            </div>
            <div className="hours-col">
              <p className="hours-value">{nextWindow ? '1' : '0'}</p>
              <span className="hours-label">Upcoming</span>
            </div>
          </div>
          <p className="status-hint">{nextWindow ? `Next: ${formatDateTime(nextWindow.startAt)}` : 'No upcoming maintenance'}</p>
        </section>
        </aside>
      ) : null}
    </>
  );
}

export default MaintenancePage;
