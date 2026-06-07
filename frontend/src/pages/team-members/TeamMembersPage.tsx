import { Bell, Plus, UsersRound } from 'lucide-react';
import croissantIcon from '../../images/croissant.png';
import { useAppLanguage } from '../../lib/language';
import './TeamMembersPage.css';

interface TeamMembersPageProps {
  onInviteTeam?: () => void;
  onManageUsers?: () => void;
  canManageMembers?: boolean;
}

function TeamMembersPage({
  onInviteTeam,
  onManageUsers,
  canManageMembers = false,
}: TeamMembersPageProps) {
  const { t } = useAppLanguage();

  return (
    <section className="team-members-page">
      <article className="team-members-card">
        <p className="team-members-kicker">{t('team.invite.kicker')}</p>

        <div className="team-members-content">
          <h1 className="team-members-title">
            {t('team.invite.titleLead')}
            <span>{t('team.invite.titleHighlight')}</span>
          </h1>

          <ul className="team-members-points">
            <li>
              <span className="team-members-point-icon" aria-hidden="true">
                <img src={croissantIcon} alt="" className="team-members-point-image" />
              </span>
              <p>
                {t('team.members.copy1')}
              </p>
            </li>
            <li>
              <span className="team-members-point-icon" aria-hidden="true">
                <Bell size={14} />
              </span>
              <p>{t('team.members.copy2')}</p>
            </li>
          </ul>

          {canManageMembers ? (
            <div className="team-members-actions">
              <button type="button" className="team-members-invite-button" onClick={() => onInviteTeam?.()}>
                <Plus size={13} />
                {t('team.members.inviteTeam')}
              </button>
              <button
                type="button"
                className="team-members-manage-button"
                onClick={() => onManageUsers?.()}
              >
                <UsersRound size={13} />
                {t('team.members.manageUsersInvitations')}
              </button>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}

export default TeamMembersPage;
