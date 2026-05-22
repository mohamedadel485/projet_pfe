import { ChevronRight, Download, FileUp, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import type { CreateIntegrationInput, CreateMonitorInput, IntegrationEvent, IntegrationProvider } from '../../lib/api';
import './BulkUploadPage.css';

type BulkStep = 0 | 1 | 2;
type MonitorHttpMethod = NonNullable<CreateMonitorInput['httpMethod']>;

interface BulkUploadMonitorDraft {
  id: string;
  name: string;
  url: string;
  type: CreateMonitorInput['type'];
  interval: number;
  timeout: number;
  httpMethod: MonitorHttpMethod;
}

export interface BulkUploadSubmission {
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

interface BulkUploadPageProps {
  onBack: () => void;
  canInviteTeam: boolean;
  onSubmitBulkUpload: (payload: BulkUploadSubmission) => Promise<string | null>;
}

const bulkSteps = ['Import monitors', 'Review', 'Notify team member / Integrations'];
const methodOptions: MonitorHttpMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'];
const monitorTypeOptions: Array<CreateMonitorInput['type']> = ['http', 'https', 'ws', 'wss'];
const intervalOptions = [1, 5, 10, 30, 60];
const timeoutOptions = [5, 15, 30, 45, 60];
const integrationTypeOptions: IntegrationProvider[] = ['webhook', 'slack', 'telegram'];
const maxFileSize = 10 * 1024 * 1024;

const normalizeHeader = (value: string): string =>
  value.toLowerCase().replace(/\ufeff/g, '').replace(/[^a-z0-9]+/g, '').trim();

const normalizeWebsiteInput = (value: string): string => {
  const trimmedValue = value.trim();
  if (trimmedValue === '') return '';
  if (/^(https?|wss?):\/\//i.test(trimmedValue)) return trimmedValue;
  return `https://${trimmedValue}`;
};

const inferTypeFromUrl = (targetUrl: string): CreateMonitorInput['type'] => {
  if (targetUrl.startsWith('ws://')) return 'ws';
  if (targetUrl.startsWith('wss://')) return 'wss';
  if (targetUrl.startsWith('http://')) return 'http';
  return 'https';
};

const buildMonitorNameFromUrl = (targetUrl: string, fallbackIndex: number): string => {
  try {
    const parsedUrl = new URL(targetUrl);
    const path = parsedUrl.pathname && parsedUrl.pathname !== '/' ? parsedUrl.pathname : '';
    return `${parsedUrl.hostname}${path}`.slice(0, 80);
  } catch {
    return `Monitor ${fallbackIndex}`;
  }
};

const splitDelimitedLine = (line: string, delimiter: string): string[] => {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (insideQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  values.push(currentValue.trim());
  return values;
};

const parseValueAsInt = (rawValue: string, fallback: number): number => {
  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue)) return fallback;
  return parsedValue;
};

const parseCsvText = (csvText: string): { rows: BulkUploadMonitorDraft[]; error: string | null } => {
  const rawLines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (rawLines.length < 2) {
    return {
      rows: [],
      error: 'CSV is empty or missing monitor rows.',
    };
  }

  const firstLine = rawLines[0];
  const delimiter = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';
  const headers = splitDelimitedLine(firstLine, delimiter).map(normalizeHeader);
  const findHeaderIndex = (aliases: string[]): number => headers.findIndex((header) => aliases.includes(header));

  const urlIndex = findHeaderIndex(['url', 'uri', 'endpoint', 'urlip', 'urlorip', 'host', 'hostname', 'domain']);
  const nameIndex = findHeaderIndex(['name', 'friendlyname', 'displayname']);
  const typeIndex = findHeaderIndex(['type', 'monitortype', 'monitor']);
  const intervalIndex = findHeaderIndex([
    'interval',
    'intervalmin',
    'intervalminutes',
    'intervalsec',
    'intervalseconds',
    'checkintervalseconds',
  ]);
  const timeoutIndex = findHeaderIndex(['timeout', 'timeoutsec', 'timeoutseconds', 'responsetimeout']);
  const methodIndex = findHeaderIndex(['httpmethod', 'method', 'requestmethod']);

  if (urlIndex < 0) {
    return {
      rows: [],
      error: 'CSV must contain a "url" column.',
    };
  }

  const errors: string[] = [];
  const rows: BulkUploadMonitorDraft[] = [];

  for (let lineIndex = 1; lineIndex < rawLines.length; lineIndex += 1) {
    const lineNumber = lineIndex + 1;
    const cells = splitDelimitedLine(rawLines[lineIndex], delimiter);
    const getCell = (index: number): string => (index >= 0 ? (cells[index] ?? '') : '');
    const rawUrl = getCell(urlIndex).trim();

    if (rawUrl === '') {
      errors.push(`Line ${lineNumber}: url is required.`);
      continue;
    }

    const normalizedUrl = normalizeWebsiteInput(rawUrl);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
    } catch {
      errors.push(`Line ${lineNumber}: invalid URL "${rawUrl}".`);
      continue;
    }

    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsedUrl.protocol.toLowerCase())) {
      errors.push(`Line ${lineNumber}: unsupported protocol in "${rawUrl}".`);
      continue;
    }

    const inferredType = inferTypeFromUrl(parsedUrl.toString());
    const rawType = getCell(typeIndex).trim().toLowerCase();
    const type: CreateMonitorInput['type'] =
      rawType === 'http' || rawType === 'https' || rawType === 'ws' || rawType === 'wss' ? rawType : inferredType;

    const rawName = getCell(nameIndex).trim();
    const name = rawName !== '' ? rawName : buildMonitorNameFromUrl(parsedUrl.toString(), lineNumber);

    const intervalHeader = intervalIndex >= 0 ? headers[intervalIndex] : '';
    const rawInterval = parseValueAsInt(getCell(intervalIndex), 5);
    const isIntervalInSeconds =
      intervalHeader === 'intervalsec' ||
      intervalHeader === 'intervalseconds' ||
      intervalHeader === 'checkintervalseconds';
    const interval = isIntervalInSeconds ? Math.max(1, Math.ceil(rawInterval / 60)) : rawInterval;
    const timeout = parseValueAsInt(getCell(timeoutIndex), 30);

    if (!Number.isFinite(interval) || interval < 1) {
      errors.push(`Line ${lineNumber}: interval must be >= 1.`);
      continue;
    }
    if (!Number.isFinite(timeout) || timeout < 5 || timeout > 300) {
      errors.push(`Line ${lineNumber}: timeout must be between 5 and 300 seconds.`);
      continue;
    }

    const rawMethod = getCell(methodIndex).trim().toUpperCase();
    const httpMethod: MonitorHttpMethod =
      rawMethod === 'GET' || rawMethod === 'POST' || rawMethod === 'PUT' || rawMethod === 'DELETE' || rawMethod === 'HEAD'
        ? rawMethod
        : 'GET';

    rows.push({
      id: `bulk-monitor-${lineNumber}-${Math.random().toString(16).slice(2, 8)}`,
      name,
      url: parsedUrl.toString(),
      type,
      interval,
      timeout,
      httpMethod,
    });
  }

  if (rows.length === 0) {
    return {
      rows: [],
      error: errors[0] ?? 'No valid monitor row found in CSV.',
    };
  }

  if (errors.length > 0) {
    const previewErrors = errors.slice(0, 3).join(' ');
    const remainingCount = errors.length - 3;
    return {
      rows: [],
      error: remainingCount > 0 ? `${previewErrors} (+${remainingCount} more)` : previewErrors,
    };
  }

  return { rows, error: null };
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
    if (emailRegex.test(email)) valid.push(email);
    else invalid.push(email);
  }

  return { valid, invalid };
};

