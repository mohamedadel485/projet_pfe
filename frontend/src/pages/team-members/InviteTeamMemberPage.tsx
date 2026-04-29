import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import './InviteTeamMemberPage.css';

interface InvitePayload {
  name: string;
  email: string;
  role: 'admin' | 'member';
  monitorIds: string[];
}

interface MonitorOption {
  id: string;
  name: string;
}

interface InviteTeamMemberPageProps {
  monitorOptions?: MonitorOption[];
  currentUserRole?: "super_admin" | "admin" | "user";
  onInviteTeam?: (payload: InvitePayload) => Promise<{ error?: string | null; notice?: string | null }>;
}

const defaultMonitorOptions: MonitorOption[] = [
  { id: 'metal-2000', name: 'Metal 2000' },
  { id: 'hbhs', name: 'HBHS' },
  { id: 'odf-interface', name: 'ODF interface' },
  { id: 'odf-api', name: 'ODF API' },
];

function InviteTeamMemberPage({
  monitorOptions = defaultMonitorOptions,
  currentUserRole = "user",
  onInviteTeam,
}: InviteTeamMemberPageProps) {
  const canInviteAdmins = currentUserRole === "super_admin";
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [isMonitorListOpen, setIsMonitorListOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const availableRoleOptions = useMemo(
    () =>
      canInviteAdmins
        ? [
            { value: 'member', label: 'Member' },
            { value: 'admin', label: 'Admin' },
          ]
        : [{ value: 'member', label: 'Member' }],
    [canInviteAdmins],
  );

  useEffect(() => {
    if (!canInviteAdmins && role === 'admin') {
      setRole('member');
    }
  }, [canInviteAdmins, role]);

  const toggleMonitor = (monitorId: string) => {
    if (isSubmitting) return;
    setSelectedMonitorIds((prev) =>
      prev.includes(monitorId) ? prev.filter((id) => id !== monitorId) : [...prev, monitorId],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onInviteTeam || isSubmitting) return;

    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    const result = await onInviteTeam({
      name: name.trim(),
      email: email.trim(),
      role,
      monitorIds: selectedMonitorIds,
    });

    if (result.error) {
      setSubmitError(result.error);
      setIsSubmitting(false);
      return;
    }

    setName('');
    setEmail('');
    setRole('member');
    setSelectedMonitorIds([]);
    setIsMonitorListOpen(false);
    setSubmitSuccess(result.notice ?? 'Invitation created.');
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
                {availableRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
            {!canInviteAdmins ? (
              <p className="invite-team-feedback">
                Only the super admin can invite another admin.
              </p>
            ) : null}

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
                {selectedMonitorIds.length === 0 ? (
                  <span className="invite-team-selected-placeholder">Select monitors</span>
                ) : (
                  selectedMonitorIds.map((monitorId) => {
                    const label = monitorOptions.find((option) => option.id === monitorId)?.name ?? monitorId;
                    return (
                    <button
                      key={monitorId}
                      type="button"
                      className="invite-team-chip"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMonitor(monitorId);
                      }}
                    >
                      <span>{label}</span>
                      <span className="invite-team-chip-dot" aria-hidden="true" />
                    </button>
                  );
                  })
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
                {monitorOptions.map((monitorOption) => (
                  <button
                    key={monitorOption.id}
                    type="button"
                    className={`invite-team-monitor-row ${selectedMonitorIds.includes(monitorOption.id) ? 'selected' : ''}`}
                    onClick={() => toggleMonitor(monitorOption.id)}
                    disabled={isSubmitting}
                  >
                    <span>{monitorOption.name}</span>
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
              disabled={name.trim() === '' || email.trim() === '' || isSubmitting}
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
