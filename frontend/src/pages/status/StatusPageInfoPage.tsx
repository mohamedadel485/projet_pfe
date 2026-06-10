import { ChevronRight, Upload } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { isApiError, saveStatusPage } from '../../lib/api';
import { useAppLanguage } from '../../lib/language';
import type { StatusPageMonitorOption } from './StatusPageMonitorsPage';
import {
  createStatusPageId,
  promoteStatusPageDraft,
  removeStatusPage,
  readStoredStatusPageMonitorIds,
  readStoredStatusPageSettings,
  type StoredStatusPageSettings,
  writeStoredStatusPageMonitorIds,
  writeStoredStatusPageSettings,
} from './statusPageStorage';
import './status-page-info-page.css';

interface StatusPageInfoPageProps {
  statusPageId: string;
  statusPageName?: string;
  monitors: StatusPageMonitorOption[];
  authToken?: string | null;
  onBackToMonitoring: () => void;
  onBackToStatusPages: () => void;
  onOpenMonitorsStep: () => void;
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
  const storedSettings = readStoredStatusPageSettings(statusPageId);
  const formValues = {
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

  return { storedSettings, formValues };
};

const densityOptionsDefaults: DensityOption[] = [
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

const alignmentOptionsDefaults: AlignmentOption[] = [
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
  const storedMonitorIds = readStoredStatusPageMonitorIds(statusPageId);
  const nextSelectedMonitorIds = storedMonitorIds.filter((monitorId) => validMonitorIds.has(monitorId));

  if (nextSelectedMonitorIds.length === 0 && statusPageId !== 'new' && validMonitorIds.has(statusPageId)) {
    return [statusPageId];
  }

  return nextSelectedMonitorIds;
};

function StatusPageInfoPage({
  statusPageId,
  statusPageName,
  monitors,
  authToken,
  onBackToMonitoring,
  onBackToStatusPages,
  onOpenMonitorsStep,
}: StatusPageInfoPageProps) {
  const { language, t } = useAppLanguage();
  const [formValues, setFormValues] = useState<StatusPageFormValues>(
    () => readStoredStatusPageState(statusPageId, statusPageName).formValues,
  );
  const [storedSettings, setStoredSettings] = useState<StoredStatusPageSettings>(
    () => readStoredStatusPageState(statusPageId, statusPageName).storedSettings,
  );
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hydratedStatusPageId, setHydratedStatusPageId] = useState(statusPageId);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const densityOptions =
    language === 'fr'
      ? [
          {
            value: 'wide' as const,
            label: t('statusPageInfo.density.wide.label'),
            description: t('statusPageInfo.density.wide.description'),
          },
          {
            value: 'compact' as const,
            label: t('statusPageInfo.density.compact.label'),
            description: t('statusPageInfo.density.compact.description'),
          },
        ]
      : densityOptionsDefaults;
  const alignmentOptions =
    language === 'fr'
      ? [
          {
            value: 'left' as const,
            label: t('statusPageInfo.alignment.left.label'),
            description: t('statusPageInfo.alignment.left.description'),
          },
          {
            value: 'center' as const,
            label: t('statusPageInfo.alignment.center.label'),
            description: t('statusPageInfo.alignment.center.description'),
          },
        ]
      : alignmentOptionsDefaults;

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
    setLogoFile(null);

    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  }, [monitorIdsKey, monitors, statusPageId, statusPageName]);

  useEffect(() => {
    if (hydratedStatusPageId !== statusPageId) return;

    writeStoredStatusPageSettings(statusPageId, {
      ...storedSettings,
      pageName: formValues.pageName,
      customDomain: formValues.customDomain,
      logoName: formValues.logoName,
      password: formValues.password,
      passwordEnabled: formValues.passwordEnabled,
      density: formValues.density,
      alignment: formValues.alignment,
    });
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

    setLogoFile(selectedFile);
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

  const handleFinishSetup = async () => {
    if (isSaving) {
      return;
    }

    if (!formValues.pageName.trim()) {
      setSaveNotice(t('statusPageInfo.error.nameRequired'));
      return;
    }

    if (isNewStatusPage && selectedMonitorIds.length === 0) {
      removeStatusPage(statusPageId);
      onBackToStatusPages();
      return;
    }

    if (formValues.passwordEnabled && !formValues.password.trim()) {
      setSaveNotice(t('statusPageInfo.error.passwordRequired'));
      return;
    }

    const nextStoredSettings = {
      ...storedSettings,
      pageName: formValues.pageName,
      customDomain: formValues.customDomain,
      logoName: formValues.logoName,
      password: formValues.password,
      passwordEnabled: formValues.passwordEnabled,
      density: formValues.density,
      alignment: formValues.alignment,
    };

    const nextMonitorIds = [...selectedMonitorIds];
    const publishedStatusPageId = isNewStatusPage ? createStatusPageId() : statusPageId;

    writeStoredStatusPageSettings(statusPageId, {
      ...nextStoredSettings,
    });
    writeStoredStatusPageMonitorIds(statusPageId, nextMonitorIds);

    setIsSaving(true);

    try {
      const saveResponse = await saveStatusPage(publishedStatusPageId, {
        pageName: nextStoredSettings.pageName.trim(),
        monitorIds: nextMonitorIds,
        passwordEnabled: nextStoredSettings.passwordEnabled,
        password: nextStoredSettings.passwordEnabled ? nextStoredSettings.password.trim() : '',
        customDomain: nextStoredSettings.customDomain.trim(),
        logoName: nextStoredSettings.logoName.trim(),
        logoFile,
        density: nextStoredSettings.density,
        alignment: nextStoredSettings.alignment,
      }, authToken ?? undefined);

      const resolvedStatusPageId =
        saveResponse.statusPage.id?.trim() || publishedStatusPageId;

      if (isNewStatusPage) {
        // Only promote the draft once the backend has the page, so the public URL is real.
        promoteStatusPageDraft(statusPageId, resolvedStatusPageId);
      } else if (resolvedStatusPageId !== statusPageId) {
        promoteStatusPageDraft(statusPageId, resolvedStatusPageId);
      }

      setSaveNotice(
        isNewStatusPage
          ? t('statusPageInfo.notice.createdAndPublished')
          : t('statusPageInfo.notice.published'),
      );
      setLogoFile(null);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      if (isNewStatusPage) {
        onBackToStatusPages();
      }
    } catch (error) {
      const fallbackMessage = isApiError(error)
        ? error.message
        : error instanceof Error && error.message.trim() !== ''
          ? error.message
          : '';

      setSaveNotice(
        fallbackMessage
          ? t('statusPageInfo.notice.savedLocallyWithServerError', { message: fallbackMessage })
          : t('statusPageInfo.notice.savedLocallyWithServerErrorFallback'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="status-page-info-page">
      <header className="status-page-info-header">
        <nav aria-label="Breadcrumb" className="status-page-info-breadcrumb">
          <button type="button" onClick={onBackToMonitoring}>
            {t('statusPageInfo.breadcrumb.monitoring')}
          </button>
          <ChevronRight size={12} />
          <button type="button" onClick={onBackToStatusPages}>
            {t('statusPageInfo.breadcrumb.statusPages')}
          </button>
        </nav>

        <div className="status-page-info-header-copy">
          <h1>{isNewStatusPage ? t('statusPageInfo.title.create') : t('statusPageInfo.title.settings')}</h1>
        </div>
      </header>

      <div className="status-page-info-layout">
        <div className="status-page-info-main">
          {saveNotice ? <p className="status-page-info-notice">{saveNotice}</p> : null}

          <section className="status-page-info-card status-page-info-main-card">
            <div className="status-page-info-section two-columns">
              <label className="status-page-info-field">
                <span>{t('statusPageInfo.name.label')}</span>
                <small>{t('statusPageInfo.name.hint')}</small>
                <input
                  type="text"
                  value={formValues.pageName}
                  onChange={updateTextField('pageName')}
                  placeholder={t('statusPageInfo.name.placeholder')}
                  autoComplete="off"
                />
              </label>

              <label className="status-page-info-field">
                <div className="status-page-info-field-topline">
                  <span>{t('statusPageInfo.customDomain.label')}</span>
                  <em>{t('statusPageInfo.customDomain.optional')}</em>
                </div>
                <small>{t('statusPageInfo.customDomain.hint')}</small>
                <input
                  type="text"
                  value={formValues.customDomain}
                  onChange={updateTextField('customDomain')}
                  placeholder={t('statusPageInfo.customDomain.placeholder')}
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="status-page-info-section">
              <div className="status-page-info-section-header">
                <h2>{t('statusPageInfo.logo.title')}</h2>
                <p>{t('statusPageInfo.logo.hint')}</p>
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
                  <strong>{formValues.logoName || t('statusPageInfo.logo.dropzoneEmpty')}</strong>
                  <small>
                    {formValues.logoName
                      ? t('statusPageInfo.logo.dropzoneSelected')
                      : t('statusPageInfo.logo.bestResult')}
                  </small>
                </div>
              </button>
            </div>

            <div className="status-page-info-section">
              <div className="status-page-info-section-header">
                <h2>{t('statusPageInfo.layout.title')}</h2>
                <p>{t('statusPageInfo.layout.hint')}</p>
              </div>

              <div className="status-page-info-preview-grid two-columns">
                <div className="status-page-info-preview-block">
                  <div className="status-page-info-preview-block-head">
                    <h3>{t('statusPageInfo.density.title')}</h3>
                    <p>{t('statusPageInfo.density.hint')}</p>
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
                    <h3>{t('statusPageInfo.alignment.title')}</h3>
                    <p>{t('statusPageInfo.alignment.hint')}</p>
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
                <h2>{t('statusPageInfo.password.title')}</h2>
                <p>{t('statusPageInfo.password.hint')}</p>
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
                  <strong>{t('statusPageInfo.password.toggle.label')}</strong>
                  <small>
                    {formValues.passwordEnabled
                      ? t('statusPageInfo.password.toggle.enabledHint')
                      : t('statusPageInfo.password.toggle.disabledHint')}
                  </small>
                </div>

                <span
                  className={`status-page-info-password-toggle-badge ${formValues.passwordEnabled ? 'enabled' : 'disabled'}`}
                >
                  {formValues.passwordEnabled
                    ? t('statusPageInfo.password.toggle.enabled')
                    : t('statusPageInfo.password.toggle.disabled')}
                </span>
              </label>

              {formValues.passwordEnabled ? (
                <label className="status-page-info-field">
                  <span>{t('statusPageInfo.password.fieldLabel')}</span>
                  <input
                    type="password"
                    value={formValues.password}
                    onChange={updateTextField('password')}
                    placeholder={t('statusPageInfo.password.fieldPlaceholder')}
                    autoComplete="new-password"
                  />
                </label>
              ) : (
                <p className="status-page-info-password-note">{t('statusPageInfo.password.note')}</p>
              )}
            </div>

            <footer className="status-page-info-actions">
              <button type="button" className="status-page-info-secondary" onClick={onOpenMonitorsStep}>
                {t('statusPageInfo.actions.backToMonitors')}
              </button>
              <button type="button" className="status-page-info-primary" onClick={handleFinishSetup} disabled={isSaving}>
                {isSaving
                  ? t('statusPageInfo.actions.saving')
                  : isNewStatusPage
                    ? t('statusPageInfo.actions.finishCreate')
                    : t('statusPageInfo.actions.saveSettings')}
              </button>
            </footer>
          </section>
        </div>

        <aside className="status-page-info-sidebar" aria-label={t('statusPageInfo.sidebar.ariaLabel')}>
          <section className="status-page-info-sidebar-card">
            <p className="status-page-info-sidebar-label">{t('statusPageInfo.sidebar.setupFlow')}</p>

            <button type="button" className="status-page-info-step link" onClick={onOpenMonitorsStep}>
              <span className="status-page-info-step-index">1</span>
              <div className="status-page-info-step-copy">
                <strong>{t('statusPageInfo.sidebar.stepMonitors')}</strong>
                <small>{t('statusPageInfo.sidebar.stepMonitorsHint')}</small>
              </div>
              <ChevronRight size={15} />
            </button>

            <div className="status-page-info-step active">
              <span className="status-page-info-step-index">2</span>
              <div className="status-page-info-step-copy">
                <strong>{t('statusPageInfo.sidebar.stepGlobalSettings')}</strong>
                <small>{t('statusPageInfo.sidebar.stepGlobalSettingsHint')}</small>
              </div>
            </div>
          </section>

          <section className="status-page-info-sidebar-card">
            <p className="status-page-info-sidebar-label">{t('statusPageInfo.sidebar.summary')}</p>
            <h3>{formValues.pageName.trim() || statusPageName || t('statusPageInfo.sidebar.newStatusPage')}</h3>
            <p className="status-page-info-sidebar-summary">
              {selectedMonitorIds.length > 0
                ? t('statusPageInfo.sidebar.selectedMonitorsCount', { count: selectedMonitorIds.length })
                : t('statusPageInfo.sidebar.noMonitorsSelected')}
            </p>

            {selectedPreview.length > 0 ? (
              <div className="status-page-info-sidebar-tags">
                {selectedPreview.map((monitor) => (
                  <span key={`summary-${monitor.id}`}>{monitor.name}</span>
                ))}
                {selectedOverflowCount > 0 ? (
                  <span>{t('statusPageInfo.sidebar.more', { count: selectedOverflowCount })}</span>
                ) : null}
              </div>
            ) : null}

            <div className="status-page-info-sidebar-meta">
              <div>
                <span>{t('statusPageInfo.sidebar.customDomain')}</span>
                <strong>{formValues.customDomain.trim() || t('statusPageInfo.sidebar.notSet')}</strong>
              </div>
              <div>
                <span>{t('statusPageInfo.sidebar.logo')}</span>
                <strong>{formValues.logoName.trim() || t('statusPageInfo.sidebar.notUploaded')}</strong>
              </div>
              <div>
                <span>{t('statusPageInfo.sidebar.densityCompact')}</span>
                <strong>{formValues.density === 'compact' ? t('statusPageInfo.sidebar.densityCompact') : t('statusPageInfo.sidebar.densityWide')}</strong>
              </div>
              <div>
                <span>{t('statusPageInfo.sidebar.alignmentCenter')}</span>
                <strong>
                  {formValues.alignment === 'center'
                    ? t('statusPageInfo.sidebar.alignmentCenter')
                    : t('statusPageInfo.sidebar.alignmentLeft')}
                </strong>
              </div>
              <div>
                <span>{t('statusPageInfo.password.fieldLabel')}</span>
                <strong>
                  {formValues.passwordEnabled
                    ? formValues.password.trim()
                      ? t('statusPageInfo.password.toggle.enabled')
                      : t('statusPageInfo.sidebar.passwordMissing')
                    : t('statusPageInfo.password.toggle.disabled')}
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
