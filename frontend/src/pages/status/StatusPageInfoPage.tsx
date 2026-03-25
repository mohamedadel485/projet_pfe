import { ChevronRight, Upload } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import type { StatusPageMonitorOption } from './StatusPageMonitorsPage';
import './status-page-info-page.css';

interface StatusPageInfoPageProps {
  statusPageId: string;
  statusPageName?: string;
  monitors: StatusPageMonitorOption[];
  onBackToMonitoring: () => void;
  onBackToStatusPages: () => void;
  onOpenMonitorsStep: () => void;
}

interface StoredStatusPageSettings extends Record<string, unknown> {
  pageName?: string;
  customDomain?: string;
  logoName?: string;
  password?: string;
  passwordEnabled?: boolean;
  density?: 'wide' | 'compact';
  alignment?: 'left' | 'center';
}

interface StatusPageFormValues {
  pageName: string;
  customDomain: string;
  logoName: string;
  password: string;
  passwordEnabled: boolean;
  density: 'wide' | 'compact';
  alignment: 'left' | 'center';
}

interface DensityOption {
  value: 'wide' | 'compact';
  label: string;
  description: string;
}

interface AlignmentOption {
  value: 'left' | 'center';
  label: string;
  description: string;
}

const getStatusPageSettingsStorageKey = (statusPageId: string) =>
  `uptimewarden_status_page_settings_${statusPageId}`;

const getStatusPageMonitorStorageKey = (statusPageId: string) =>
  `uptimewarden_status_page_monitors_${statusPageId}`;

const createDefaultFormValues = (statusPageName?: string): StatusPageFormValues => ({
  pageName: statusPageName || '',
  customDomain: '',
  logoName: '',
  password: '',
  passwordEnabled: false,
  density: 'wide',
  alignment: 'left',
});

const readStoredStatusPageState = (statusPageId: string, statusPageName?: string) => {
  const defaultValues = createDefaultFormValues(statusPageName);
  let storedSettings: StoredStatusPageSettings = {};
  let formValues = defaultValues;

  try {
    const storedValue = window.localStorage.getItem(getStatusPageSettingsStorageKey(statusPageId));
    if (storedValue) {
      const parsedValue = JSON.parse(storedValue);
      if (parsedValue && typeof parsedValue === 'object') {
        storedSettings = parsedValue as StoredStatusPageSettings;
        formValues = {
          pageName:
            typeof storedSettings.pageName === 'string' && storedSettings.pageName.trim()
              ? storedSettings.pageName
              : defaultValues.pageName,
          customDomain: typeof storedSettings.customDomain === 'string' ? storedSettings.customDomain : '',
          logoName: typeof storedSettings.logoName === 'string' ? storedSettings.logoName : '',
          password: typeof storedSettings.password === 'string' ? storedSettings.password : '',
          passwordEnabled:
            typeof storedSettings.passwordEnabled === 'boolean'
              ? storedSettings.passwordEnabled
              : typeof storedSettings.password === 'string' && storedSettings.password.trim().length > 0,
          density: storedSettings.density === 'compact' ? 'compact' : defaultValues.density,
          alignment: storedSettings.alignment === 'center' ? 'center' : defaultValues.alignment,
        };
      }
    }
  } catch {
    storedSettings = {};
    formValues = defaultValues;
  }

  return { storedSettings, formValues };
};

const densityOptions: DensityOption[] = [
  {
    value: 'wide',
    label: 'Wide',
    description: 'Airy spacing for a cleaner and easier public page.',
  },
  {
    value: 'compact',
    label: 'Compact',
    description: 'Denser layout to show more monitors at once.',
  },
];

const alignmentOptions: AlignmentOption[] = [
  {
    value: 'left',
    label: 'Logo on left',
    description: 'Keep branding aligned with your monitor list.',
  },
  {
    value: 'center',
    label: 'Logo on center',
    description: 'Push your brand more visually at the top of the page.',
  },
];

