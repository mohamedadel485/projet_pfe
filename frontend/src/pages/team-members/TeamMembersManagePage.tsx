import { ArrowLeft, Mail, MoreVertical, Plus, Shield, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type EditableUserRole, type UserRole } from '../../lib/api';
import { useAppLanguage } from '../../lib/language';
import './TeamMembersManagePage.css';

interface TeamMembersManagePageProps {
  users?: Array<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  }>;
  invitations?: Array<{
    id: string;
    email: string;
    status: 'pending' | 'accepted' | 'expired';
    createdAt: string;
    expiresAt: string;
  }>;
  currentUserId?: string;
  onBack?: () => void;
  onInviteTeam?: () => void;
  onDeleteUser?: (userId: string) => Promise<string | null>;
  onChangeUserRole?: (userId: string, nextRole: EditableUserRole) => Promise<string | null>;
  onToggleUserActive?: (userId: string, nextIsActive: boolean) => Promise<string | null>;
  onDeleteInvitation?: (invitationId: string) => Promise<string | null>;
}

const getUserSortPriority = (role: UserRole): number => {
  if (role === 'super_admin') {
    return 0;
  }

  return 1;
};

const formatDate = (value: string, locale = 'en-US'): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return '-';
  return new Date(parsed).toLocaleDateString(locale);
};

