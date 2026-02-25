import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import './InviteTeamMemberPage.css';

const monitorOptions = ['Metal 2000', 'HBHS', 'ODF interface', 'ODF API'];

function InviteTeamMemberPage() {
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);
  const [isMonitorListOpen, setIsMonitorListOpen] = useState(false);

  const toggleMonitor = (monitorName: string) => {
    setSelectedMonitors((prev) =>
      prev.includes(monitorName) ? prev.filter((name) => name !== monitorName) : [...prev, monitorName],
    );
  };

  return (
    <section className="invite-team-page">
      <article className="invite-team-card">
        <p className="invite-team-kicker">Team members</p>

        <div className="invite-team-content">
          <h1 className="invite-team-title">
            Invite <span>Team members</span>
          </h1>

          <form className="invite-team-form" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="invite-team-name">Name</label>
            <input id="invite-team-name" type="text" placeholder="User name" />

            <label htmlFor="invite-team-email">Email</label>
            <input id="invite-team-email" type="email" placeholder="username@gmail.com" />

            <label htmlFor="invite-team-role">Permission level</label>
            <div className="invite-team-select-shell">
              <select id="invite-team-role" defaultValue="Admin">
                <option>Admin</option>
                <option>Member</option>
                <option>Viewer</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>

            <label htmlFor="invite-team-monitors">Monitors</label>
            <div
              className={`invite-team-multi-select ${isMonitorListOpen ? 'open' : ''}`}
              id="invite-team-monitors"
              aria-label="Selected monitors"
              onClick={() => setIsMonitorListOpen((prev) => !prev)}
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
                  >
                    <span>{monitorName}</span>
                    <span className="invite-team-monitor-dot" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}

            <button type="submit" className="invite-team-submit-button">
              Invite Team
            </button>
          </form>
        </div>
      </article>
    </section>
  );
}

export default InviteTeamMemberPage;
