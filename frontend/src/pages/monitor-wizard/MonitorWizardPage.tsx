import { ChevronRight, Globe, Network, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CreateIntegrationInput, CreateMonitorInput, IntegrationEvent, IntegrationProvider } from '../../lib/api';
import { useAppLanguage } from '../../lib/language';
import './MonitorWizardPage.css';

type WizardStep = 0 | 1 | 2;
type MonitorHttpMethod = NonNullable<CreateMonitorInput['httpMethod']>;

interface SuggestedMonitor {
  title: string;
  endpoint: string;
  hint: string;
}

interface MonitorDraft {
  id: string;
  enabled: boolean;
  name: string;
  url: string;
  type: CreateMonitorInput['type'];
  interval: number;
  timeout: number;
  httpMethod: MonitorHttpMethod;
}

export interface MonitorWizardSubmission {
  monitors: Array<{
    name: string;
    url: string;
    type: CreateMonitorInput['type'];
    interval: number;
    timeout: number;
    httpMethod: MonitorHttpMethod;
  }>;
  inviteEmails: string[];
  integration: CreateIntegrationInput | null;
}

interface MonitorWizardPageProps {
  onBack: () => void;
  canInviteTeam: boolean;
  onSubmitWizard: (payload: MonitorWizardSubmission) => Promise<string | null>;
}

const wizardStepKeys = [
  'monitorWizard.steps.suggestions',
  'monitorWizard.steps.details',
  'monitorWizard.steps.notify',
] as const;
const httpMethodOptions: MonitorHttpMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'];
const intervalOptions = [1, 5, 10, 30, 60];
const timeoutOptions = [5, 15, 30, 45, 60];
const integrationTypeOptions: IntegrationProvider[] = ['webhook', 'slack', 'telegram'];

const normalizeWebsiteInput = (value: string): string => {
  const trimmedValue = value.trim();
  if (trimmedValue === '') return '';
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue;
  return `https://${trimmedValue}`;
};

const parseWebsiteUrl = (value: string): URL | null => {
  const normalizedValue = normalizeWebsiteInput(value);
  if (normalizedValue === '') return null;

  try {
    return new URL(normalizedValue);
  } catch {
    return null;
  }
};

const inferMonitorType = (targetUrl: string): CreateMonitorInput['type'] => {
  if (targetUrl.startsWith('ws://')) return 'ws';
  if (targetUrl.startsWith('wss://')) return 'wss';
  if (targetUrl.startsWith('http://')) return 'http';
  return 'https';
};

const makeMonitorDraft = (source: SuggestedMonitor, index: number): MonitorDraft => ({
  id: `wizard-monitor-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`,
  enabled: true,
  name: source.title,
  url: source.endpoint,
  type: inferMonitorType(source.endpoint),
  interval: source.endpoint.includes('/api/') ? 1 : 5,
  timeout: 30,
  httpMethod: 'GET',
});

const buildSuggestedMonitors = (
  origin: string,
  copy: {
    mainWebsite: { title: string; hint: string };
    healthEndpoint: { title: string; hint: string };
    authenticationFlow: { title: string; hint: string };
  },
): SuggestedMonitor[] => [
  {
    title: copy.mainWebsite.title,
    endpoint: origin,
    hint: copy.mainWebsite.hint,
  },
  {
    title: copy.healthEndpoint.title,
    endpoint: `${origin}/api/health`,
    hint: copy.healthEndpoint.hint,
  },
  {
    title: copy.authenticationFlow.title,
    endpoint: `${origin}/login`,
    hint: copy.authenticationFlow.hint,
  },
];

const buildCriticalPages = (origin: string): string[] => [
  origin,
  `${origin}/login`,
  `${origin}/account`,
  `${origin}/checkout`,
  `${origin}/api/health`,
];

const buildSubDomains = (hostname: string): string[] => {
  if (hostname === 'localhost') {
    return ['localhost'];
  }

  const hostParts = hostname.split('.').filter(Boolean);
  const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : hostname;
  return [`www.${rootDomain}`, `api.${rootDomain}`, `status.${rootDomain}`];
};

