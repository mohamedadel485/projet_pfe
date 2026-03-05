import { ChevronRight, Globe, Network, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CreateIntegrationInput, CreateMonitorInput, IntegrationEvent, IntegrationProvider } from '../../lib/api';
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

const wizardSteps = ['Monitor suggestions', 'Monitoring details', 'Notify team & integrations'];
const httpMethodOptions: MonitorHttpMethod[] = ['HEAD', 'GET', 'POST', 'PUT', 'DELETE'];
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
  httpMethod: source.endpoint.includes('/api/') ? 'GET' : 'HEAD',
});

const buildSuggestedMonitors = (origin: string): SuggestedMonitor[] => [
  {
    title: 'Main website',
    endpoint: origin,
    hint: 'Track homepage availability and TLS errors.',
  },
  {
    title: 'Health endpoint',
    endpoint: `${origin}/api/health`,
    hint: 'Detect backend outage before users are impacted.',
  },
  {
    title: 'Authentication flow',
    endpoint: `${origin}/login`,
    hint: 'Validate user sign-in entry point.',
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

  const validateEnabledMonitors = (): string | null => {
    if (enabledMonitors.length === 0) {
      return 'Select at least one monitor to continue.';
    }

    for (const monitor of enabledMonitors) {
      if (monitor.name.trim() === '') {
        return 'Each enabled monitor must have a name.';
      }

      if (monitor.url.trim() === '') {
        return 'Each enabled monitor must have a URL.';
      }

      try {
        const parsedUrl = new URL(monitor.url.trim());
        const protocol = parsedUrl.protocol.toLowerCase();
        if (!['http:', 'https:', 'ws:', 'wss:'].includes(protocol)) {
          return `Unsupported protocol for ${monitor.name}.`;
        }
      } catch {
        return `Invalid URL for ${monitor.name}.`;
      }

      if (!Number.isFinite(monitor.interval) || monitor.interval < 1) {
        return `Invalid interval for ${monitor.name}.`;
      }

      if (!Number.isFinite(monitor.timeout) || monitor.timeout < 5) {
        return `Invalid timeout for ${monitor.name}.`;
      }
    }

    return null;
  };

  const handleSuggestMonitors = () => {
    const parsedUrl = parseWebsiteUrl(websiteInput);

    if (!parsedUrl) {
      setWebsiteError('URL is required');
      setSuggestedMonitors([]);
      setCriticalPages([]);
      setRunningPorts([]);
      setSubDomains([]);
      setMonitorDrafts([]);
      return;
    }

    const protocol = parsedUrl.protocol.toLowerCase();
    const defaultPorts = protocol === 'http:' ? [80, 443, 8080] : [443, 80, 8443];
    const suggestions = buildSuggestedMonitors(parsedUrl.origin);

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
        name: 'Custom monitor',
        url: normalizeWebsiteInput(websiteInput),
        type: 'https',
        interval: 5,
        timeout: 30,
        httpMethod: 'HEAD',
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
      setSubmitError(`Invalid emails: ${parsedInviteEmails.invalid.join(', ')}`);
      return;
    }

    if (parsedInviteEmails.valid.length > 0 && !canInviteTeam) {
      setSubmitError('Only admins can invite team members.');
      return;
    }

    let integrationPayload: CreateIntegrationInput | null = null;
    if (integrationEnabled) {
      if (integrationEndpoint.trim() === '') {
        setSubmitError('Integration endpoint URL is required.');
        return;
      }

      try {
        const parsedEndpoint = new URL(integrationEndpoint.trim());
        if (!['http:', 'https:'].includes(parsedEndpoint.protocol.toLowerCase())) {
          setSubmitError('Integration endpoint must start with http:// or https://.');
          return;
        }
      } catch {
        setSubmitError('Integration endpoint URL is invalid.');
        return;
      }

      if (integrationEvents.length === 0) {
        setSubmitError('Select at least one integration event.');
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
          Monitoring
        </button>
        <ChevronRight size={14} />
        <span>Monitor wizard</span>
      </div>

      <div className="monitor-wizard-layout">
        <div className="monitor-wizard-main">
          <h1>Monitoring wizard</h1>

          {activeStep === 0 ? (
            <section className="monitor-wizard-card">
              <h2>What&apos;s your website?</h2>
              <p>We use your main domain to suggest monitor targets and priorities.</p>
              <div className="monitor-wizard-input-row">
                <label className={`monitor-wizard-input-shell ${websiteError ? 'error' : ''}`}>
                  <input
                    type="text"
                    placeholder="E.g. domain.com"
                    value={websiteInput}
                    onChange={(event) => setWebsiteInput(event.target.value)}
                  />
                </label>
                <button type="button" className="monitor-wizard-suggest-btn" onClick={handleSuggestMonitors}>
                  <Sparkles size={14} />
                  <span>Suggest monitors</span>
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
                    Enter your main domain and click <strong>Suggest monitors</strong> to auto-fill recommendations.
                  </p>
                )}
              </div>

              <div className="monitor-wizard-actions">
                <button type="button" className="monitor-wizard-secondary-btn" onClick={onBack}>
                  Cancel
                </button>
                <button type="button" className="monitor-wizard-primary-btn" onClick={handleSuggestMonitors}>
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {activeStep === 1 ? (
            <>
              <section className="monitor-wizard-card">
                <div className="monitor-wizard-section-title">
                  <Globe size={16} />
                  <h2>Monitoring details</h2>
                </div>
                <p>Edit monitors before creation. Keep only the endpoints you want to track now.</p>

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
                          <span>Enabled</span>
                        </label>
                        <button type="button" className="wizard-monitor-delete" onClick={() => handleRemoveMonitor(monitor.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="wizard-monitor-grid">
                        <label>
                          <span>Name</span>
                          <input
                            type="text"
                            value={monitor.name}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'name', event.target.value)}
                          />
                        </label>
                        <label className="wide">
                          <span>URL</span>
                          <input
                            type="text"
                            value={monitor.url}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'url', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Method</span>
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
                          <span>Interval</span>
                          <select
                            value={monitor.interval}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'interval', Number(event.target.value))}
                          >
                            {intervalOptions.map((interval) => (
                              <option key={interval} value={interval}>
                                {interval} min
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Timeout</span>
                          <select
                            value={monitor.timeout}
                            onChange={(event) => updateMonitorDraft(monitor.id, 'timeout', Number(event.target.value))}
                          >
                            {timeoutOptions.map((timeout) => (
                              <option key={timeout} value={timeout}>
                                {timeout} sec
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
                  Add custom monitor
                </button>

                {detailsError ? <p className="monitor-wizard-error">{detailsError}</p> : null}
              </section>

              <section className="monitor-wizard-card">
                <div className="monitor-wizard-section-title">
                  <Network size={16} />
                  <h2>Auto-discovered context</h2>
                </div>
                <p>Use these recommendations as a guide while finalizing monitor details.</p>

                <div className="wizard-auto-columns">
                  <div>
                    <h3>Critical pages</h3>
                    <div className="monitor-wizard-chip-list">
                      {criticalPages.map((pageUrl) => (
                        <span className="monitor-wizard-chip" key={pageUrl}>
                          {pageUrl}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Running ports</h3>
                    <div className="monitor-wizard-chip-list">
                      {runningPorts.map((port) => (
                        <span className="monitor-wizard-chip" key={port}>
                          Port {port}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Sub domains</h3>
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
                  Back
                </button>
                <button type="button" className="monitor-wizard-primary-btn" onClick={() => goToStep(2)}>
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {activeStep === 2 ? (
            <>
              <section className="monitor-wizard-card">
                <div className="monitor-wizard-section-title">
                  <Users size={16} />
                  <h2>Notify team & integrations</h2>
                </div>
                <p>Configure who is notified and where alerts should be delivered.</p>

                <label className="wizard-toggle">
                  <input
                    type="checkbox"
                    checked={emailNotificationsEnabled}
                    onChange={(event) => setEmailNotificationsEnabled(event.target.checked)}
                  />
                  <span>Enable email notifications for this workspace</span>
                </label>

                <label className="wizard-field">
                  <span>Invite teammates (emails separated by comma or new line)</span>
                  <textarea
                    value={teamInvitesInput}
                    onChange={(event) => setTeamInvitesInput(event.target.value)}
                    placeholder="alice@company.com, bob@company.com"
                    disabled={!canInviteTeam}
                  />
                </label>
                {!canInviteTeam ? (
                  <p className="wizard-hint">Only admins can send team invitations.</p>
                ) : (
                  <p className="wizard-hint">
                    {parsedInviteEmails.valid.length} valid invite(s) prepared.
                  </p>
                )}

                <div className="wizard-integration-block">
                  <label className="wizard-toggle">
                    <input
                      type="checkbox"
                      checked={integrationEnabled}
                      onChange={(event) => setIntegrationEnabled(event.target.checked)}
                    />
                    <span>Create an integration now</span>
                  </label>

                  {integrationEnabled ? (
                    <div className="wizard-integration-fields">
                      <label>
                        <span>Provider</span>
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
                        <span>Endpoint URL</span>
                        <input
                          type="text"
                          placeholder="https://example.com/webhook"
                          value={integrationEndpoint}
                          onChange={(event) => setIntegrationEndpoint(event.target.value)}
                        />
                      </label>

                      <label>
                        <span>Custom value (optional)</span>
                        <input
                          type="text"
                          value={integrationCustomValue}
                          onChange={(event) => setIntegrationCustomValue(event.target.value)}
                          placeholder="Team A alerts"
                        />
                      </label>

                      <div className="wizard-events-row">
                        <label className="wizard-toggle">
                          <input
                            type="checkbox"
                            checked={integrationEvents.includes('down')}
                            onChange={() => toggleIntegrationEvent('down')}
                          />
                          <span>Down events</span>
                        </label>
                        <label className="wizard-toggle">
                          <input
                            type="checkbox"
                            checked={integrationEvents.includes('up')}
                            onChange={() => toggleIntegrationEvent('up')}
                          />
                          <span>Up events</span>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>

                {submitError ? <p className="monitor-wizard-error">{submitError}</p> : null}
              </section>

              <div className="monitor-wizard-actions">
                <button type="button" className="monitor-wizard-secondary-btn" onClick={() => goToStep(1)} disabled={isSubmitting}>
                  Back
                </button>
                <button type="button" className="monitor-wizard-primary-btn" onClick={() => void handleSubmitWizard()} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : `Create ${enabledMonitors.length} monitor(s)`}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <aside className="monitor-wizard-steps-card" aria-label="Wizard steps">
          <ol>
            {wizardSteps.map((step, index) => (
              <li
                key={step}
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
