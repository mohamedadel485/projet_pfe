import { ChevronDown, ChevronRight, EyeOff, Trash2, X } from 'lucide-react';
import { RiRepeatLine } from 'react-icons/ri';
import { useEffect, useMemo, useRef, useState } from 'react';
import './NewMonitorPage.css';

interface NewMonitorPageProps {
  onBack: () => void;
  onOpenIntegrationsTeam?: () => void;
}

const intervalOptions = ['30s', '1m', '5m', '30m', '1h', '12h', '12h', '24h'];
const timeoutOptions = ['1s', '15s', '30s', '45s', '60s'];
const httpMethods = ['HEAD', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const ipVersionOptions = ['IPv4 / IPv6 (IPv4 Priority)', 'IPv6 / IPv4 (IPv6 Priority)', 'IPv4 only', 'IPv6 only'];

type MonitorProtocol = 'http' | 'https' | 'ws' | 'wss';
type NewMonitorSideSection = 'details' | 'integrations' | 'maintenance';

interface ProtocolOption {
  value: MonitorProtocol;
  badge: string;
  title: string;
  description: string;
  placeholder: string;
}

const protocolOptions: ProtocolOption[] = [
  {
    value: 'http',
    badge: 'HTTP://',
    title: 'HTTP / website monitoring',
    description: 'Use HTTP monitor to monitor your website, API endpoint, or anything running on HTTP.',
    placeholder: 'http://',
  },
  {
    value: 'https',
    badge: 'HTTPS://',
    title: 'HTTPS / website monitoring',
    description: 'Use HTTPS monitor to monitor your secure website, API endpoint, or HTTPS service.',
    placeholder: 'https://',
  },
  {
    value: 'ws',
    badge: 'WS://',
    title: 'WS / websocket monitoring',
    description: 'Use WebSocket monitor to monitor your WS endpoint and real-time socket availability.',
    placeholder: 'ws://',
  },
  {
    value: 'wss',
    badge: 'WSS://',
    title: 'WSS / websocket monitoring',
    description: 'Use secure WebSocket monitor to monitor your WSS endpoint with encrypted transport.',
    placeholder: 'wss://',
  },
];

function NewMonitorPage({ onBack, onOpenIntegrationsTeam }: NewMonitorPageProps) {
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState(2);
  const [selectedTimeoutIndex, setSelectedTimeoutIndex] = useState(2);
  const [selectedProtocol, setSelectedProtocol] = useState<MonitorProtocol>('http');
  const [isProtocolMenuOpen, setIsProtocolMenuOpen] = useState(false);
  const [isSslDomainOpen, setIsSslDomainOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [sslCheckMode, setSslCheckMode] = useState('disabled');
  const [sslExpiryMode, setSslExpiryMode] = useState('disabled');
  const [domainExpiryMode, setDomainExpiryMode] = useState('disabled');
  const [slowResponseAlert, setSlowResponseAlert] = useState(false);
  const [slowResponseThreshold, setSlowResponseThreshold] = useState('1000');
  const [selectedIpVersion, setSelectedIpVersion] = useState(ipVersionOptions[0]);
  const [followRedirections, setFollowRedirections] = useState(true);
  const [selectedHttpMethod, setSelectedHttpMethod] = useState('HEAD');
  const [sendAsJson, setSendAsJson] = useState(false);
  const [authType, setAuthType] = useState('none');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [requestBody, setRequestBody] = useState('{ "key": "value" }');
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [activeSideSection, setActiveSideSection] = useState<NewMonitorSideSection>('details');
  const protocolMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedIntervalLabel = useMemo(
    () => intervalOptions[selectedIntervalIndex] ?? intervalOptions[2],
    [selectedIntervalIndex],
  );
  const selectedProtocolOption = useMemo(
    () => protocolOptions.find((option) => option.value === selectedProtocol) ?? protocolOptions[0],
    [selectedProtocol],
  );
  const intervalProgress = useMemo(() => {
    if (intervalOptions.length <= 1) return 0;
    return (selectedIntervalIndex / (intervalOptions.length - 1)) * 100;
  }, [selectedIntervalIndex]);
  const timeoutProgress = useMemo(() => {
    if (timeoutOptions.length <= 1) return 0;
    return (selectedTimeoutIndex / (timeoutOptions.length - 1)) * 100;
  }, [selectedTimeoutIndex]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!protocolMenuRef.current) return;
      if (!protocolMenuRef.current.contains(event.target as Node)) {
        setIsProtocolMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  return (
    <section className="new-monitor-page">
      <div className="new-monitor-breadcrumb">
        <button type="button" className="new-monitor-breadcrumb-link" onClick={onBack}>
          Monitoring
        </button>
        <ChevronRight size={14} />
        <span>Monitoring</span>
      </div>

      <div className="new-monitor-content-grid">
        <div className="new-monitor-main">
          <section className="new-monitor-card">
            <div className="new-monitor-type-picker" ref={protocolMenuRef}>
              <div className="new-monitor-type-selector">
                <div className="new-monitor-type-badge">{selectedProtocolOption.badge}</div>
                <div className="new-monitor-type-copy">
                  <h2>{selectedProtocolOption.title}</h2>
                  <p>{selectedProtocolOption.description}</p>
                </div>
                <div className="new-monitor-type-toggle">
                  <button
                    id="new-monitor-protocol"
                    className="new-monitor-type-toggle-button"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isProtocolMenuOpen}
                    aria-label="Select monitor protocol"
                    onClick={() => setIsProtocolMenuOpen((prev) => !prev)}
                  >
                    <ChevronDown size={16} className={isProtocolMenuOpen ? 'open' : ''} />
                  </button>
                </div>
              </div>
              {isProtocolMenuOpen && (
                <div className="new-monitor-type-panel" role="listbox" aria-label="Monitor protocol">
                  {protocolOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selectedProtocol === option.value}
                      className={`new-monitor-type-option ${selectedProtocol === option.value ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedProtocol(option.value);
                        setIsProtocolMenuOpen(false);
                      }}
                    >
                      <span className="new-monitor-type-option-badge">{option.badge}</span>
                      <span className="new-monitor-type-option-copy">
                        <strong>{option.title}</strong>
                        <span>{option.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="new-monitor-separator" />

            <div className="new-monitor-field">
              <label htmlFor="new-monitor-url">URL to monitor</label>
              <input
                id="new-monitor-url"
                className="new-monitor-input"
                type="url"
                placeholder={selectedProtocolOption.placeholder}
              />
            </div>

            <div className="new-monitor-separator" />

            <section className="new-monitor-notify">
              <h3>How will we notify you ?</h3>
              <div className="new-monitor-notify-grid">
                <article className="notify-option">
                  <label>
                    <input type="checkbox" defaultChecked />
                    <span>E-mail</span>
                  </label>
                  <p className="notify-option-value">bnagui@metal2000.fr</p>
                  <p className="notify-option-meta">
                    <span className="notify-repeat-icon-wrap" aria-hidden="true">
                      <RiRepeatLine className="notify-repeat-icon" />
                    </span>
                    <span>No delay, no repeat</span>
                  </p>
                </article>
                <article className="notify-option">
                  <label>
                    <input type="checkbox" />
                    <span>SMS message</span>
                  </label>
                  <a href="#" onClick={(event) => event.preventDefault()}>
                    Add phone number
                  </a>
                  <p className="notify-option-meta">
                    <span className="notify-repeat-icon-wrap" aria-hidden="true">
                      <RiRepeatLine className="notify-repeat-icon" />
                    </span>
                    <span>No delay, no repeat</span>
                  </p>
                </article>
                <article className="notify-option">
                  <label>
                    <input type="checkbox" />
                    <span>Voice call</span>
                  </label>
                  <a href="#" onClick={(event) => event.preventDefault()}>
                    Add phone number
                  </a>
                  <p className="notify-option-meta">
                    <span className="notify-repeat-icon-wrap" aria-hidden="true">
                      <RiRepeatLine className="notify-repeat-icon" />
                    </span>
                    <span>No delay, no repeat</span>
                  </p>
                </article>
                <article className="notify-option">
                  <label>
                    <input type="checkbox" />
                    <span>Mobile push</span>
                  </label>
                  <p className="notify-option-value">
                    Download app for{' '}
                    <a
                      className="notify-inline-link"
                      href="https://apps.apple.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      iOS
                    </a>{' '}
                    or{' '}
                    <a
                      className="notify-inline-link"
                      href="https://play.google.com/store"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Android
                    </a>
                  </p>
                  <p className="notify-option-meta">
                    <span className="notify-repeat-icon-wrap" aria-hidden="true">
                      <RiRepeatLine className="notify-repeat-icon" />
                    </span>
                    <span>No delay, no repeat</span>
                  </p>
                </article>
              </div>
              <p className="notify-option-footnote">
                You can set up notifications for{' '}
                <button
                  type="button"
                  className="notify-inline-action"
                  onClick={() => {
                    onOpenIntegrationsTeam?.();
                  }}
                >
                  Integrations & Team
                </button>{' '}
                in the specific tab and edit it later
              </p>
            </section>
          </section>

          <section className="new-monitor-card">
            <h3>Monitor interval</h3>
            <p className="monitor-interval-description">
              Your monitor will be checked every <strong>{selectedIntervalLabel}</strong>. We recommend to use at least
              1-minute checks 
            </p>

            <div className="monitor-interval-slider-wrap">
              <input
                className="monitor-interval-slider"
                type="range"
                min={0}
                max={intervalOptions.length - 1}
                step={1}
                value={selectedIntervalIndex}
                onChange={(event) => setSelectedIntervalIndex(Number(event.target.value))}
                style={{ ['--range-progress' as string]: `${intervalProgress}%` }}
              />
              <div className="monitor-interval-labels" aria-hidden="true">
                {intervalOptions.map((option, index) => (
                  <span key={`${option}-${index}`}>{option}</span>
                ))}
              </div>
            </div>

            <section className="ssl-domain-panel">
              <div className={`ssl-domain-header ${isSslDomainOpen ? 'open' : 'closed'}`}>
                <button
                  type="button"
                  className="ssl-domain-toggle"
                  onClick={() => setIsSslDomainOpen((prev) => !prev)}
                >
                  <ChevronDown
                    size={15}
                    className={`ssl-domain-toggle-icon ${isSslDomainOpen ? 'open' : 'closed'}`}
                  />
                  <span>SSL certificate and domain checks</span>
                </button>
              </div>

              {isSslDomainOpen && (
                <div className="ssl-domain-options">
                  <div className="ssl-select-item">
                    <label htmlFor="ssl-check-mode" className="ssl-select-label">
                      Check ssl errors
                    </label>
                    <div className="ssl-select-wrap">
                      <select
                        id="ssl-check-mode"
                        className="ssl-select"
                        value={sslCheckMode}
                        onChange={(event) => setSslCheckMode(event.target.value)}
                      >
                        <option value="disabled">Disabled</option>
                        <option value="enabled">Enabled</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>

                  <div className="ssl-select-item">
                    <label htmlFor="ssl-expiry-mode" className="ssl-select-label">
                      SSL expiry reminders
                    </label>
                    <div className="ssl-select-wrap">
                      <select
                        id="ssl-expiry-mode"
                        className="ssl-select"
                        value={sslExpiryMode}
                        onChange={(event) => setSslExpiryMode(event.target.value)}
                      >
                        <option value="disabled">Disabled</option>
                        <option value="enabled">Enabled</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>

                  <div className="ssl-select-item">
                    <label htmlFor="domain-expiry-mode" className="ssl-select-label">
                      Domain expiry reminders
                    </label>
                    <div className="ssl-select-wrap">
                      <select
                        id="domain-expiry-mode"
                        className="ssl-select"
                        value={domainExpiryMode}
                        onChange={(event) => setDomainExpiryMode(event.target.value)}
                      >
                        <option value="disabled">Disabled</option>
                        <option value="enabled">Enabled</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>
                </div>
              )}
            </section>

            <button
              type="button"
              className={`monitor-advanced-row advanced-toggle-row ${isAdvancedOpen ? 'open' : ''}`}
              onClick={() => setIsAdvancedOpen((prev) => !prev)}
            >
              <ChevronDown size={14} className={`advanced-toggle-icon ${isAdvancedOpen ? 'open' : 'closed'}`} />
              <span>Advanced settings</span>
            </button>

            {isAdvancedOpen && (
              <section className="advanced-settings-panel">
                <div className="advanced-block">
                  <h4>Request timeout</h4>
                  <p className="advanced-muted-text">
                    The request timeout is <strong>{timeoutOptions[selectedTimeoutIndex].replace('s', ' seconds')}</strong>
                    . The shorter the timeout the earlier we mark website as down.
                  </p>
                  <div className="advanced-timeout-slider-wrap">
                    <input
                      className="advanced-timeout-slider"
                      type="range"
                      min={0}
                      max={timeoutOptions.length - 1}
                      step={1}
                      value={selectedTimeoutIndex}
                      onChange={(event) => setSelectedTimeoutIndex(Number(event.target.value))}
                      style={{ ['--range-progress' as string]: `${timeoutProgress}%` }}
                    />
                    <div className="advanced-timeout-labels" aria-hidden="true">
                      {timeoutOptions.map((timeout, index) => (
                        <span key={`${timeout}-${index}`}>{timeout}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <label className="advanced-switch-line">
                      <input
                        type="checkbox"
                        className="advanced-switch-input"
                        checked={slowResponseAlert}
                        onChange={(event) => setSlowResponseAlert(event.target.checked)}
                      />
                      <span className="advanced-switch-track" aria-hidden="true" />
                      <span className="advanced-row-title">Slow response time alert</span>
                    </label>
                  </div>
                  <p className="advanced-muted-text">
                    You&apos;ll receive a notification if the response time exceeds your set threshold. Once it drops back
                    below the threshold, you&apos;ll be notified again, and the incident will be marked as resolved.
                  </p>
                  <div className="advanced-threshold-input-wrap">
                    <input
                      className="advanced-threshold-input"
                      type="number"
                      value={slowResponseThreshold}
                      onChange={(event) => setSlowResponseThreshold(event.target.value)}
                      disabled={!slowResponseAlert}
                    />
                    <span>milliseconds</span>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <h4>Internet Protocol version</h4>
                  <p className="advanced-muted-text">
                    Default uses IPv4 first, then IPv6 only if IPv4 isn&apos;t available.
                  </p>
                  <div className="advanced-select-wrap">
                    <select
                      className="advanced-select"
                      value={selectedIpVersion}
                      onChange={(event) => setSelectedIpVersion(event.target.value)}
                    >
                      {ipVersionOptions.map((ipVersion) => (
                        <option key={ipVersion} value={ipVersion}>
                          {ipVersion}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <label className="advanced-switch-line">
                    <input
                      type="checkbox"
                      className="advanced-switch-input"
                      checked={followRedirections}
                      onChange={(event) => setFollowRedirections(event.target.checked)}
                    />
                    <span className="advanced-switch-track" aria-hidden="true" />
                    <span className="advanced-row-title">Follow redirections</span>
                  </label>
                  <p className="advanced-muted-text">If disabled, we return redirections HTTP codes (3xx).</p>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>Up HTTP status codes</h4>
                  </div>
                  <p className="advanced-muted-text">
                    We will create incident when we receive HTTP status code other than defined below.
                  </p>
                  <div className="advanced-status-codes-box">
                    <button type="button" className="status-code-chip success">
                      <span>2xx</span>
                      <X size={12} />
                    </button>
                    <button type="button" className="status-code-chip info">
                      <span>3xx</span>
                      <X size={12} />
                    </button>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-auth-head">
                    <h4>Auth. type</h4>
                    <h4>Auth. credentials</h4>
                  </div>
                  <div className="advanced-auth-grid">
                    <div className="advanced-select-wrap">
                      <select
                        className="advanced-select"
                        value={authType}
                        onChange={(event) => setAuthType(event.target.value)}
                      >
                        <option value="none">None</option>
                        <option value="basic">Basic</option>
                        <option value="bearer">Bearer Token</option>
                      </select>
                      <ChevronDown size={14} />
                    </div>
                    <input
                      className="advanced-input"
                      type="text"
                      placeholder="Username"
                      value={authUsername}
                      onChange={(event) => setAuthUsername(event.target.value)}
                    />
                    <div className="advanced-password-wrap">
                      <input
                        className="advanced-input"
                        type="password"
                        placeholder="Password"
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                      />
                      <EyeOff size={15} />
                    </div>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>HTTP method</h4>
                  </div>
                  <p className="advanced-muted-text">
                    We suggest using HEAD as it is lighter unless there is a reason to use any specific method.
                  </p>
                  <div className="advanced-methods-tabs">
                    {httpMethods.map((method) => (
                      <button
                        key={method}
                        type="button"
                        className={`advanced-method-tab ${selectedHttpMethod === method ? 'active' : ''}`}
                        onClick={() => setSelectedHttpMethod(method)}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>Request body</h4>
                  </div>
                  <textarea
                    className="advanced-textarea"
                    value={requestBody}
                    onChange={(event) => setRequestBody(event.target.value)}
                  />
                  <label className="advanced-switch-line advanced-switch-inline-gap">
                    <input
                      type="checkbox"
                      className="advanced-switch-input"
                      checked={sendAsJson}
                      onChange={(event) => setSendAsJson(event.target.checked)}
                    />
                    <span className="advanced-switch-track" aria-hidden="true" />
                    <span className="advanced-row-title">Send as JSON (application/json)</span>
                  </label>
                  <p className="advanced-muted-text">
                    Data will be sent as a standard POST (application/x-www-form-urlencoded) unless you check the JSON
                    option.
                  </p>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>Request headers</h4>
                  </div>
                  <div className="advanced-headers-grid">
                    <input
                      className="advanced-input"
                      type="text"
                      placeholder="Header key"
                      value={headerKey}
                      onChange={(event) => setHeaderKey(event.target.value)}
                    />
                    <input
                      className="advanced-input"
                      type="text"
                      placeholder="Header value"
                      value={headerValue}
                      onChange={(event) => setHeaderValue(event.target.value)}
                    />
                    <button type="button" className="advanced-header-delete" aria-label="Delete header row">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </section>
            )}

            <div className="new-monitor-field tags-field">
              <label htmlFor="new-monitor-tags">Add tags</label>
              <p className="tag-help">
                Optional. We use this to group monitors, so you are able to easily manage them in bulk or organize on
                status pages.
              </p>
              <input id="new-monitor-tags" className="new-monitor-input" type="text" placeholder="Add tag ..." />
            </div>
          </section>

          <section className="new-monitor-submit-card">
            <button type="button">Create monitor</button>
          </section>
        </div>

        <aside className="new-monitor-side-card">
          <button
            type="button"
            className={`new-monitor-side-title-link ${activeSideSection === 'details' ? 'active' : ''}`}
            onClick={() => {
              setActiveSideSection('details');
            }}
          >
            Monitor details
          </button>
          <button
            type="button"
            className={`new-monitor-side-link ${activeSideSection === 'integrations' ? 'active' : ''}`}
            onClick={() => {
              setActiveSideSection('integrations');
              onOpenIntegrationsTeam?.();
            }}
          >
            Integrations & Team
          </button>
          <button
            type="button"
            className={`new-monitor-side-link ${activeSideSection === 'maintenance' ? 'active' : ''}`}
            onClick={() => {
              setActiveSideSection('maintenance');
            }}
          >
            Maintenance info
          </button>
        </aside>
      </div>
    </section>
  );
}

export default NewMonitorPage;