function TeamMembersManagePage({
  users = [],
  invitations = [],
  currentUserId,
  onBack,
  onInviteTeam,
  onDeleteUser,
  onChangeUserRole,
  onToggleUserActive,
  onDeleteInvitation,
}: TeamMembersManagePageProps) {
  const { language, t } = useAppLanguage();
  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        const priorityDifference = getUserSortPriority(a.role) - getUserSortPriority(b.role);
        if (priorityDifference !== 0) {
          return priorityDifference;
        }

    return a.name.localeCompare(b.name, locale, { sensitivity: 'base' });
      }),
    [users],
  );
  const sortedInvitations = useMemo(
    () => [...invitations].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [invitations],
  );
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingInvitationId, setPendingInvitationId] = useState<string | null>(null);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const locale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-TN' : 'en-US';

  const getLocalizedUserRoleLabel = (role: UserRole): string => {
    if (role === 'super_admin') {
      return t('team.management.roleSuperAdmin');
    }
    if (role === 'admin') {
      return t('team.management.roleAdmin');
    }
    return t('team.management.roleMember');
  };

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.team-members-user-menu-wrap')) {
        setOpenUserMenuId(null);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenUserMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (!onDeleteUser || pendingUserId || pendingInvitationId) return;

    const shouldDelete = window.confirm(t('team.management.deleteUser'));
    if (!shouldDelete) return;

    setActionError(null);
    setOpenUserMenuId(null);
    setPendingUserId(userId);

    const error = await onDeleteUser(userId);
    if (error) {
      setActionError(error);
    }

    setPendingUserId(null);
  };

  const handleChangeUserRole = async (userId: string, nextRole: EditableUserRole) => {
    if (!onChangeUserRole || pendingUserId || pendingInvitationId) return;

    setActionError(null);
    setOpenUserMenuId(null);
    setPendingUserId(userId);

    const error = await onChangeUserRole(userId, nextRole);
    if (error) {
      setActionError(error);
    }

    setPendingUserId(null);
  };

  const handleToggleUserActive = async (userId: string, nextIsActive: boolean) => {
    if (!onToggleUserActive || pendingUserId || pendingInvitationId) return;

    setActionError(null);
    setOpenUserMenuId(null);
    setPendingUserId(userId);

    const error = await onToggleUserActive(userId, nextIsActive);
    if (error) {
      setActionError(error);
    }

    setPendingUserId(null);
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!onDeleteInvitation || pendingUserId || pendingInvitationId) return;

    const shouldDelete = window.confirm(t('team.management.deleteInvitation'));
    if (!shouldDelete) return;

    setActionError(null);
    setPendingInvitationId(invitationId);

    const error = await onDeleteInvitation(invitationId);
    if (error) {
      setActionError(error);
    }

    setPendingInvitationId(null);
  };

  return (
    <section className="team-members-manage-page">
      <article className="team-members-manage-shell">
        <header className="team-members-manage-top">
          <div className="team-members-manage-title-wrap">
            <h1>{t('team.management.title')}</h1>
            <p>{t('team.management.subtitle')}</p>
          </div>

          <div className="team-members-manage-top-actions">
            <button type="button" className="team-members-manage-ghost" onClick={() => onBack?.()}>
              <ArrowLeft size={14} />
              {t('team.management.back')}
            </button>
            <button type="button" className="team-members-manage-primary" onClick={() => onInviteTeam?.()}>
              <Plus size={14} />
              {t('team.management.inviteTeam')}
            </button>
          </div>
        </header>

        <section className="team-members-manage-grid">
          {actionError ? <p className="team-members-manage-error">{actionError}</p> : null}

          <article className="team-members-manage-card">
            <header className="team-members-manage-card-header">
          <h2>{t('team.management.users')}</h2>
              <span>{sortedUsers.length}</span>
            </header>

            {sortedUsers.length === 0 ? (
              <p className="team-members-manage-empty">{t('team.management.noUserAvailable')}</p>
            ) : (
              <div className="team-members-manage-table">
                <div className="team-members-manage-row head">
                  <span>{t('common.name')}</span>
                  <span>{t('common.email')}</span>
                  <span>{t('common.role')}</span>
                  <span>{t('team.management.status')}</span>
                  <span>{t('team.management.actions')}</span>
                </div>
                {sortedUsers.map((user) => {
                  const isProtectedSuperAdmin = user.role === 'super_admin';
                  return (
                  <div className="team-members-manage-row" key={user.id}>
                    <span>{user.name}</span>
                    <span>{user.email}</span>
                    <span>{getLocalizedUserRoleLabel(user.role)}</span>
                    <span className={user.isActive ? 'status-active' : 'status-inactive'}>
                      {user.isActive ? t('team.management.active') : t('team.management.inactive')}
                    </span>
                    <span className="team-members-manage-actions">
                      {isProtectedSuperAdmin ? (
                        <span className="team-members-protected-badge">
                          <Shield size={12} />
                          {t('team.management.protected')}
                        </span>
                      ) : (
                        <div className="team-members-user-menu-wrap">
                          <button
                            type="button"
                            className="team-members-user-menu-trigger"
                            onClick={() => {
                              if (pendingUserId || pendingInvitationId) return;
                              setOpenUserMenuId((current) => (current === user.id ? null : user.id));
                            }}
                            disabled={pendingUserId !== null || pendingInvitationId !== null}
                            aria-label={t('team.management.userActions')}
                            aria-haspopup="menu"
                            aria-expanded={openUserMenuId === user.id}
                          >
                            <MoreVertical size={15} />
                          </button>

                          {openUserMenuId === user.id ? (
                            <div className="team-members-user-menu" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                className="team-members-user-menu-item"
                                onClick={() =>
                                  void handleChangeUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')
                                }
                                disabled={user.id === currentUserId || pendingUserId === user.id}
                                title={
                                  user.id === currentUserId
                                    ? t('team.management.cannotChangeOwnRole')
                                    : t('team.management.changeRole')
                                }
                              >
                                <Shield size={14} />
                                {user.role === 'admin' ? t('team.management.switchToMember') : t('team.management.switchToAdmin')}
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                className="team-members-user-menu-item"
                                onClick={() => void handleToggleUserActive(user.id, !user.isActive)}
                                disabled={pendingUserId === user.id || (user.id === currentUserId && user.isActive)}
                                title={
                                  user.id === currentUserId && user.isActive
                                    ? t('team.management.cannotDeactivateSelf')
                                    : t('team.management.changeStatus')
                                }
                              >
                                {user.isActive ? <UserRoundX size={14} /> : <UserRoundCheck size={14} />}
                                {user.isActive ? t('team.management.disable') : t('team.management.enable')}
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                className="team-members-user-menu-item danger"
                                onClick={() => void handleDeleteUser(user.id)}
                                disabled={user.id === currentUserId || pendingUserId === user.id}
                                title={user.id === currentUserId ? t('team.management.cannotDeleteOwnAccount') : t('team.management.deleteUser')}
                              >
                                <Trash2 size={14} />
                                {pendingUserId === user.id ? t('common.saving') : t('team.management.deleteUser')}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </span>
                  </div>
                  );
                })}
              </div>
            )}
          </article>

          <article className="team-members-manage-card">
            <header className="team-members-manage-card-header">
              <h2>{t('team.management.invitations')}</h2>
              <span>{sortedInvitations.length}</span>
            </header>

            {sortedInvitations.length === 0 ? (
              <p className="team-members-manage-empty">{t('team.management.noInvitations')}</p>
            ) : (
              <div className="team-members-manage-table">
                <div className="team-members-manage-row head invitations">
                  <span>{t('common.email')}</span>
                  <span>{t('team.management.status')}</span>
                  <span>{t('team.management.created')}</span>
                  <span>{t('team.management.expires')}</span>
                  <span>{t('team.management.actions')}</span>
                </div>
                {sortedInvitations.map((invitation) => {
                  const expiresAtTs = Date.parse(invitation.expiresAt);
                  const isExpiredByDate = !Number.isNaN(expiresAtTs) && expiresAtTs <= Date.now();
                  const effectiveStatus =
                    invitation.status === 'expired' || isExpiredByDate ? 'expired' : invitation.status;
                  const isInvitationActionDisabled =
                    effectiveStatus === 'expired' || pendingInvitationId === invitation.id || pendingUserId !== null;

                  return (
                    <div
                      className={`team-members-manage-row invitations ${
                        effectiveStatus === 'expired' ? 'invitation-row-disabled' : ''
                      }`}
                      key={invitation.id}
                    >
                      <span className="team-members-manage-email">
                        <Mail size={12} />
                        {invitation.email}
                      </span>
                      <span className={`invitation-status ${effectiveStatus}`}>
                        {effectiveStatus === 'pending'
                          ? t('team.management.pending')
                          : effectiveStatus === 'accepted'
                            ? t('team.management.accepted')
                            : t('team.management.expired')}
                      </span>
                      <span>{formatDate(invitation.createdAt, locale)}</span>
                      <span>{formatDate(invitation.expiresAt, locale)}</span>
                      <span className="team-members-manage-actions">
                        <button
                          type="button"
                          className="team-members-delete-button"
                          onClick={() => void handleDeleteInvitation(invitation.id)}
                          disabled={isInvitationActionDisabled}
                          title={effectiveStatus === 'expired' ? t('team.management.invitationExpired') : t('team.management.deleteInvitation')}
                        >
                          <Trash2 size={13} />
                          {pendingInvitationId === invitation.id ? t('team.management.deleting') : t('team.management.deleteInvitation')}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      </article>
    
    </section>
  );
}

export default TeamMembersManagePage;
