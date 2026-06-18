import { ChevronRight, Clock3, Mail, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isAdminRole } from '../../lib/roles';
import type { UserRole } from '../../lib/api';
import { useAppLanguage } from '../../lib/language';
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
  role: UserRole;
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
  currentUserRole?: UserRole;
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

const formatShortDate = (value: string, locale: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return '-';

  return new Date(parsed).toLocaleDateString(locale, {
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
  const { t, language } = useAppLanguage();
  const dateLocale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-TN' : 'en-US';
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
  const getUserRoleLabel = (role: UserRole): string => {
    if (role === 'super_admin') {
      return t('team.management.roleSuperAdmin');
    }

    if (role === 'admin') {
      return t('team.management.roleAdmin');
    }

    return t('team.management.roleMember');
  };

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
    if (rawUrl === '') return monitorName.trim() || t('editMonitor.monitorFallback');
    try {
      return new URL(rawUrl).hostname || monitorName.trim() || t('editMonitor.monitorFallback');
    } catch {
      return monitorName.trim() || t('editMonitor.monitorFallback');
    }
  }, [monitorName, monitorUrl, t]);
  const activeSideSection = initialSection;
  const isDetailsSection = activeSideSection === 'details';
  const isIntegrationsSection = activeSideSection === 'integrations';
  const canManageMonitorAccess = isAdminRole(currentUserRole);

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
      setAccessError(t('editMonitor.errors.emailRequired'));
      return;
    }

    if (!isValidEmail(cleanedEmail)) {
      setAccessFeedback(null);
      setAccessError(t('editMonitor.errors.emailInvalid'));
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
    setAccessFeedback(result.notice ?? t('editMonitor.access.successGranted'));
    setIsSubmittingAccess(false);
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!onRevokeMonitorAccess || pendingUserId || pendingInvitationId) return;

    const shouldRevoke = window.confirm(t('editMonitor.confirm.removeAccess'));
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

    setAccessFeedback(t('editMonitor.access.removed'));
    setPendingUserId(null);
  };

  const handleDeleteMonitorInvitation = async (invitationId: string) => {
    if (!onDeleteInvitation || pendingUserId || pendingInvitationId) return;

    const shouldDelete = window.confirm(t('editMonitor.confirm.deleteInvitation'));
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

    setAccessFeedback(t('editMonitor.access.invitationDeleted'));
    setPendingInvitationId(null);
  };

  const handleSaveChanges = async () => {
    if (!onSaveChanges || isSaving) return;

    const cleanedName = monitorName.trim();
    const cleanedUrl = monitorUrl.trim();

    if (cleanedName === '') {
      setSaveError(t('editMonitor.errors.monitorNameRequired'));
      return;
    }

    if (cleanedUrl === '') {
      setSaveError(t('editMonitor.errors.monitorUrlRequired'));
      return;
    }

    try {
      const parsedUrl = new URL(cleanedUrl);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsedUrl.protocol)) {
        setSaveError(t('editMonitor.errors.urlMustStartWith'));
        return;
      }
    } catch {
      setSaveError(t('editMonitor.errors.urlInvalid'));
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
          {t('menu.monitoring')}
        </button>
        <ChevronRight size={14} />
        <span>{editLabel}</span>
      </div>

      <h2 className="edit-monitor-title">{t('editMonitor.title', { name: editLabel })}</h2>

      <div className="edit-monitor-content-grid">
        <div className="edit-monitor-main">
          {isDetailsSection ? (
            <>
              <section className="edit-monitor-card">
                <div className="edit-monitor-top-shell">
                  <h3>{t('editMonitor.urlToMonitor')}</h3>
                  <input
                    type="url"
                    value={monitorUrl}
                    onChange={(event) => setMonitorUrl(event.target.value)}
                    disabled={isSaving}
                    placeholder={t('editMonitor.urlPlaceholder')}
                  />

                  <div className="edit-monitor-friendly-row">
                    <p>
                      {t('editMonitor.friendlyName')} <strong>{friendlyName}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        nameInputRef.current?.focus();
                      }}
                    >
                      <Pencil size={12} />
                      {t('editMonitor.rename')}
                    </button>
                  </div>

                  <div className="edit-monitor-meta-grid">
                    <div className="edit-monitor-meta-box">
                      <h4>{t('editMonitor.group')}</h4>
                      <p>{t('editMonitor.defaultGroupInfo')}</p>
                      <select disabled>
                        <option>{t('editMonitor.defaultGroupOption')}</option>
                      </select>
                    </div>
                    <div className="edit-monitor-meta-box">
                      <h4>{t('editMonitor.addTags')}</h4>
                      <p>{t('editMonitor.tagsHelp')}</p>
                      <input
                        type="text"
                        placeholder={t('editMonitor.tagPlaceholder')}
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="edit-monitor-domain-row">
                    <div className="edit-monitor-domain-copy">
                      <h4>{t('editMonitor.domainExpiryReminders')}</h4>
                      <p>{t('editMonitor.domainExpiryDescription')}</p>
                    </div>
                    <div className="edit-monitor-domain-select">
                      <select
                        value={domainExpiryMode}
                        onChange={(event) =>
                          setDomainExpiryMode(event.target.value === 'enabled' ? 'enabled' : 'disabled')
                        }
                        disabled={isSaving}
                      >
                        <option value="disabled">{t('common.disabled')}</option>
                        <option value="enabled">{t('common.enabled')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="edit-monitor-domain-row">
                    <div className="edit-monitor-domain-copy">
                      <h4>{t('editMonitor.sslExpiryReminders')}</h4>
                      <p>{t('editMonitor.sslExpiryDescription')}</p>
                    </div>
                    <div className="edit-monitor-domain-select">
                      <select
                        value={sslExpiryMode}
                        onChange={(event) =>
                          setSslExpiryMode(event.target.value === 'enabled' ? 'enabled' : 'disabled')
                        }
                        disabled={isSaving}
                      >
                        <option value="disabled">{t('common.disabled')}</option>
                        <option value="enabled">{t('common.enabled')}</option>
                      </select>
                    </div>
                  </div>

                  <label className="edit-monitor-field">
                    <span>{t('editMonitor.monitorName')}</span>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={monitorName}
                      onChange={(event) => setMonitorName(event.target.value)}
                      disabled={isSaving}
                      placeholder={t('editMonitor.monitorNamePlaceholder')}
                    />
                  </label>
                </div>
              </section>

              <section className="edit-monitor-submit-card">
                {saveError ? <p className="edit-monitor-save-error">{saveError}</p> : null}
                <button type="button" onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? t('common.saving') : t('editMonitor.saveChanges')}
                </button>
              </section>
            </>
          ) : null}

          {isIntegrationsSection ? (
            <section className="edit-monitor-card">
              <div className="edit-monitor-integrations-shell">
                <div className="edit-monitor-notify-head">
                  <h3>{t('editMonitor.notifyTeamMembers')}</h3>
                  <button type="button" className="edit-monitor-manage-btn" onClick={() => onManageTeam?.()}>
                    <Users size={13} />
                    {t('editMonitor.manageTeam')}
                  </button>
                </div>

                <div className="edit-monitor-notify-grid">
                  <label className="edit-monitor-notify-item">
                    <input type="checkbox" defaultChecked />
                    <span>{t('newMonitor.notificationChannels.email')}</span>
                  </label>
                  <label className="edit-monitor-notify-item">
                    <input type="checkbox" disabled />
                    <span>{t('newMonitor.notificationChannels.sms')}</span>
                  </label>
                  <label className="edit-monitor-notify-item">
                    <input type="checkbox" disabled />
                    <span>{t('newMonitor.notificationChannels.voice')}</span>
                  </label>
                  <label className="edit-monitor-notify-item">
                    <input type="checkbox" disabled />
                    <span>{t('newMonitor.notificationChannels.push')}</span>
                  </label>
                </div>

                <div className="edit-monitor-access-panel">
                  <div className="edit-monitor-access-panel-head">
                    <div>
                      <h4>{t('editMonitor.monitorAccess')}</h4>
                      <p>{t('editMonitor.monitorAccessDescription')}</p>
                    </div>

                    <div className="edit-monitor-access-stats">
                      <span className="edit-monitor-access-stat">
                        <Users size={13} />
                        {monitorSharedUsers.length === 1
                          ? t('editMonitor.access.users.one')
                          : t('editMonitor.access.users.many', { count: monitorSharedUsers.length })}
                      </span>
                      <span className="edit-monitor-access-stat pending">
                        <Clock3 size={13} />
                        {pendingInvitationCount === 1
                          ? t('editMonitor.access.pending.one')
                          : t('editMonitor.access.pending.many', { count: pendingInvitationCount })}
                      </span>
                    </div>
                  </div>

                  {canManageMonitorAccess ? (
                    <>
                      <div className="edit-monitor-access-form-grid">
                        <label className="edit-monitor-field">
                          <span>{t('common.name')}</span>
                          <input
                            type="text"
                            value={accessName}
                            onChange={(event) => setAccessName(event.target.value)}
                            disabled={isSubmittingAccess || pendingUserId !== null || pendingInvitationId !== null}
                            placeholder={t('common.optional')}
                          />
                        </label>

                        <label className="edit-monitor-field">
                          <span>{t('common.email')}</span>
                          <input
                            type="email"
                            value={accessEmail}
                            onChange={(event) => setAccessEmail(event.target.value)}
                            disabled={isSubmittingAccess || pendingUserId !== null || pendingInvitationId !== null}
                            placeholder={t('editMonitor.emailPlaceholder')}
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
                          {isSubmittingAccess ? t('common.sending') : t('editMonitor.inviteByEmail')}
                        </button>

                        <button type="button" className="edit-monitor-inline-link" onClick={() => onManageTeam?.()}>
                          {t('editMonitor.openFullTeamManagement')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="edit-monitor-access-note">
                      {t('editMonitor.onlyAdminsCanManageAccess')}
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
                      placeholder={t('editMonitor.searchUsersOrInvitations')}
                    />
                  </div>

                  <div className="edit-monitor-access-lists">
                    <div className="edit-monitor-access-list">
                      <div className="edit-monitor-access-list-head">
                        <h5>{t('editMonitor.usersWithAccess')}</h5>
                        <span>{visibleSharedUsers.length}</span>
                      </div>

                      {visibleSharedUsers.length === 0 ? (
                        <p className="edit-monitor-access-empty">{t('editMonitor.noUserAccess')}</p>
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
                                <span className={`edit-monitor-access-role ${isAdminRole(member.role) ? 'admin' : 'user'}`}>
                                  {getUserRoleLabel(member.role)}
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
                                    {pendingUserId === member.id ? t('common.removing') : t('common.remove')}
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
                        <h5>{t('editMonitor.invitations')}</h5>
                        <span>{visibleInvitations.length}</span>
                      </div>

                      {visibleInvitations.length === 0 ? (
                        <p className="edit-monitor-access-empty">{t('editMonitor.noInvitationFound')}</p>
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
                                  {t('editMonitor.expires', { date: formatShortDate(invitation.expiresAt, dateLocale) })}
                                </span>
                              </div>

                              <div className="edit-monitor-access-row-actions">
                                <span className={`edit-monitor-access-status ${invitation.status}`}>
                                  {invitation.status === 'pending'
                                    ? t('editMonitor.status.pending')
                                    : invitation.status === 'accepted'
                                      ? t('editMonitor.status.accepted')
                                      : t('editMonitor.status.expired')}
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
                                    {pendingInvitationId === invitation.id ? t('common.deleting') : t('common.delete')}
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
                  {t('editMonitor.footnote.prefix')}{' '}
                  <button type="button" className="edit-monitor-inline-link" onClick={() => onOpenIntegrationsTeam?.()}>
                    {t('editMonitor.footnote.link')}
                  </button>{' '}
                  {t('editMonitor.footnote.suffix')}
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
            {t('newMonitor.side.details')}
          </button>
          <button
            type="button"
            className={`edit-monitor-side-link ${activeSideSection === 'integrations' ? 'active' : ''}`}
            onClick={() => {
              onOpenIntegrationsTeam?.();
            }}
          >
            {t('newMonitor.side.integrationsTeam')}
          </button>
          <button
            type="button"
            className={`edit-monitor-side-link ${activeSideSection === 'maintenance' ? 'active' : ''}`}
            onClick={() => {
              onOpenMaintenanceInfo?.();
            }}
          >
            {t('newMonitor.side.maintenanceInfo')}
          </button>
        </aside>
      </div>
    </section>
  );
}

export default EditMonitorPage;
