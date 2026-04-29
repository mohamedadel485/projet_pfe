import { Bell, Plus, UsersRound } from 'lucide-react';
import croissantIcon from '../../images/croissant.png';
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

  return (
    <section className="team-members-page">
      <article className="team-members-card">
        <p className="team-members-kicker">Team members</p>

        <div className="team-members-content">
          <h1 className="team-members-title">
            Invite your
            <span>Team members</span>
          </h1>

          <ul className="team-members-points">
            <li>
              <span className="team-members-point-icon" aria-hidden="true">
                <img src={croissantIcon} alt="" className="team-members-point-image" />
              </span>
              <p>
                Solve incidents faster, together. Keep every team member in the loop with their own access. Available in
                our Team and enterprise plans.
              </p>
            </li>
            <li>
              <span className="team-members-point-icon" aria-hidden="true">
                <Bell size={14} />
              </span>
              <p>Notify anyone without sharing your account with Notify-only seats.</p>
            </li>
          </ul>

          {canManageMembers ? (
            <div className="team-members-actions">
              <button type="button" className="team-members-invite-button" onClick={() => onInviteTeam?.()}>
                <Plus size={13} />
                Invite Team
              </button>
              <button
                type="button"
                className="team-members-manage-button"
                onClick={() => onManageUsers?.()}
              >
                <UsersRound size={13} />
                Manage users & invitations
              </button>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}

export default TeamMembersPage;
