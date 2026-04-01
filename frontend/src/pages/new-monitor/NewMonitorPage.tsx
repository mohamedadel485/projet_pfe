import { ChevronDown, ChevronRight, EyeOff, Trash2, X } from 'lucide-react';
import { RiRepeatLine } from 'react-icons/ri';
import { useEffect, useMemo, useRef, useState } from 'react';
import './NewMonitorPage.css';

type MonitorAuthType = 'none' | 'basic' | 'bearer';
type MonitorIpVersion = 'IPv4 / IPv6 (IPv4 Priority)' | 'IPv6 / IPv4 (IPv6 Priority)' | 'IPv4 only' | 'IPv6 only';
type MonitorUpStatusCodeGroup = '2xx' | '3xx';

interface NewMonitorPageProps {
  onBack: () => void;
  onCreateMonitor?: (payload: {
    name: string;
    url: string;
    type: MonitorProtocol;
    interval: number;
    timeout: number;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
    domainExpiryMode?: 'enabled' | 'disabled';
    sslExpiryMode?: 'enabled' | 'disabled';
    body?: string;
    headers?: Record<string, string>;
  }) => Promise<string | null>;
  initialName?: string;
  initialUrl?: string;
  initialProtocol?: 'http' | 'https' | 'ws' | 'wss';
  initialIntervalSeconds?: number;
  initialTimeoutSeconds?: number;
  initialHttpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  initialDomainExpiryMode?: 'enabled' | 'disabled';
  initialSslExpiryMode?: 'enabled' | 'disabled';
  initialSslCheckMode?: 'enabled' | 'disabled';
  initialTagsText?: string;
  initialSlowResponseAlert?: boolean;
  initialSlowResponseThresholdMs?: number;
  initialIpVersion?: MonitorIpVersion;
  initialFollowRedirections?: boolean;
  initialAuthType?: MonitorAuthType;
  initialAuthUsername?: string;
  initialAuthPassword?: string;
  initialRequestBody?: string;
  initialSendAsJson?: boolean;
  initialHeaderKey?: string;
  initialHeaderValue?: string;
  initialUpStatusCodeGroups?: MonitorUpStatusCodeGroup[];
}