const parseInviteEmails = (rawValue: string): { valid: string[]; invalid: string[] } => {
  const entries = rawValue
    .split(/[\n,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const uniqueEntries = Array.from(new Set(entries));
  const valid: string[] = [];
  const invalid: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const email of uniqueEntries) {
    if (emailRegex.test(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  }

  return { valid, invalid };
};

const formatIntegrationLabel = (provider: IntegrationProvider): string =>
  provider.charAt(0).toUpperCase() + provider.slice(1);

function MonitorWizardPage({ onBack, canInviteTeam, onSubmitWizard }: MonitorWizardPageProps) {
  const { t } = useAppLanguage();
  const [activeStep, setActiveStep] = useState<WizardStep>(0);
  const [websiteInput, setWebsiteInput] = useState('');
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [suggestedMonitors, setSuggestedMonitors] = useState<SuggestedMonitor[]>([]);
  const [criticalPages, setCriticalPages] = useState<string[]>([]);
  const [runningPorts, setRunningPorts] = useState<number[]>([]);
  const [subDomains, setSubDomains] = useState<string[]>([]);
  const [monitorDrafts, setMonitorDrafts] = useState<MonitorDraft[]>([]);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [teamInvitesInput, setTeamInvitesInput] = useState('');
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [integrationType, setIntegrationType] = useState<IntegrationProvider>('webhook');
  const [integrationEndpoint, setIntegrationEndpoint] = useState('');
  const [integrationCustomValue, setIntegrationCustomValue] = useState('');
  const [integrationEvents, setIntegrationEvents] = useState<IntegrationEvent[]>(['up', 'down']);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasSuggestions = suggestedMonitors.length > 0;
  const enabledMonitors = useMemo(() => monitorDrafts.filter((monitor) => monitor.enabled), [monitorDrafts]);
  const parsedInviteEmails = useMemo(() => parseInviteEmails(teamInvitesInput), [teamInvitesInput]);
  const wizardSteps = useMemo(() => wizardStepKeys.map((stepKey) => t(stepKey)), [t]);

  const validateEnabledMonitors = (): string | null => {
    if (enabledMonitors.length === 0) {
      return t('monitorWizard.errors.selectAtLeastOneMonitor');
    }

    for (const monitor of enabledMonitors) {
      if (monitor.name.trim() === '') {
        return t('monitorWizard.errors.eachEnabledMonitorMustHaveAName');
      }

      if (monitor.url.trim() === '') {
        return t('monitorWizard.errors.eachEnabledMonitorMustHaveAUrl');
      }

      try {
        const parsedUrl = new URL(monitor.url.trim());
        const protocol = parsedUrl.protocol.toLowerCase();
        if (!['http:', 'https:', 'ws:', 'wss:'].includes(protocol)) {
          return t('monitorWizard.errors.unsupportedProtocolFor', { name: monitor.name });
        }
      } catch {
        return t('monitorWizard.errors.invalidUrlFor', { name: monitor.name });
      }

      if (!Number.isFinite(monitor.interval) || monitor.interval < 1) {
        return t('monitorWizard.errors.invalidIntervalFor', { name: monitor.name });
      }

      if (!Number.isFinite(monitor.timeout) || monitor.timeout < 5) {
        return t('monitorWizard.errors.invalidTimeoutFor', { name: monitor.name });
      }
    }

    return null;
  };

  const handleSuggestMonitors = () => {
    const parsedUrl = parseWebsiteUrl(websiteInput);

    if (!parsedUrl) {
      setWebsiteError(t('monitorWizard.errors.websiteRequired'));
      setSuggestedMonitors([]);
      setCriticalPages([]);
      setRunningPorts([]);
      setSubDomains([]);
      setMonitorDrafts([]);
      return;
    }

    const protocol = parsedUrl.protocol.toLowerCase();
    const defaultPorts = protocol === 'http:' ? [80, 443, 8080] : [443, 80, 8443];
    const suggestions = buildSuggestedMonitors(parsedUrl.origin, {
      mainWebsite: {
        title: t('monitorWizard.suggestions.mainWebsite.title'),
        hint: t('monitorWizard.suggestions.mainWebsite.hint'),
      },
      healthEndpoint: {
        title: t('monitorWizard.suggestions.healthEndpoint.title'),
        hint: t('monitorWizard.suggestions.healthEndpoint.hint'),
      },
      authenticationFlow: {
        title: t('monitorWizard.suggestions.authenticationFlow.title'),
        hint: t('monitorWizard.suggestions.authenticationFlow.hint'),
      },
    });

    setWebsiteError(null);
    setSubmitError(null);
    setDetailsError(null);
    setSuggestedMonitors(suggestions);
    setCriticalPages(buildCriticalPages(parsedUrl.origin));
    setRunningPorts(defaultPorts);
    setSubDomains(buildSubDomains(parsedUrl.hostname));
    setMonitorDrafts(suggestions.map(makeMonitorDraft));
    setActiveStep(1);
  };

  const updateMonitorDraft = (id: string, field: keyof MonitorDraft, value: string | number | boolean) => {
    setMonitorDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.id !== id) return draft;
        if (field === 'name' && typeof value === 'string') return { ...draft, name: value };
        if (field === 'url' && typeof value === 'string') return { ...draft, url: value, type: inferMonitorType(value) };
        if (field === 'type' && typeof value === 'string') return { ...draft, type: value as CreateMonitorInput['type'] };
        if (field === 'interval' && typeof value === 'number') return { ...draft, interval: value };
        if (field === 'timeout' && typeof value === 'number') return { ...draft, timeout: value };
        if (field === 'httpMethod' && typeof value === 'string') return { ...draft, httpMethod: value as MonitorHttpMethod };
        if (field === 'enabled' && typeof value === 'boolean') return { ...draft, enabled: value };
        return draft;
      })
    );
  };

  const handleAddCustomMonitor = () => {
    setMonitorDrafts((currentDrafts) => [
      ...currentDrafts,
      {
        id: `wizard-monitor-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        enabled: true,
        name: t('monitorWizard.customMonitor'),
        url: normalizeWebsiteInput(websiteInput),
        type: 'https',
        interval: 5,
        timeout: 30,
        httpMethod: 'GET',
      },
    ]);
    setDetailsError(null);
  };

  const handleRemoveMonitor = (id: string) => {
    setMonitorDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== id));
  };

  const goToStep = (nextStep: WizardStep) => {
    if (nextStep === 0) {
      setActiveStep(0);
      return;
    }

    if (!hasSuggestions) return;

    if (nextStep === 1) {
      setActiveStep(1);
      return;
    }

    const monitorValidationError = validateEnabledMonitors();
    if (monitorValidationError) {
      setDetailsError(monitorValidationError);
      setActiveStep(1);
      return;
    }

    setDetailsError(null);
    setActiveStep(2);
  };

  const toggleIntegrationEvent = (event: IntegrationEvent) => {
    setIntegrationEvents((currentEvents) => {
      if (currentEvents.includes(event)) {
        const nextEvents = currentEvents.filter((value) => value !== event);
        return nextEvents;
      }

      return [...currentEvents, event];
    });
  };

  const handleSubmitWizard = async () => {
    const monitorValidationError = validateEnabledMonitors();
    if (monitorValidationError) {
      setSubmitError(monitorValidationError);
      setActiveStep(1);
      return;
    }

    if (parsedInviteEmails.invalid.length > 0) {
      setSubmitError(t('monitorWizard.errors.invalidEmails', { emails: parsedInviteEmails.invalid.join(', ') }));
      return;
    }

    if (parsedInviteEmails.valid.length > 0 && !canInviteTeam) {
      setSubmitError(t('monitorWizard.errors.onlyAdminsCanInviteTeamMembers'));
      return;
    }

    let integrationPayload: CreateIntegrationInput | null = null;
    if (integrationEnabled) {
      if (integrationEndpoint.trim() === '') {
        setSubmitError(t('monitorWizard.errors.integrationEndpointRequired'));
        return;
      }

      try {
        const parsedEndpoint = new URL(integrationEndpoint.trim());
        if (!['http:', 'https:'].includes(parsedEndpoint.protocol.toLowerCase())) {
          setSubmitError(t('monitorWizard.errors.integrationEndpointMustStartWithHttpOrHttps'));
          return;
        }
      } catch {
        setSubmitError(t('monitorWizard.errors.integrationEndpointInvalid'));
        return;
      }

      if (integrationEvents.length === 0) {
        setSubmitError(t('monitorWizard.errors.selectAtLeastOneIntegrationEvent'));
        return;
      }

      integrationPayload = {
        type: integrationType,
        endpointUrl: integrationEndpoint.trim(),
        customValue: integrationCustomValue.trim() || undefined,
        events: integrationEvents,
      };
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const payload: MonitorWizardSubmission = {
      monitors: enabledMonitors.map((monitor) => ({
        name: monitor.name.trim(),
        url: monitor.url.trim(),
        type: monitor.type,
        interval: monitor.interval,
        timeout: monitor.timeout,
        httpMethod: monitor.httpMethod,
      })),
      inviteEmails: parsedInviteEmails.valid,
      integration: integrationPayload,
    };

    if (!emailNotificationsEnabled) {
      // Keep the toggle visible in UI without blocking wizard execution.
    }

    const error = await onSubmitWizard(payload);
    if (error) {
      setSubmitError(error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <section className="monitor-wizard-page">
      <div className="monitor-wizard-breadcrumb">
        <button type="button" className="monitor-wizard-breadcrumb-link" onClick={onBack}>
          {t('menu.monitoring')}
        </button>
        <ChevronRight size={14} />
        <span>{t('monitorWizard.breadcrumb')}</span>
      </div>

      <div className="monitor-wizard-layout">
        <div className="monitor-wizard-main">
          <h1>{t('monitorWizard.title')}</h1>

          {activeStep === 0 ? (
            <section className="monitor-wizard-card">
              <h2>{t('monitorWizard.websiteQuestion')}</h2>
              <p>{t('monitorWizard.websiteHint')}</p>
              <div className="monitor-wizard-input-row">
                <label className={`monitor-wizard-input-shell ${websiteError ? 'error' : ''}`}>
                  <input
                    type="text"
                    placeholder={t('monitorWizard.websitePlaceholder')}
                    value={websiteInput}
                    onChange={(event) => setWebsiteInput(event.target.value)}
                  />
                </label>
                <button type="button" className="monitor-wizard-suggest-btn" onClick={handleSuggestMonitors}>
                  <Sparkles size={14} />
                  <span>{t('monitorWizard.suggestMonitors')}</span>
                </button>
              </div>
              {websiteError ? <p className="monitor-wizard-error">{websiteError}</p> : null}

              <div className="monitor-wizard-monitor-list">
                {hasSuggestions ? (
                  suggestedMonitors.map((suggestedMonitor) => (
                    <article className="monitor-wizard-monitor-item" key={suggestedMonitor.endpoint}>
                      <h3>{suggestedMonitor.title}</h3>
                      <p className="endpoint">{suggestedMonitor.endpoint}</p>
                      <p>{suggestedMonitor.hint}</p>
                    </article>
                  ))
                ) : (
                  <p className="monitor-wizard-empty">
                    {t('monitorWizard.emptySuggestions.prefix')}{' '}
                    <strong>{t('monitorWizard.suggestMonitors')}</strong>{' '}
                    {t('monitorWizard.emptySuggestions.suffix')}
                  </p>
                )}
              </div>

              <div className="monitor-wizard-actions">
                <button type="button" className="monitor-wizard-secondary-btn" onClick={onBack}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="monitor-wizard-primary-btn" onClick={handleSuggestMonitors}>
                  {t('common.next')}
                </button>
              </div>
            </section>
          ) : null}

          {activeStep === 1 ? (
            <>
              <section className="monitor-wizard-card">
                <div className="monitor-wizard-section-title">
                  <Globe size={16} />
                  <h2>{t('monitorWizard.monitoringDetails')}</h2>
                </div>
                <p>{t('monitorWizard.monitoringDetailsDescription')}</p>

                <div className="monitor-wizard-details-list">
                  {monitorDrafts.map((monitor) => (
                    <article className={`wizard-monitor-detail ${monitor.enabled ? '' : 'disabled'}`} key={monitor.id}>
                      <div className="wizard-monitor-detail-head">
                        <label className="wizard-toggle">
                          <input
                            type="checkbox"
                            checked={monitor.enabled}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'enabled', event.target.checked)}
                          />
                          <span>{t('common.enabled')}</span>
                        </label>
                        <button type="button" className="wizard-monitor-delete" onClick={() => handleRemoveMonitor(monitor.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="wizard-monitor-grid">
                        <label>
                          <span>{t('common.name')}</span>
                          <input
                            type="text"
                            value={monitor.name}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'name', event.target.value)}
                          />
                        </label>
                        <label className="wide">
                          <span>{t('monitorWizard.url')}</span>
                          <input
                            type="text"
                            value={monitor.url}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'url', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>{t('monitorWizard.method')}</span>
                          <select
                            value={monitor.httpMethod}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'httpMethod', event.target.value)}
                          >
                            {httpMethodOptions.map((method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>{t('monitorWizard.interval')}</span>
                          <select
                            value={monitor.interval}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'interval', Number(event.target.value))}
                          >
                            {intervalOptions.map((interval) => (
                              <option key={interval} value={interval}>
                                {t('monitorWizard.intervalValue', { interval })}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>{t('monitorWizard.timeout')}</span>
                          <select
                            value={monitor.timeout}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'timeout', Number(event.target.value))}
                          >
                            {timeoutOptions.map((timeout) => (
                              <option key={timeout} value={timeout}>
                                {t('monitorWizard.timeoutValue', { timeout })}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </article>
                  ))}
                </div>

                <button type="button" className="monitor-wizard-secondary-btn inline" onClick={handleAddCustomMonitor}>
                  <Plus size={14} />
                  {t('monitorWizard.addCustomMonitor')}
                </button>

                {detailsError ? <p className="monitor-wizard-error">{detailsError}</p> : null}
              </section>

              <section className="monitor-wizard-card">
                <div className="monitor-wizard-section-title">
                  <Network size={16} />
                  <h2>{t('monitorWizard.autoDiscoveredContext')}</h2>
                </div>
                <p>{t('monitorWizard.autoDiscoveredDescription')}</p>

                <div className="wizard-auto-columns">
                  <div>
                    <h3>{t('monitorWizard.criticalPages')}</h3>
                    <div className="monitor-wizard-chip-list">
                      {criticalPages.map((pageUrl) => (
                        <span className="monitor-wizard-chip" key={pageUrl}>
                          {pageUrl}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>{t('monitorWizard.runningPorts')}</h3>
                    <div className="monitor-wizard-chip-list">
                      {runningPorts.map((port) => (
                        <span className="monitor-wizard-chip" key={port}>
                          {t('monitorWizard.port', { port })}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>{t('monitorWizard.subDomains')}</h3>
                    <div className="monitor-wizard-chip-list">
                      {subDomains.map((subDomain) => (
                        <span className="monitor-wizard-chip" key={subDomain}>
                          {subDomain}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <div className="monitor-wizard-actions">
                <button type="button" className="monitor-wizard-secondary-btn" onClick={() => goToStep(0)}>
                  {t('common.back')}
                </button>
                <button type="button" className="monitor-wizard-primary-btn" onClick={() => goToStep(2)}>
                  {t('common.next')}
                </button>
              </div>
            </>
          ) : null}

          {activeStep === 2 ? (
            <>
              <section className="monitor-wizard-card">
                <div className="monitor-wizard-section-title">
                  <Users size={16} />
                  <h2>{t('monitorWizard.notifyTeamIntegrations')}</h2>
                </div>
                <p>{t('monitorWizard.notifyDescription')}</p>

                <label className="wizard-toggle">
                  <input
                    type="checkbox"
                    checked={emailNotificationsEnabled}
                    onChange={(event) => setEmailNotificationsEnabled(event.target.checked)}
                  />
                  <span>{t('monitorWizard.enableEmailNotifications')}</span>
                </label>

                <label className="wizard-field">
                  <span>{t('monitorWizard.inviteTeammates')}</span>
                  <textarea
                    value={teamInvitesInput}
                    onChange={(event) => setTeamInvitesInput(event.target.value)}
                    placeholder={t('monitorWizard.inviteTeammatesPlaceholder')}
                    disabled={!canInviteTeam}
                  />
                </label>
                {!canInviteTeam ? (
                  <p className="wizard-hint">{t('monitorWizard.onlyAdminsCanSendInvitations')}</p>
                ) : (
                  <p className="wizard-hint">
                    {t('monitorWizard.validInvitesPrepared', { count: parsedInviteEmails.valid.length })}
                  </p>
                )}

                <div className="wizard-integration-block">
                  <label className="wizard-toggle">
                    <input
                      type="checkbox"
                      checked={integrationEnabled}
                      onChange={(event) => setIntegrationEnabled(event.target.checked)}
                    />
                    <span>{t('monitorWizard.createIntegrationNow')}</span>
                  </label>

                  {integrationEnabled ? (
                    <div className="wizard-integration-fields">
                      <label>
                        <span>{t('monitorWizard.provider')}</span>
                        <select
                          value={integrationType}
                          onChange={(event) => setIntegrationType(event.target.value as IntegrationProvider)}
                        >
                          {integrationTypeOptions.map((provider) => (
                            <option key={provider} value={provider}>
                              {formatIntegrationLabel(provider)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>{t('monitorWizard.endpointUrl')}</span>
                        <input
                          type="text"
                          placeholder={t('monitorWizard.endpointUrlPlaceholder')}
                          value={integrationEndpoint}
                          onChange={(event) => setIntegrationEndpoint(event.target.value)}
                        />
                      </label>

                      <label>
                        <span>{t('monitorWizard.customValueOptional')}</span>
                        <input
                          type="text"
                          value={integrationCustomValue}
                          onChange={(event) => setIntegrationCustomValue(event.target.value)}
                          placeholder={t('monitorWizard.customValuePlaceholder')}
                        />
                      </label>

                      <div className="wizard-events-row">
                        <label className="wizard-toggle">
                          <input
                            type="checkbox"
                            checked={integrationEvents.includes('down')}
                            onChange={() => toggleIntegrationEvent('down')}
                          />
                          <span>{t('monitorWizard.downEvents')}</span>
                        </label>
                        <label className="wizard-toggle">
                          <input
                            type="checkbox"
                            checked={integrationEvents.includes('up')}
                            onChange={() => toggleIntegrationEvent('up')}
                          />
                          <span>{t('monitorWizard.upEvents')}</span>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>

                {submitError ? <p className="monitor-wizard-error">{submitError}</p> : null}
              </section>

              <div className="monitor-wizard-actions">
                <button type="button" className="monitor-wizard-secondary-btn" onClick={() => goToStep(1)} disabled={isSubmitting}>
                  {t('common.back')}
                </button>
                <button type="button" className="monitor-wizard-primary-btn" onClick={() => void handleSubmitWizard()} disabled={isSubmitting}>
                  {isSubmitting
                    ? t('common.creating')
                    : t('monitorWizard.createMonitors', { count: enabledMonitors.length })}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <aside className="monitor-wizard-steps-card" aria-label={t('monitorWizard.stepsLabel')}>
          <ol>
            {wizardSteps.map((step, index) => (
              <li
                key={wizardStepKeys[index]}
                className={activeStep === index ? 'active' : ''}
              >
                <button
                  type="button"
                  className="monitor-wizard-step-button"
                  onClick={() => {
                    if (index === 0) goToStep(0);
                    if (index === 1) goToStep(1);
                    if (index === 2) goToStep(2);
                  }}
                >
                  <span className="monitor-wizard-step-index">{index + 1}</span>
                  <span>{step}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}

export default MonitorWizardPage;