const formatIntegrationLabel = (provider: IntegrationProvider): string =>
  provider.charAt(0).toUpperCase() + provider.slice(1);

const templateCsv = [
  'name,url,type,interval,timeout,httpMethod',
  'Main website,https://example.com,https,5,30,GET',
  'API health,https://example.com/api/health,https,1,30,GET',
].join('\n');

function BulkUploadPage({ onBack, canInviteTeam, onSubmitBulkUpload }: BulkUploadPageProps) {
  const [activeStep, setActiveStep] = useState<BulkStep>(0);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [rows, setRows] = useState<BulkUploadMonitorDraft[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamInvitesInput, setTeamInvitesInput] = useState('');
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [integrationType, setIntegrationType] = useState<IntegrationProvider>('webhook');
  const [integrationEndpoint, setIntegrationEndpoint] = useState('');
  const [integrationCustomValue, setIntegrationCustomValue] = useState('');
  const [integrationEvents, setIntegrationEvents] = useState<IntegrationEvent[]>(['up', 'down']);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const parsedInviteEmails = useMemo(() => parseInviteEmails(teamInvitesInput), [teamInvitesInput]);

  const processCsvFile = async (file: File) => {
    if (file.size > maxFileSize) {
      setImportError('File is too large. Maximum size is 10MB.');
      return;
    }

    const fileExtension = file.name.toLowerCase();
    const looksLikeCsv = file.type.includes('csv') || fileExtension.endsWith('.csv');
    if (!looksLikeCsv) {
      setImportError('Only CSV files are accepted.');
      return;
    }

    const text = await file.text();
    const parsed = parseCsvText(text);

    if (parsed.error) {
      setImportError(parsed.error);
      setRows([]);
      setUploadedFileName('');
      return;
    }

    setImportError(null);
    setReviewError(null);
    setSubmitError(null);
    setRows(parsed.rows);
    setUploadedFileName(file.name);
    setActiveStep(1);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'uptimewarden-bulk-template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const validateRows = (): string | null => {
    if (rows.length === 0) {
      return 'Upload at least one monitor.';
    }

    for (const row of rows) {
      if (row.name.trim() === '') return 'Each monitor must have a name.';
      if (row.url.trim() === '') return 'Each monitor must have a URL.';
      try {
        const parsedUrl = new URL(row.url.trim());
        const protocol = parsedUrl.protocol.toLowerCase();
        if (!['http:', 'https:', 'ws:', 'wss:'].includes(protocol)) {
          return `Unsupported protocol for ${row.name}.`;
        }
      } catch {
        return `Invalid URL for ${row.name}.`;
      }

      if (!Number.isFinite(row.interval) || row.interval < 1) {
        return `Invalid interval for ${row.name}.`;
      }
      if (!Number.isFinite(row.timeout) || row.timeout < 5 || row.timeout > 300) {
        return `Invalid timeout for ${row.name}.`;
      }
    }

    return null;
  };

  const updateRow = (id: string, field: keyof BulkUploadMonitorDraft, value: string | number) => {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== id) return row;
        if (field === 'name' && typeof value === 'string') return { ...row, name: value };
        if (field === 'url' && typeof value === 'string') {
          const normalized = normalizeWebsiteInput(value);
          return { ...row, url: normalized, type: inferTypeFromUrl(normalized) };
        }
        if (field === 'type' && typeof value === 'string') return { ...row, type: value as CreateMonitorInput['type'] };
        if (field === 'interval' && typeof value === 'number') return { ...row, interval: value };
        if (field === 'timeout' && typeof value === 'number') return { ...row, timeout: value };
        if (field === 'httpMethod' && typeof value === 'string') return { ...row, httpMethod: value as MonitorHttpMethod };
        return row;
      })
    );
  };

  const addRow = () => {
    setRows((currentRows) => [
      ...currentRows,
      {
        id: `bulk-monitor-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name: 'New monitor',
        url: 'https://',
        type: 'https',
        interval: 5,
        timeout: 30,
        httpMethod: 'GET',
      },
    ]);
    setReviewError(null);
  };

  const removeRow = (id: string) => {
    setRows((currentRows) => currentRows.filter((row) => row.id !== id));
  };

  const goToStep = (nextStep: BulkStep) => {
    if (nextStep === 0) {
      setActiveStep(0);
      return;
    }

    if (nextStep === 1) {
      setImportError(null);
      setActiveStep(1);
      return;
    }
    setReviewError(null);
    setActiveStep(2);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;
    void processCsvFile(droppedFile);
  };

  const toggleIntegrationEvent = (event: IntegrationEvent) => {
    setIntegrationEvents((currentEvents) => {
      if (currentEvents.includes(event)) {
        return currentEvents.filter((value) => value !== event);
      }
      return [...currentEvents, event];
    });
  };

  const handleSubmit = async () => {
    const rowValidationError = validateRows();
    if (rowValidationError) {
      setSubmitError(rowValidationError);
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

    let integration: CreateIntegrationInput | null = null;

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

      integration = {
        type: integrationType,
        endpointUrl: integrationEndpoint.trim(),
        customValue: integrationCustomValue.trim() || undefined,
        events: integrationEvents,
      };
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const payload: BulkUploadSubmission = {
      monitors: rows.map((row) => ({
        name: row.name.trim(),
        url: row.url.trim(),
        type: row.type,
        interval: row.interval,
        timeout: row.timeout,
        httpMethod: row.httpMethod,
      })),
      inviteEmails: parsedInviteEmails.valid,
      integration,
    };

    const error = await onSubmitBulkUpload(payload);
    if (error) {
      setSubmitError(error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <section className="bulk-upload-page">
      <div className="bulk-upload-breadcrumb">
        <button type="button" className="bulk-upload-breadcrumb-link" onClick={onBack}>
          Monitoring
        </button>
        <ChevronRight size={14} />
        <span>Import monitors</span>
      </div>

      <div className="bulk-upload-layout">
        <div className="bulk-upload-main">
          <h1>Import monitors</h1>

          {activeStep === 0 ? (
            <>
              <section className="bulk-upload-card">
                <h2>Start by downloading our template</h2>
                <p>CSV columns supported: name, url, type, interval, timeout, httpMethod.</p>
                <p>The only required field is <strong>url</strong>.</p>
                <button type="button" className="bulk-upload-secondary-btn inline" onClick={handleDownloadTemplate}>
                  <Download size={14} />
                  Download template file
                </button>
              </section>

              <section className="bulk-upload-card">
                <div
                  className={`bulk-upload-dropzone ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <FileUp size={20} />
                  <h3>Drag & drop your .csv file here</h3>
                  <p>or choose it from your hard drive (max 10MB)</p>
                  <button
                    type="button"
                    className="bulk-upload-primary-btn"
                    onClick={() => {
                      inputRef.current?.click();
                    }}
                  >
                    <Upload size={14} />
                    Choose a file
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="bulk-upload-hidden-input"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void processCsvFile(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </div>

                {uploadedFileName ? (
                  <p className="bulk-upload-file-feedback">
                    File loaded: <strong>{uploadedFileName}</strong> ({rows.length} monitors)
                  </p>
                ) : null}
                {importError ? <p className="bulk-upload-error">{importError}</p> : null}
              </section>

              <div className="bulk-upload-actions">
                <button type="button" className="bulk-upload-secondary-btn" onClick={onBack}>
                  Cancel
                </button>
                <button type="button" className="bulk-upload-primary-btn" onClick={() => goToStep(1)} disabled={rows.length === 0}>
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {activeStep === 1 ? (
            <>
              <section className="bulk-upload-card">
                <h2>Review imported monitors</h2>
                <p>Adjust monitor details before creating them.</p>

                <div className="bulk-upload-review-list">
                  {rows.length === 0 ? (
                    <p className="bulk-upload-empty-review">
                      No monitors yet. Add a row manually or go back and import a CSV file.
                    </p>
                  ) : null}
                  {rows.map((row) => (
                    <article className="bulk-upload-review-item" key={row.id}>
                      <div className="bulk-upload-review-head">
                        <strong>{row.name}</strong>
                        <button type="button" onClick={() => removeRow(row.id)} aria-label="Remove monitor row">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="bulk-upload-review-grid">
                        <label>
                          <span>Name</span>
                          <input type="text" value={row.name} onChange={(event) => updateRow(row.id, 'name', event.target.value)} />
                        </label>
                        <label className="wide">
                          <span>URL</span>
                          <input type="text" value={row.url} onChange={(event) => updateRow(row.id, 'url', event.target.value)} />
                        </label>
                        <label>
                          <span>Type</span>
                          <select value={row.type} onChange={(event) => updateRow(row.id, 'type', event.target.value)}>
                            {monitorTypeOptions.map((typeOption) => (
                              <option key={typeOption} value={typeOption}>
                                {typeOption.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Method</span>
                          <select value={row.httpMethod} onChange={(event) => updateRow(row.id, 'httpMethod', event.target.value)}>
                            {methodOptions.map((method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Interval</span>
                          <select value={row.interval} onChange={(event) => updateRow(row.id, 'interval', Number(event.target.value))}>
                            {intervalOptions.map((option) => (
                              <option key={option} value={option}>
                                {option} min
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Timeout</span>
                          <select value={row.timeout} onChange={(event) => updateRow(row.id, 'timeout', Number(event.target.value))}>
                            {timeoutOptions.map((option) => (
                              <option key={option} value={option}>
                                {option} sec
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </article>
                  ))}
                </div>

                <button type="button" className="bulk-upload-secondary-btn inline" onClick={addRow}>
                  <Plus size={14} />
                  Add row
                </button>

                {reviewError ? <p className="bulk-upload-error">{reviewError}</p> : null}
              </section>

              <div className="bulk-upload-actions">
                <button type="button" className="bulk-upload-secondary-btn" onClick={() => goToStep(0)}>
                  Back
                </button>
                <button type="button" className="bulk-upload-primary-btn" onClick={() => goToStep(2)}>
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {activeStep === 2 ? (
            <>
              <section className="bulk-upload-card">
                <h2>Notify team member / Integrations</h2>
                <p>Optional step to invite teammates and configure notifications immediately.</p>
                {rows.length === 0 ? (
                  <p className="bulk-upload-hint">No monitors yet. Add monitors in Review before final creation.</p>
                ) : null}

                <label className="bulk-upload-field">
                  <span>Invite teammates (emails separated by comma or new line)</span>
                  <textarea
                    value={teamInvitesInput}
                    onChange={(event) => setTeamInvitesInput(event.target.value)}
                    placeholder="alice@company.com, bob@company.com"
                    disabled={!canInviteTeam}
                  />
                </label>
                {!canInviteTeam ? (
                  <p className="bulk-upload-hint">Only admins can send team invitations.</p>
                ) : (
                  <p className="bulk-upload-hint">{parsedInviteEmails.valid.length} valid invite(s) prepared.</p>
                )}

                <div className="bulk-upload-integration-block">
                  <label className="bulk-upload-toggle">
                    <input
                      type="checkbox"
                      checked={integrationEnabled}
                      onChange={(event) => setIntegrationEnabled(event.target.checked)}
                    />
                    <span>Create an integration now</span>
                  </label>

                  {integrationEnabled ? (
                    <div className="bulk-upload-integration-grid">
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
                      <div className="bulk-upload-events">
                        <label className="bulk-upload-toggle">
                          <input
                            type="checkbox"
                            checked={integrationEvents.includes('down')}
                            onChange={() => toggleIntegrationEvent('down')}
                          />
                          <span>Down events</span>
                        </label>
                        <label className="bulk-upload-toggle">
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

                {submitError ? <p className="bulk-upload-error">{submitError}</p> : null}
              </section>

              <div className="bulk-upload-actions">
                <button type="button" className="bulk-upload-secondary-btn" onClick={() => goToStep(1)} disabled={isSubmitting}>
                  Back
                </button>
                <button
                  type="button"
                  className="bulk-upload-primary-btn"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || rows.length === 0}
                >
                  {isSubmitting ? 'Creating...' : `Create ${rows.length} monitor(s)`}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <aside className="bulk-upload-steps-card" aria-label="Bulk upload steps">
          <ol>
            {bulkSteps.map((step, index) => (
              <li key={step} className={activeStep === index ? 'active' : ''}>
                <button
                  type="button"
                  className="bulk-upload-step-button"
                  onClick={() => {
                    if (index === 0) goToStep(0);
                    if (index === 1) goToStep(1);
                    if (index === 2) goToStep(2);
                  }}
                >
                  <span className="bulk-upload-step-index">{index + 1}</span>
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

export default BulkUploadPage;