const intervalOptions = ['30s', '1m', '5m', '30m', '1h', '12h', '12h', '24h'];
const timeoutOptions = ['1s', '15s', '30s', '45s', '60s'];
const httpMethods = ['HEAD', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const ipVersionOptions: MonitorIpVersion[] = [
  'IPv4 / IPv6 (IPv4 Priority)',
  'IPv6 / IPv4 (IPv6 Priority)',
  'IPv4 only',
  'IPv6 only',
];
const DEFAULT_REQUEST_BODY_TEMPLATE = '{ "key": "value" }';
const DEFAULT_UP_STATUS_CODE_GROUPS: MonitorUpStatusCodeGroup[] = ['2xx', '3xx'];

type MonitorProtocol = 'http' | 'https' | 'ws' | 'wss';
type MonitorExpiryMode = 'enabled' | 'disabled';
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

const protocolPrefixes: Record<MonitorProtocol, string> = {
  http: 'http://',
  https: 'https://',
  ws: 'ws://',
  wss: 'wss://',
};

const parseIntervalToMinutes = (label: string): number => {
  const numericValue = Number.parseInt(label, 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 5;

  if (label.endsWith('s')) {
    return Math.max(1, Math.ceil(numericValue / 60));
  }

  if (label.endsWith('h')) {
    return numericValue * 60;
  }

  return numericValue;
};

const parseIntervalToSeconds = (label: string): number => {
  const numericValue = Number.parseInt(label, 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 5 * 60;

  if (label.endsWith('s')) {
    return numericValue;
  }

  if (label.endsWith('h')) {
    return numericValue * 60 * 60;
  }

  return numericValue * 60;
};

const parseTimeoutToSeconds = (label: string): number => {
  const numericValue = Number.parseInt(label, 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 30;
  return numericValue;
};

const findClosestOptionIndex = (
  options: string[],
  targetValue: number | undefined,
  parser: (label: string) => number,
  fallbackIndex: number,
): number => {
  if (!Number.isFinite(targetValue)) {
    return fallbackIndex;
  }

  let bestIndex = fallbackIndex;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [index, option] of options.entries()) {
    const distance = Math.abs(parser(option) - Number(targetValue));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
};

const mapHttpMethod = (method: string): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' => {
  if (method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'HEAD') {
    return method;
  }

  return 'HEAD';
};

const normalizeIpVersionOption = (value?: string): MonitorIpVersion =>
  ipVersionOptions.find((option) => option === value) ?? ipVersionOptions[0];

const hasInitialAdvancedPrefill = (input: {
  timeoutSeconds?: number;
  slowResponseAlert?: boolean;
  slowResponseThresholdMs?: number;
  ipVersion?: MonitorIpVersion;
  followRedirections?: boolean;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  authType?: MonitorAuthType;
  authUsername?: string;
  authPassword?: string;
  requestBody?: string;
  sendAsJson?: boolean;
  headerKey?: string;
  headerValue?: string;
  upStatusCodeGroups?: MonitorUpStatusCodeGroup[];
}): boolean =>
  Boolean(
    input.timeoutSeconds !== undefined ||
      input.slowResponseAlert ||
      input.slowResponseThresholdMs !== undefined ||
      (input.ipVersion && input.ipVersion !== ipVersionOptions[0]) ||
      input.followRedirections === false ||
      (input.httpMethod && input.httpMethod !== 'HEAD') ||
      (input.authType && input.authType !== 'none') ||
      input.authUsername ||
      input.authPassword ||
      input.requestBody ||
      input.sendAsJson ||
      input.headerKey ||
      input.headerValue ||
      (input.upStatusCodeGroups &&
        (input.upStatusCodeGroups.length !== DEFAULT_UP_STATUS_CODE_GROUPS.length ||
          input.upStatusCodeGroups.some((group, index) => group !== DEFAULT_UP_STATUS_CODE_GROUPS[index]))),
  );

const encodeBase64 = (value: string): string => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value);
  }

  return btoa(value);
};

