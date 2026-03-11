import { ChevronRight, Pencil, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import './EditMonitorPage.css';

interface EditableMonitor {
  id: string;
  name: string;
  url?: string;
  domainExpiryMode?: 'enabled' | 'disabled';
  sslExpiryMode?: 'enabled' | 'disabled';
}

type EditMonitorSideSection = 'details' | 'integrations' | 'maintenance';

interface EditMonitorPageProps {
  monitor: EditableMonitor;
  onBack: () => void;
  onOpenMonitorDetails: () => void;
  onOpenIntegrationsTeam?: () => void;
  onOpenMaintenanceInfo?: () => void;
  onManageTeam?: () => void;
  onSaveChanges?: (payload: {
    name: string;
    url: string;
    domainExpiryMode?: 'enabled' | 'disabled';
    sslExpiryMode?: 'enabled' | 'disabled';
  }) => Promise<string | null> | string | null;
  initialSection?: EditMonitorSideSection;
}

function EditMonitorPage({
  monitor,
  onBack,
  onOpenMonitorDetails,
  onOpenIntegrationsTeam,
  onOpenMaintenanceInfo,
  onManageTeam,
  onSaveChanges,
  initialSection = 'integrations',
}: EditMonitorPageProps) {
  const editLabel = monitor.name === 'Metal 2000 Website' ? 'Metal 2000 website' : monitor.name;
  const [monitorName, setMonitorName] = useState(monitor.name);
  const [monitorUrl, setMonitorUrl] = useState(monitor.url ?? '');
  const [tagDraft, setTagDraft] = useState('');
  const [domainExpiryMode, setDomainExpiryMode] = useState<'enabled' | 'disabled'>(
    monitor.domainExpiryMode ?? 'disabled',
  );
  const [sslExpiryMode, setSslExpiryMode] = useState<'enabled' | 'disabled'>(
    monitor.sslExpiryMode ?? 'disabled',
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMonitorName(monitor.name);
    setMonitorUrl(monitor.url ?? '');
    setTagDraft('');
    setDomainExpiryMode(monitor.domainExpiryMode ?? 'disabled');
    setSslExpiryMode(monitor.sslExpiryMode ?? 'disabled');
    setSaveError(null);
    setIsSaving(false);
  }, [monitor]);

  const friendlyName = useMemo(() => {
    const rawUrl = monitorUrl.trim();
    if (rawUrl === '') return monitorName.trim() || 'monitor';
    try {
      return new URL(rawUrl).hostname || monitorName.trim() || 'monitor';
    } catch {
      return monitorName.trim() || 'monitor';
    }
  }, [monitorName, monitorUrl]);
  const activeSideSection = initialSection;
  const isDetailsSection = activeSideSection === 'details';
  const isIntegrationsSection = activeSideSection === 'integrations';

  const handleSaveChanges = async () => {
    if (!onSaveChanges || isSaving) return;

    const cleanedName = monitorName.trim();
    const cleanedUrl = monitorUrl.trim();

    if (cleanedName === '') {
      setSaveError('Le nom du monitor est requis.');
      return;
    }

    if (cleanedUrl === '') {
      setSaveError("L'URL du monitor est requise.");
      return;
    }

    try {
      const parsedUrl = new URL(cleanedUrl);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsedUrl.protocol)) {
        setSaveError("L'URL doit commencer par http://, https://, ws:// ou wss://.");
        return;
      }
    } catch {
      setSaveError("L'URL n'est pas valide.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const error = await onSaveChanges({ name: cleanedName, url: cleanedUrl, domainExpiryMode, sslExpiryMode });
    if (error) {
      setSaveError(error);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  return (
    <section className="edit-monitor-page">
      <div className="edit-monitor-breadcrumb">
        <button type="button" className="edit-monitor-breadcrumb-link" onClick={onBack}>
          Monitoring
        </button>
        <ChevronRight size={14} />
        <span>{editLabel}</span>
      </div>

      <h2 className="edit-monitor-title">Edit {editLabel}</h2>

      <div className="edit-monitor-content-grid">
        <div className="edit-monitor-main">
          {isDetailsSection ? (
            <>
              <section className="edit-monitor-card">
                <div className="edit-monitor-top-shell">
                  <h3>URL to monitor</h3>
                  <input
                    type="url"
                    value={monitorUrl}
                    onChange={(event) => setMonitorUrl(event.target.value)}
                    disabled={isSaving}
                    placeholder="https://example.com"
                  />

                  <div className="edit-monitor-friendly-row">
                    <p>
                      Friendly name: <strong>{friendlyName}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        nameInputRef.current?.focus();
                      }}
                    >
                      <Pencil size={12} />
                      Rename
                    </button>
                  </div>

                  <div className="edit-monitor-meta-grid">
                    <div className="edit-monitor-meta-box">
                      <h4>Group</h4>
                      <p>Your monitor will be added to default group.</p>
                      <select disabled>
                        <option>Monitors (default)</option>
                      </select>
                    </div>
                    <div className="edit-monitor-meta-box">
                      <h4>Add tags</h4>
                      <p>Tags help you organize your monitors.</p>
                      <input
                        type="text"
                        placeholder="Click to add tag..."
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="edit-monitor-domain-row">
                    <div className="edit-monitor-domain-copy">
                      <h4>Domain expiry reminders</h4>
                      <p>Enable WHOIS checks to track domain expiration date.</p>
                    </div>
                    <div className="edit-monitor-domain-select">
                      <select
                        value={domainExpiryMode}
                        onChange={(event) =>
                          setDomainExpiryMode(event.target.value === 'enabled' ? 'enabled' : 'disabled')
                        }
                        disabled={isSaving}
                      >
                        <option value="disabled">Disabled</option>
                        <option value="enabled">Enabled</option>
                      </select>
                    </div>
                  </div>

                  <div className="edit-monitor-domain-row">
                    <div className="edit-monitor-domain-copy">
                      <h4>SSL expiry reminders</h4>
                      <p>Enable TLS certificate checks to track expiration date.</p>
                    </div>
                    <div className="edit-monitor-domain-select">
                      <select
                        value={sslExpiryMode}
                        onChange={(event) =>
                          setSslExpiryMode(event.target.value === 'enabled' ? 'enabled' : 'disabled')
                        }
                        disabled={isSaving}
                      >
                        <option value="disabled">Disabled</option>
                        <option value="enabled">Enabled</option>
                      </select>
                    </div>
                  </div>

                  <label className="edit-monitor-field">
                    <span>Monitor name</span>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={monitorName}
                      onChange={(event) => setMonitorName(event.target.value)}
                      disabled={isSaving}
                      placeholder="My service"
                    />
                  </label>
                </div>
              </section>

              <section className="edit-monitor-submit-card">
                {saveError ? <p className="edit-monitor-save-error">{saveError}</p> : null}
                <button type="button" onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save changes'}
                </button>
              </section>
            </>
          ) : null}

          {isIntegrationsSection ? (
            <section className="edit-monitor-card">
              <div className="edit-monitor-integrations-shell">
                <div className="edit-monitor-notify-head">
                  <h3>Notify team members</h3>
                  <button type="button" className="edit-monitor-manage-btn" onClick={() => onManageTeam?.()}>
                    <Users size={13} />
                    Manage team
                  </button>
                </div>

                <div className="edit-monitor-notify-grid">
                  <label className="edit-monitor-notify-item">
                    <input type="checkbox" defaultChecked />
                    <span>E-mail</span>
                  </label>
                  <label className="edit-monitor-notify-item">
                    <input type="checkbox" />
                    <span>SMS message</span>
                  </label>
                  <label className="edit-monitor-notify-item">
                    <input type="checkbox" />
                    <span>Voice call</span>
                  </label>
                  <label className="edit-monitor-notify-item">
                    <input type="checkbox" />
                    <span>Push</span>
                  </label>
                </div>

                <p className="edit-monitor-footnote">
                  You can set up notifications for{' '}
                  <button type="button" className="edit-monitor-inline-link" onClick={() => onOpenIntegrationsTeam?.()}>
                    Integrations & Team
                  </button>{' '}
                  in the specific tab and edit it later.
                </p>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="edit-monitor-side-card">
          <button
            type="button"
            className={`edit-monitor-side-title-link ${activeSideSection === 'details' ? 'active' : ''}`}
            onClick={() => {
              onOpenMonitorDetails();
            }}
          >
            Monitor details
          </button>
          <button
            type="button"
            className={`edit-monitor-side-link ${activeSideSection === 'integrations' ? 'active' : ''}`}
            onClick={() => {
              onOpenIntegrationsTeam?.();
            }}
          >
            Integrations & Team
          </button>
          <button
            type="button"
            className={`edit-monitor-side-link ${activeSideSection === 'maintenance' ? 'active' : ''}`}
            onClick={() => {
              onOpenMaintenanceInfo?.();
            }}
          >
            Maintenance info
          </button>
        </aside>
      </div>
    </section>
  );
}

export default EditMonitorPage;
