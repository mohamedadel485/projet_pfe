import { ChevronDown } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import './InviteTeamMemberPage.css';

interface InvitePayload {
  name: string;
  email: string;
  role: 'admin' | 'member';
  monitorNames: string[];
}

interface InviteTeamMemberPageProps {
  monitorOptions?: string[];
  onInviteTeam?: (payload: InvitePayload) => Promise<string | null>;
}

const defaultMonitorOptions = ['Metal 2000', 'HBHS', 'ODF interface', 'ODF API'];

function InviteTeamMemberPage({ monitorOptions = defaultMonitorOptions, onInviteTeam }: InviteTeamMemberPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('admin');
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);
  const [isMonitorListOpen, setIsMonitorListOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const toggleMonitor = (monitorName: string) => {
    if (isSubmitting) return;
    setSelectedMonitors((prev) =>
      prev.includes(monitorName) ? prev.filter((name) => name !== monitorName) : [...prev, monitorName],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onInviteTeam || isSubmitting) return;

    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    const error = await onInviteTeam({
      name: name.trim(),
      email: email.trim(),
      role,
      monitorNames: selectedMonitors,
    });

    if (error) {
      setSubmitError(error);
      setIsSubmitting(false);
      return;
    }

    setName('');
    setEmail('');
    setRole('admin');
    setSelectedMonitors([]);
    setIsMonitorListOpen(false);
    setSubmitSuccess('Invitation envoyee avec succes.');
    setIsSubmitting(false);
  };

  return (
    <section className="invite-team-page">
      <article className="invite-team-card">
        <p className="invite-team-kicker">Team members</p>

        <div className="invite-team-content">
          <h1 className="invite-team-title">
            Invite <span>Team members</span>
          </h1>

          <form className="invite-team-form" onSubmit={handleSubmit}>
            <label htmlFor="invite-team-name">Name</label>
            <input
              id="invite-team-name"
              type="text"
              placeholder="User name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
            />

            <label htmlFor="invite-team-email">Email</label>
            <input
              id="invite-team-email"
              type="email"
              placeholder="username@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
            />

            <label htmlFor="invite-team-role">Permission level</label>
            <div className="invite-team-select-shell">
              <select
                id="invite-team-role"
                value={role}
                onChange={(event) => setRole(event.target.value as 'admin' | 'member')}
                disabled={isSubmitting}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>

            <label htmlFor="invite-team-monitors">Monitors</label>
            <div
              className={`invite-team-multi-select ${isMonitorListOpen ? 'open' : ''}`}
              id="invite-team-monitors"
              aria-label="Selected monitors"
              onClick={() => {
                if (isSubmitting) return;
                setIsMonitorListOpen((prev) => !prev);
              }}
            >
              <div className="invite-team-selected-chips">
                {selectedMonitors.length === 0 ? (
                  <span className="invite-team-selected-placeholder">Select monitors</span>
                ) : (
                  selectedMonitors.map((monitorName) => (
                    <button
                      key={monitorName}
                      type="button"
                      className="invite-team-chip"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMonitor(monitorName);
                      }}
                    >
                      <span>{monitorName}</span>
                      <span className="invite-team-chip-dot" aria-hidden="true" />
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                className="invite-team-multi-toggle"
                aria-label={isMonitorListOpen ? 'Close monitors list' : 'Open monitors list'}
                onClick={(event) => {
                  if (isSubmitting) return;
                  event.stopPropagation();
                  setIsMonitorListOpen((prev) => !prev);
                }}
              >
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </div>

            {isMonitorListOpen && (
              <div className="invite-team-monitor-list">
                {monitorOptions.map((monitorName) => (
                  <button
                    key={monitorName}
                    type="button"
                    className={`invite-team-monitor-row ${selectedMonitors.includes(monitorName) ? 'selected' : ''}`}
                    onClick={() => toggleMonitor(monitorName)}
                    disabled={isSubmitting}
                  >
                    <span>{monitorName}</span>
                    <span className="invite-team-monitor-dot" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}

            {submitError ? <p className="invite-team-feedback error">{submitError}</p> : null}
            {submitSuccess ? <p className="invite-team-feedback success">{submitSuccess}</p> : null}

            <button
              type="submit"
              className="invite-team-submit-button"
              disabled={email.trim() === '' || isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Invite Team'}
            </button>
          </form>
        </div>
      </article>
    </section>
  );
}

export default InviteTeamMemberPage;