function NewMonitorPage({
  onBack,
  onCreateMonitor,
  initialName,
  initialUrl,
  initialProtocol,
  initialIntervalSeconds,
  initialTimeoutSeconds,
  initialHttpMethod,
  initialDomainExpiryMode,
  initialSslExpiryMode,
  initialSslCheckMode,
  initialTagsText,
  initialSlowResponseAlert,
  initialSlowResponseThresholdMs,
  initialIpVersion,
  initialFollowRedirections,
  initialAuthType,
  initialAuthUsername,
  initialAuthPassword,
  initialRequestBody,
  initialSendAsJson,
  initialHeaderKey,
  initialHeaderValue,
  initialUpStatusCodeGroups,
}: NewMonitorPageProps) {
  const initialMonitorUrl = initialUrl ?? protocolPrefixes[initialProtocol ?? 'https'];
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState(() =>
    findClosestOptionIndex(intervalOptions, initialIntervalSeconds, parseIntervalToSeconds, 2),
  );
  const [selectedTimeoutIndex, setSelectedTimeoutIndex] = useState(() =>
    findClosestOptionIndex(timeoutOptions, initialTimeoutSeconds, parseTimeoutToSeconds, 2),
  );
  const [selectedProtocol, setSelectedProtocol] = useState<MonitorProtocol>(initialProtocol ?? 'https');
  const [monitorName, setMonitorName] = useState(initialName ?? '');
  const [monitorUrl, setMonitorUrl] = useState(initialMonitorUrl);
  const [isProtocolMenuOpen, setIsProtocolMenuOpen] = useState(false);
  const [isSslDomainOpen, setIsSslDomainOpen] = useState(
    () =>
      initialSslCheckMode === 'enabled' ||
      initialSslExpiryMode === 'enabled' ||
      initialDomainExpiryMode === 'enabled',
  );
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(() =>
    hasInitialAdvancedPrefill({
      timeoutSeconds: initialTimeoutSeconds,
      slowResponseAlert: initialSlowResponseAlert,
      slowResponseThresholdMs: initialSlowResponseThresholdMs,
      ipVersion: initialIpVersion,
      followRedirections: initialFollowRedirections,
      httpMethod: initialHttpMethod,
      authType: initialAuthType,
      authUsername: initialAuthUsername,
      authPassword: initialAuthPassword,
      requestBody: initialRequestBody,
      sendAsJson: initialSendAsJson,
      headerKey: initialHeaderKey,
      headerValue: initialHeaderValue,
      upStatusCodeGroups: initialUpStatusCodeGroups,
    }),
  );
  const [sslCheckMode, setSslCheckMode] = useState<MonitorExpiryMode>(initialSslCheckMode ?? 'disabled');
  const [sslExpiryMode, setSslExpiryMode] = useState<MonitorExpiryMode>(initialSslExpiryMode ?? 'disabled');
  const [domainExpiryMode, setDomainExpiryMode] = useState<MonitorExpiryMode>(initialDomainExpiryMode ?? 'disabled');
  const [slowResponseAlert, setSlowResponseAlert] = useState(
    Boolean(initialSlowResponseAlert ?? (initialSlowResponseThresholdMs !== undefined)),
  );
  const [slowResponseThreshold, setSlowResponseThreshold] = useState(
    initialSlowResponseThresholdMs !== undefined ? String(initialSlowResponseThresholdMs) : '1000',
  );
  const [selectedIpVersion, setSelectedIpVersion] = useState<MonitorIpVersion>(() =>
    normalizeIpVersionOption(initialIpVersion),
  );
  const [followRedirections, setFollowRedirections] = useState(initialFollowRedirections ?? true);
  const [selectedHttpMethod, setSelectedHttpMethod] = useState<string>(initialHttpMethod ?? 'HEAD');
  const [sendAsJson, setSendAsJson] = useState(initialSendAsJson ?? false);
  const [authType, setAuthType] = useState<MonitorAuthType>(initialAuthType ?? 'none');
  const [authUsername, setAuthUsername] = useState(initialAuthUsername ?? '');
  const [authPassword, setAuthPassword] = useState(initialAuthPassword ?? '');
  const [requestBody, setRequestBody] = useState(initialRequestBody ?? DEFAULT_REQUEST_BODY_TEMPLATE);
  const [headerKey, setHeaderKey] = useState(initialHeaderKey ?? '');
  const [headerValue, setHeaderValue] = useState(initialHeaderValue ?? '');
  const [selectedUpStatusCodeGroups, setSelectedUpStatusCodeGroups] = useState<MonitorUpStatusCodeGroup[]>(
    initialUpStatusCodeGroups && initialUpStatusCodeGroups.length > 0
      ? initialUpStatusCodeGroups
      : DEFAULT_UP_STATUS_CODE_GROUPS,
  );
  const [tagsText, setTagsText] = useState(initialTagsText ?? '');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeSideSection, setActiveSideSection] = useState<NewMonitorSideSection>('details');
  const protocolMenuRef = useRef<HTMLDivElement | null>(null);
  const detailsSectionRef = useRef<HTMLElement | null>(null);
  const integrationsSectionRef = useRef<HTMLElement | null>(null);
  const maintenanceSectionRef = useRef<HTMLElement | null>(null);
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

  const toggleProtocolMenu = () => {
    setIsProtocolMenuOpen((prev) => !prev);
  };

  const toggleUpStatusCodeGroup = (group: MonitorUpStatusCodeGroup) => {
    setSelectedUpStatusCodeGroups((current) =>
      current.includes(group) ? current.filter((candidate) => candidate !== group) : [...current, group],
    );
  };

  const updateUrlForProtocol = (nextProtocol: MonitorProtocol) => {
    const nextPrefix = protocolPrefixes[nextProtocol];
    setMonitorUrl((previous) => {
      const trimmed = previous.trim();
      if (trimmed === '') {
        return nextPrefix;
      }
      const allPrefixes = Object.values(protocolPrefixes);
      if (allPrefixes.includes(trimmed)) {
        return nextPrefix;
      }
      for (const prefix of allPrefixes) {
        if (trimmed.startsWith(prefix)) {
          return `${nextPrefix}${trimmed.slice(prefix.length)}`;
        }
      }
      return previous;
    });
  };

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

  const isCreateDisabled = monitorName.trim() === '' || monitorUrl.trim() === '' || isCreating;

  const handleCreateMonitor = async () => {
    if (isCreateDisabled || !onCreateMonitor) return;

    setCreateError(null);
    setIsCreating(true);

    const selectedInterval = intervalOptions[selectedIntervalIndex] ?? intervalOptions[2];
    const selectedTimeout = timeoutOptions[selectedTimeoutIndex] ?? timeoutOptions[2];
    const httpMethod = mapHttpMethod(selectedHttpMethod);
    const resolvedHeaders: Record<string, string> = {};
    const cleanedHeaderKey = headerKey.trim();
    const cleanedHeaderValue = headerValue.trim();
    const cleanedUsername = authUsername.trim();
    const cleanedPassword = authPassword.trim();
    const cleanedRequestBody = requestBody.trim();

    if (cleanedHeaderKey !== '') {
      resolvedHeaders[cleanedHeaderKey] = cleanedHeaderValue;
    }

    if (sendAsJson && !Object.keys(resolvedHeaders).some((key) => key.toLowerCase() === 'content-type')) {
      resolvedHeaders['Content-Type'] = 'application/json';
    }

    if (authType === 'basic' && (cleanedUsername !== '' || cleanedPassword !== '')) {
      resolvedHeaders.Authorization = `Basic ${encodeBase64(`${cleanedUsername}:${cleanedPassword}`)}`;
    }

    if (authType === 'bearer') {
      const token = cleanedPassword !== '' ? cleanedPassword : cleanedUsername;
      if (token !== '') {
        resolvedHeaders.Authorization = `Bearer ${token}`;
      }
    }

    const shouldSendBody =
      (httpMethod === 'POST' || httpMethod === 'PUT') &&
      cleanedRequestBody !== '' &&
      (cleanedRequestBody !== DEFAULT_REQUEST_BODY_TEMPLATE || initialRequestBody !== undefined);

    const error = await onCreateMonitor({
      name: monitorName.trim(),
      url: monitorUrl.trim(),
      type: selectedProtocol,
      interval: parseIntervalToMinutes(selectedInterval),
      timeout: parseTimeoutToSeconds(selectedTimeout),
      httpMethod,
      domainExpiryMode: domainExpiryMode === 'enabled' ? 'enabled' : 'disabled',
      sslExpiryMode: sslExpiryMode === 'enabled' ? 'enabled' : 'disabled',
      body: shouldSendBody ? requestBody : undefined,
      headers: Object.keys(resolvedHeaders).length > 0 ? resolvedHeaders : undefined,
    });

    if (error) {
      setCreateError(error);
      setIsCreating(false);
      return;
    }

    setIsCreating(false);
    setCreateError(null);
  };

  const scrollToSection = (section: NewMonitorSideSection) => {
    setActiveSideSection(section);
    const target =
      section === 'details'
        ? detailsSectionRef.current
        : section === 'integrations'
          ? integrationsSectionRef.current
          : maintenanceSectionRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          <section className="new-monitor-card" ref={detailsSectionRef}>
            <div className="new-monitor-type-picker" ref={protocolMenuRef}>
              <div
                className="new-monitor-type-selector"
                role="button"
                tabIndex={0}
                aria-haspopup="listbox"
                aria-expanded={isProtocolMenuOpen}
                onClick={toggleProtocolMenu}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleProtocolMenu();
                  }
                }}
              >
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
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleProtocolMenu();
                    }}
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
                        updateUrlForProtocol(option.value);
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
              <label htmlFor="new-monitor-name">Monitor name</label>
              <input
                id="new-monitor-name"
                className="new-monitor-input"
                type="text"
                placeholder="My service"
                value={monitorName}
                onChange={(event) => setMonitorName(event.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="new-monitor-separator" />

            <div className="new-monitor-field">
              <label htmlFor="new-monitor-url">URL to monitor</label>
              <input
                id="new-monitor-url"
                className="new-monitor-input"
                type="url"
                placeholder={selectedProtocolOption.placeholder}
                value={monitorUrl}
                onChange={(event) => setMonitorUrl(event.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="new-monitor-separator" />

            <section className="new-monitor-notify" ref={integrationsSectionRef}>
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
                    scrollToSection('integrations');
                  }}
                >
                  Integrations & Team
                </button>{' '}
                in the specific tab and edit it later
              </p>
            </section>
          </section>

          <section className="new-monitor-card" ref={maintenanceSectionRef}>
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
                        onChange={(event) => setSslCheckMode(event.target.value === 'enabled' ? 'enabled' : 'disabled')}
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
                        onChange={(event) => setSslExpiryMode(event.target.value === 'enabled' ? 'enabled' : 'disabled')}
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
                        onChange={(event) =>
                          setDomainExpiryMode(event.target.value === 'enabled' ? 'enabled' : 'disabled')
                        }
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
                      onChange={(event) => setSelectedIpVersion(normalizeIpVersionOption(event.target.value))}
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
                    <button
                      type="button"
                      className={`status-code-chip success ${selectedUpStatusCodeGroups.includes('2xx') ? 'is-selected' : 'is-unselected'}`}
                      aria-pressed={selectedUpStatusCodeGroups.includes('2xx')}
                      onClick={() => toggleUpStatusCodeGroup('2xx')}
                    >
                      <span>2xx</span>
                      <X size={12} />
                    </button>
                    <button
                      type="button"
                      className={`status-code-chip info ${selectedUpStatusCodeGroups.includes('3xx') ? 'is-selected' : 'is-unselected'}`}
                      aria-pressed={selectedUpStatusCodeGroups.includes('3xx')}
                      onClick={() => toggleUpStatusCodeGroup('3xx')}
                    >
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
                        onChange={(event) =>
                          setAuthType(
                            event.target.value === 'basic'
                              ? 'basic'
                              : event.target.value === 'bearer'
                                ? 'bearer'
                                : 'none',
                          )
                        }
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
              <input
                id="new-monitor-tags"
                className="new-monitor-input"
                type="text"
                placeholder="Add tag ..."
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </div>
          </section>

          <section className="new-monitor-submit-card">
            {createError ? <p className="new-monitor-submit-error">{createError}</p> : null}
            <button type="button" onClick={handleCreateMonitor} disabled={isCreateDisabled}>
              {isCreating ? 'Creating...' : 'Create monitor'}
            </button>
          </section>
        </div>

        <aside className="new-monitor-side-card">
          <button
            type="button"
            className={`new-monitor-side-title-link ${activeSideSection === 'details' ? 'active' : ''}`}
            onClick={() => {
              scrollToSection('details');
            }}
          >
            Monitor details
          </button>
          <button
            type="button"
            className={`new-monitor-side-link ${activeSideSection === 'integrations' ? 'active' : ''}`}
            onClick={() => {
              scrollToSection('integrations');
            }}
          >
            Integrations & Team
          </button>
          <button
            type="button"
            className={`new-monitor-side-link ${activeSideSection === 'maintenance' ? 'active' : ''}`}
            onClick={() => {
              scrollToSection('maintenance');
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
