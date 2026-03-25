import { ChevronRight, Clock3, Mail, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import './EditMonitorPage.css';

interface EditableMonitor {
  id: string;
  name: string;
  url?: string;
  sharedUserIds?: string[];
  domainExpiryMode?: 'enabled' | 'disabled';
  sslExpiryMode?: 'enabled' | 'disabled';
}

type EditMonitorSideSection = 'details' | 'integrations' | 'maintenance';

interface EditableTeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
}

interface EditableInvitation {
  id: string;
  name?: string;
  email: string;
  monitorIds: string[];
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
}

interface EditMonitorPageProps {
  monitor: EditableMonitor;
  currentUserRole?: 'admin' | 'user';
  teamMembers?: EditableTeamMember[];
  invitations?: EditableInvitation[];
  onBack: () => void;
  onOpenMonitorDetails: () => void;
  onOpenIntegrationsTeam?: () => void;
  onOpenMaintenanceInfo?: () => void;
  onManageTeam?: () => void;
  onGrantMonitorAccess?: (payload: {
    name?: string;
    email: string;
  }) => Promise<{ error?: string | null; notice?: string | null }> | { error?: string | null; notice?: string | null };
  onRevokeMonitorAccess?: (userId: string) => Promise<string | null> | string | null;
  onDeleteInvitation?: (invitationId: string) => Promise<string | null> | string | null;
  onSaveChanges?: (payload: {
    name: string;
    url: string;
    domainExpiryMode?: 'enabled' | 'disabled';
    sslExpiryMode?: 'enabled' | 'disabled';
  }) => Promise<string | null> | string | null;
  initialSection?: EditMonitorSideSection;
}