const readSelectedMonitorIds = (statusPageId: string, monitors: StatusPageMonitorOption[]) => {
  const validMonitorIds = new Set(monitors.map((monitor) => monitor.id));
  let nextSelectedMonitorIds: string[] = [];

  try {
    const storedValue = window.localStorage.getItem(getStatusPageMonitorStorageKey(statusPageId));
    if (storedValue) {
      const parsedValue = JSON.parse(storedValue);
      if (Array.isArray(parsedValue)) {
        nextSelectedMonitorIds = parsedValue.filter(
          (monitorId): monitorId is string => typeof monitorId === 'string' && validMonitorIds.has(monitorId),
        );
      }
    }
  } catch {
    nextSelectedMonitorIds = [];
  }

  if (nextSelectedMonitorIds.length === 0 && statusPageId !== 'new' && validMonitorIds.has(statusPageId)) {
    nextSelectedMonitorIds = [statusPageId];
  }

  return nextSelectedMonitorIds;
};

function StatusPageInfoPage({
  statusPageId,
  statusPageName,
  monitors,
  onBackToMonitoring,
  onBackToStatusPages,
  onOpenMonitorsStep,
}: StatusPageInfoPageProps) {
  const [formValues, setFormValues] = useState<StatusPageFormValues>(
    () => readStoredStatusPageState(statusPageId, statusPageName).formValues,
  );
  const [storedSettings, setStoredSettings] = useState<StoredStatusPageSettings>(
    () => readStoredStatusPageState(statusPageId, statusPageName).storedSettings,
  );
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [hydratedStatusPageId, setHydratedStatusPageId] = useState(statusPageId);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const isNewStatusPage = statusPageId === 'new';
  const monitorIdsKey = monitors.map((monitor) => monitor.id).join('|');

  useEffect(() => {
    const { storedSettings: nextStoredSettings, formValues: nextFormValues } = readStoredStatusPageState(
      statusPageId,
      statusPageName,
    );

    setStoredSettings(nextStoredSettings);
    setFormValues(nextFormValues);
    setSelectedMonitorIds(readSelectedMonitorIds(statusPageId, monitors));
    setSaveNotice(null);
    setHydratedStatusPageId(statusPageId);
  }, [monitorIdsKey, monitors, statusPageId, statusPageName]);

  useEffect(() => {
    if (hydratedStatusPageId !== statusPageId) return;

    try {
      window.localStorage.setItem(
        getStatusPageSettingsStorageKey(statusPageId),
        JSON.stringify({
          ...storedSettings,
          pageName: formValues.pageName,
          customDomain: formValues.customDomain,
          logoName: formValues.logoName,
          password: formValues.password,
          passwordEnabled: formValues.passwordEnabled,
          density: formValues.density,
          alignment: formValues.alignment,
        }),
      );
    } catch {
      // Ignore storage failures and keep the form interactive.
    }
  }, [formValues, hydratedStatusPageId, statusPageId, storedSettings]);

  useEffect(() => {
    if (!saveNotice) return;

    const timer = window.setTimeout(() => {
      setSaveNotice(null);
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [saveNotice]);

  const selectedMonitors = monitors.filter((monitor) => selectedMonitorIds.includes(monitor.id));
  const selectedPreview = selectedMonitors.slice(0, 3);
  const selectedOverflowCount = Math.max(0, selectedMonitors.length - selectedPreview.length);

  const updateTextField =
    (field: keyof StatusPageFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setFormValues((currentValues) => ({
        ...currentValues,
        [field]: value,
      }));
    };

  const handleLogoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFormValues((currentValues) => ({
      ...currentValues,
      logoName: selectedFile.name,
    }));
  };

  const handleDensitySelect = (density: StatusPageFormValues['density']) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      density,
    }));
  };

  const handleAlignmentSelect = (alignment: StatusPageFormValues['alignment']) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      alignment,
    }));
  };

  const handlePasswordEnabledChange = (enabled: boolean) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      passwordEnabled: enabled,
    }));
  };

  const handleFinishSetup = () => {
    if (!formValues.pageName.trim()) {
      setSaveNotice('Status page name is required.');
      return;
    }

    if (formValues.passwordEnabled && !formValues.password.trim()) {
      setSaveNotice('Enter a password or disable password protection.');
      return;
    }

    setSaveNotice(isNewStatusPage ? 'Status page setup saved locally.' : 'Global settings saved locally.');
  };

  return (
    <section className="status-page-info-page">
      <header className="status-page-info-header">
        <nav aria-label="Breadcrumb" className="status-page-info-breadcrumb">
          <button type="button" onClick={onBackToMonitoring}>
            Monitoring
          </button>
          <ChevronRight size={12} />
          <button type="button" onClick={onBackToStatusPages}>
            Status pages
          </button>
        </nav>

        <div className="status-page-info-header-copy">
          <h1>{isNewStatusPage ? 'Create status page' : 'Global settings'}</h1>
          <p>Only the sections from your screenshot were removed. The other settings are kept.</p>
        </div>
      </header>

      <div className="status-page-info-layout">
        <div className="status-page-info-main">
          {saveNotice ? <p className="status-page-info-notice">{saveNotice}</p> : null}

          <section className="status-page-info-card status-page-info-main-card">
            <div className="status-page-info-section two-columns">
              <label className="status-page-info-field">
                <span>Name of the status page</span>
                <small>Required. Used in page heading, browser title and shared links.</small>
                <input
                  type="text"
                  value={formValues.pageName}
                  onChange={updateTextField('pageName')}
                  placeholder="Status page"
                  autoComplete="off"
                />
              </label>

              <label className="status-page-info-field">
                <div className="status-page-info-field-topline">
                  <span>Custom domain</span>
                  <em>Optional</em>
                </div>
                <small>Host the page on your own domain when you are ready to publish it.</small>
                <input
                  type="text"
                  value={formValues.customDomain}
                  onChange={updateTextField('customDomain')}
                  placeholder="e.g. status.yourdomain.com"
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="status-page-info-section">
              <div className="status-page-info-section-header">
                <h2>Logo</h2>
                <p>Upload a brand mark for the page header. PNG, JPG or SVG recommended.</p>
              </div>

              <input
                ref={logoInputRef}
                className="status-page-info-hidden-file-input"
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                onChange={handleLogoSelection}
              />

              <button
                type="button"
                className={`status-page-info-logo-dropzone ${formValues.logoName ? 'has-file' : ''}`}
                onClick={() => logoInputRef.current?.click()}
              >
                <span className="status-page-info-logo-icon" aria-hidden="true">
                  <Upload size={16} />
                </span>
                <div className="status-page-info-logo-copy">
                  <strong>{formValues.logoName || 'Drag and drop your logo here or choose by click'}</strong>
                  <small>
                    {formValues.logoName
                      ? 'Click to replace the selected file.'
                      : 'Best result: square logo, lightweight image and transparent background.'}
                  </small>
                </div>
              </button>
            </div>

            <div className="status-page-info-section">
              <div className="status-page-info-section-header">
                <h2>Layout</h2>
                <p>Choose spacing and logo placement for the public page.</p>
              </div>

              <div className="status-page-info-preview-grid two-columns">
                <div className="status-page-info-preview-block">
                  <div className="status-page-info-preview-block-head">
                    <h3>Density</h3>
                    <p>For better readability, compact to display as much info at once as possible.</p>
                  </div>

                  <div className="status-page-info-preview-options">
                    {densityOptions.map((option) => {
                      const isSelected = formValues.density === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`status-page-info-preview-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleDensitySelect(option.value)}
                        >
                          <div className="status-page-info-preview-head">
                            <span className={`status-page-info-preview-check ${isSelected ? 'selected' : ''}`} aria-hidden="true" />
                            <div className="status-page-info-preview-copy">
                              <strong>{option.label}</strong>
                              <small>{option.description}</small>
                            </div>
                          </div>

                          <div className={`status-page-info-mini-preview density-${option.value}`}>
                            <div className="status-page-info-mini-preview-shell">
                              <div className="status-page-info-mini-preview-topline" />
                              <div className="status-page-info-mini-preview-banner" />
                              <div className="status-page-info-mini-preview-row" />
                              <div className="status-page-info-mini-preview-row short" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="status-page-info-preview-block">
                  <div className="status-page-info-preview-block-head">
                    <h3>Alignment</h3>
                    <p>Use maximum space with logo on left or push your brand first.</p>
                  </div>

                  <div className="status-page-info-preview-options">
                    {alignmentOptions.map((option) => {
                      const isSelected = formValues.alignment === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`status-page-info-preview-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleAlignmentSelect(option.value)}
                        >
                          <div className="status-page-info-preview-head">
                            <span className={`status-page-info-preview-check ${isSelected ? 'selected' : ''}`} aria-hidden="true" />
                            <div className="status-page-info-preview-copy">
                              <strong>{option.label}</strong>
                              <small>{option.description}</small>
                            </div>
                          </div>

                          <div className={`status-page-info-mini-preview alignment-${option.value}`}>
                            <div className="status-page-info-mini-preview-shell">
                              <div className="status-page-info-mini-preview-topline" />
                              <div className="status-page-info-mini-preview-banner" />
                              <div className="status-page-info-mini-preview-row" />
                              <div className="status-page-info-mini-preview-row short" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="status-page-info-section">
              <div className="status-page-info-section-header">
                <h2>Password</h2>
                <p>Protect the page with a password if you do not want it to be public yet.</p>
              </div>

              <label className="status-page-info-toggle-item status-page-info-password-toggle">
                <span className="status-page-info-toggle-control">
                  <input
                    type="checkbox"
                    checked={formValues.passwordEnabled}
                    onChange={(event) => handlePasswordEnabledChange(event.target.checked)}
                  />
                  <span className="status-page-info-toggle-slider" aria-hidden="true" />
                </span>

                <div className="status-page-info-toggle-copy">
                  <strong>Password protection</strong>
                  <small>
                    {formValues.passwordEnabled
                      ? 'Visitors must enter the password to open this status page.'
                      : 'The status page stays public without password protection.'}
                  </small>
                </div>

                <span
                  className={`status-page-info-password-toggle-badge ${formValues.passwordEnabled ? 'enabled' : 'disabled'}`}
                >
                  {formValues.passwordEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>

              {formValues.passwordEnabled ? (
                <label className="status-page-info-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={formValues.password}
                    onChange={updateTextField('password')}
                    placeholder="Enter password"
                    autoComplete="new-password"
                  />
                </label>
              ) : (
                <p className="status-page-info-password-note">
                  Enable password protection to require a password on the public status page.
                </p>
              )}
            </div>

            <footer className="status-page-info-actions">
              <button type="button" className="status-page-info-secondary" onClick={onOpenMonitorsStep}>
                Back to monitors
              </button>
              <button type="button" className="status-page-info-primary" onClick={handleFinishSetup}>
                {isNewStatusPage ? 'Finish: Create status page' : 'Save global settings'}
              </button>
            </footer>
          </section>
        </div>

        <aside className="status-page-info-sidebar" aria-label="Status page setup steps">
          <section className="status-page-info-sidebar-card">
            <p className="status-page-info-sidebar-label">Setup flow</p>

            <button type="button" className="status-page-info-step link" onClick={onOpenMonitorsStep}>
              <span className="status-page-info-step-index">1</span>
              <div className="status-page-info-step-copy">
                <strong>Monitors</strong>
                <small>Select the services to display</small>
              </div>
              <ChevronRight size={15} />
            </button>

            <div className="status-page-info-step active">
              <span className="status-page-info-step-index">2</span>
              <div className="status-page-info-step-copy">
                <strong>Global settings</strong>
                <small>Name, domain, logo and password</small>
              </div>
            </div>
          </section>

          <section className="status-page-info-sidebar-card">
            <p className="status-page-info-sidebar-label">Summary</p>
            <h3>{formValues.pageName.trim() || statusPageName || 'New status page'}</h3>
            <p className="status-page-info-sidebar-summary">
              {selectedMonitorIds.length > 0
                ? `${selectedMonitorIds.length} monitor${selectedMonitorIds.length > 1 ? 's' : ''} selected.`
                : 'No monitors selected yet.'}
            </p>

            {selectedPreview.length > 0 ? (
              <div className="status-page-info-sidebar-tags">
                {selectedPreview.map((monitor) => (
                  <span key={`summary-${monitor.id}`}>{monitor.name}</span>
                ))}
                {selectedOverflowCount > 0 ? <span>+{selectedOverflowCount} more</span> : null}
              </div>
            ) : null}

            <div className="status-page-info-sidebar-meta">
              <div>
                <span>Custom domain</span>
                <strong>{formValues.customDomain.trim() || 'Not set'}</strong>
              </div>
              <div>
                <span>Logo</span>
                <strong>{formValues.logoName.trim() || 'Not uploaded'}</strong>
              </div>
              <div>
                <span>Density</span>
                <strong>{formValues.density === 'compact' ? 'Compact' : 'Wide'}</strong>
              </div>
              <div>
                <span>Alignment</span>
                <strong>{formValues.alignment === 'center' ? 'Logo center' : 'Logo left'}</strong>
              </div>
              <div>
                <span>Password</span>
                <strong>
                  {formValues.passwordEnabled
                    ? formValues.password.trim()
                      ? 'Enabled'
                      : 'Missing password'
                    : 'Disabled'}
                </strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default StatusPageInfoPage;