const formatShortDate = (value: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return '-';

  return new Date(parsed).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

function EditMonitorPage({
  monitor,
  currentUserRole,
  teamMembers = [],
  invitations = [],
  onBack,
  onOpenMonitorDetails,
  onOpenIntegrationsTeam,
  onOpenMaintenanceInfo,
  onManageTeam,
  onGrantMonitorAccess,
  onRevokeMonitorAccess,
  onDeleteInvitation,
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
  const [accessName, setAccessName] = useState('');
  const [accessEmail, setAccessEmail] = useState('');
  const [accessQuery, setAccessQuery] = useState('');
  const [accessFeedback, setAccessFeedback] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isSubmittingAccess, setIsSubmittingAccess] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingInvitationId, setPendingInvitationId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMonitorName(monitor.name);
    setMonitorUrl(monitor.url ?? '');
    setTagDraft('');
    setDomainExpiryMode(monitor.domainExpiryMode ?? 'disabled');
    setSslExpiryMode(monitor.sslExpiryMode ?? 'disabled');
    setSaveError(null);
    setIsSaving(false);
    setAccessName('');
    setAccessEmail('');
    setAccessQuery('');
    setAccessFeedback(null);
    setAccessError(null);
    setIsSubmittingAccess(false);
    setPendingUserId(null);
    setPendingInvitationId(null);
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
  const canManageMonitorAccess = currentUserRole === 'admin';

  const normalizedAccessQuery = accessQuery.trim().toLowerCase();

  const monitorSharedUsers = useMemo(
    () =>
      teamMembers
        .filter((member) => monitor.sharedUserIds?.includes(member.id))
        .sort((leftMember, rightMember) => leftMember.name.localeCompare(rightMember.name)),
    [monitor.sharedUserIds, teamMembers],
  );

  const monitorInvitations = useMemo(
    () =>
      invitations
        .filter((invitation) => invitation.monitorIds.includes(monitor.id))
        .sort((leftInvitation, rightInvitation) => Date.parse(rightInvitation.createdAt) - Date.parse(leftInvitation.createdAt)),
    [invitations, monitor.id],
  );

  const visibleSharedUsers = useMemo(
    () =>
      monitorSharedUsers.filter((member) => {
        if (normalizedAccessQuery === '') return true;

        return (
          member.name.toLowerCase().includes(normalizedAccessQuery) ||
          member.email.toLowerCase().includes(normalizedAccessQuery)
        );
      }),
    [monitorSharedUsers, normalizedAccessQuery],
  );

  const visibleInvitations = useMemo(
    () =>
      monitorInvitations.filter((invitation) => {
        if (normalizedAccessQuery === '') return true;

        return (
          (invitation.name ?? '').toLowerCase().includes(normalizedAccessQuery) ||
          invitation.email.toLowerCase().includes(normalizedAccessQuery)
        );
      }),
    [monitorInvitations, normalizedAccessQuery],
  );

  const pendingInvitationCount = monitorInvitations.filter((invitation) => invitation.status === 'pending').length;

  const handleSubmitMonitorAccess = async () => {
    if (!onGrantMonitorAccess || isSubmittingAccess) return;

    const cleanedEmail = accessEmail.trim().toLowerCase();
    const cleanedName = accessName.trim();

    if (cleanedEmail === '') {
      setAccessFeedback(null);
      setAccessError("L'email est requis.");
      return;
    }

    if (!isValidEmail(cleanedEmail)) {
      setAccessFeedback(null);
      setAccessError("L'email n'est pas valide.");
      return;
    }

    setIsSubmittingAccess(true);
    setAccessFeedback(null);
    setAccessError(null);

    const result = await onGrantMonitorAccess({
      name: cleanedName === '' ? undefined : cleanedName,
      email: cleanedEmail,
    });

    if (result.error) {
      setAccessError(result.error);
      setIsSubmittingAccess(false);
      return;
    }

    setAccessName('');
    setAccessEmail('');
    setAccessFeedback(result.notice ?? 'Invitation envoyée ou accès accordé avec succès.');
    setIsSubmittingAccess(false);
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!onRevokeMonitorAccess || pendingUserId || pendingInvitationId) return;

    const shouldRevoke = window.confirm('Retirer cet accès au monitor ?');
    if (!shouldRevoke) return;

    setPendingUserId(userId);
    setAccessFeedback(null);
    setAccessError(null);

    const error = await onRevokeMonitorAccess(userId);

    if (error) {
      setAccessError(error);
      setPendingUserId(null);
      return;
    }

    setAccessFeedback('Accès retiré avec succès.');
    setPendingUserId(null);
  };

  const handleDeleteMonitorInvitation = async (invitationId: string) => {
    if (!onDeleteInvitation || pendingUserId || pendingInvitationId) return;

    const shouldDelete = window.confirm('Supprimer cette invitation ?');
    if (!shouldDelete) return;

    setPendingInvitationId(invitationId);
    setAccessFeedback(null);
    setAccessError(null);

    const error = await onDeleteInvitation(invitationId);

    if (error) {
      setAccessError(error);
      setPendingInvitationId(null);
      return;
    }

    setAccessFeedback('Invitation supprimée.');
    setPendingInvitationId(null);
  };

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

                <div className="edit-monitor-access-panel">
                  <div className="edit-monitor-access-panel-head">
                    <div>
                      <h4>Monitor access</h4>
                      <p>Invite users by email or manage who can consult this monitor.</p>
                    </div>

                    <div className="edit-monitor-access-stats">
                      <span className="edit-monitor-access-stat">
                        <Users size={13} />
                        {monitorSharedUsers.length} user{monitorSharedUsers.length > 1 ? 's' : ''}
                      </span>
                      <span className="edit-monitor-access-stat pending">
                        <Clock3 size={13} />
                        {pendingInvitationCount} pending
                      </span>
                    </div>
                  </div>

                  {canManageMonitorAccess ? (
                    <>
                      <div className="edit-monitor-access-form-grid">
                        <label className="edit-monitor-field">
                          <span>Name</span>
                          <input
                            type="text"
                            value={accessName}
                            onChange={(event) => setAccessName(event.target.value)}
                            disabled={isSubmittingAccess || pendingUserId !== null || pendingInvitationId !== null}
                            placeholder="Optional"
                          />
                        </label>

                        <label className="edit-monitor-field">
                          <span>Email</span>
                          <input
                            type="email"
                            value={accessEmail}
                            onChange={(event) => setAccessEmail(event.target.value)}
                            disabled={isSubmittingAccess || pendingUserId !== null || pendingInvitationId !== null}
                            placeholder="user@company.com"
                          />
                        </label>
                      </div>

                      <div className="edit-monitor-access-form-actions">
                        <button
                          type="button"
                          className="edit-monitor-access-submit"
                          onClick={() => {
                            void handleSubmitMonitorAccess();
                          }}
                          disabled={
                            accessEmail.trim() === '' ||
                            isSubmittingAccess ||
                            pendingUserId !== null ||
                            pendingInvitationId !== null
                          }
                        >
                          <UserPlus size={14} />
                          {isSubmittingAccess ? 'Sending...' : 'Invite by email'}
                        </button>

                        <button type="button" className="edit-monitor-inline-link" onClick={() => onManageTeam?.()}>
                          Open full team management
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="edit-monitor-access-note">
                      Only admins can invite users or change access for this monitor.
                    </p>
                  )}

                  {accessError ? <p className="edit-monitor-access-message error">{accessError}</p> : null}
                  {accessFeedback ? <p className="edit-monitor-access-message success">{accessFeedback}</p> : null}

                  <div className="edit-monitor-access-search">
                    <Search size={14} />
                    <input
                      type="search"
                      value={accessQuery}
                      onChange={(event) => setAccessQuery(event.target.value)}
                      placeholder="Search users or invitations..."
                    />
                  </div>

                  <div className="edit-monitor-access-lists">
                    <div className="edit-monitor-access-list">
                      <div className="edit-monitor-access-list-head">
                        <h5>Users with access</h5>
                        <span>{visibleSharedUsers.length}</span>
                      </div>

                      {visibleSharedUsers.length === 0 ? (
                        <p className="edit-monitor-access-empty">No user currently has access to this monitor.</p>
                      ) : (
                        <div className="edit-monitor-access-rows">
                          {visibleSharedUsers.map((member) => (
                            <div className="edit-monitor-access-row" key={member.id}>
                              <div className="edit-monitor-access-row-main">
                                <strong>{member.name}</strong>
                                <span className="edit-monitor-access-row-email">
                                  <Mail size={12} />
                                  {member.email}
                                </span>
                              </div>

                              <div className="edit-monitor-access-row-actions">
                                <span className={`edit-monitor-access-role ${member.role}`}>
                                  {member.role === 'admin' ? 'Admin' : 'Member'}
                                </span>
                                {canManageMonitorAccess ? (
                                  <button
                                    type="button"
                                    className="edit-monitor-access-row-button danger"
                                    onClick={() => {
                                      void handleRevokeAccess(member.id);
                                    }}
                                    disabled={
                                      pendingUserId === member.id ||
                                      isSubmittingAccess ||
                                      pendingInvitationId !== null
                                    }
                                  >
                                    <Trash2 size={13} />
                                    {pendingUserId === member.id ? 'Removing...' : 'Remove'}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="edit-monitor-access-list">
                      <div className="edit-monitor-access-list-head">
                        <h5>Invitations</h5>
                        <span>{visibleInvitations.length}</span>
                      </div>

                      {visibleInvitations.length === 0 ? (
                        <p className="edit-monitor-access-empty">No invitation found for this monitor.</p>
                      ) : (
                        <div className="edit-monitor-access-rows">
                          {visibleInvitations.map((invitation) => (
                            <div className="edit-monitor-access-row" key={invitation.id}>
                              <div className="edit-monitor-access-row-main">
                                <strong>{invitation.name?.trim() || invitation.email}</strong>
                                <span className="edit-monitor-access-row-email">
                                  <Mail size={12} />
                                  {invitation.email}
                                </span>
                                <span className="edit-monitor-access-row-meta">
                                  <Clock3 size={12} />
                                  Expires {formatShortDate(invitation.expiresAt)}
                                </span>
                              </div>

                              <div className="edit-monitor-access-row-actions">
                                <span className={`edit-monitor-access-status ${invitation.status}`}>
                                  {invitation.status === 'pending'
                                    ? 'Pending'
                                    : invitation.status === 'accepted'
                                      ? 'Accepted'
                                      : 'Expired'}
                                </span>
                                {canManageMonitorAccess ? (
                                  <button
                                    type="button"
                                    className="edit-monitor-access-row-button danger"
                                    onClick={() => {
                                      void handleDeleteMonitorInvitation(invitation.id);
                                    }}
                                    disabled={
                                      pendingInvitationId === invitation.id ||
                                      pendingUserId !== null ||
                                      isSubmittingAccess
                                    }
                                  >
                                    <Trash2 size={13} />
                                    {pendingInvitationId === invitation.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
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
