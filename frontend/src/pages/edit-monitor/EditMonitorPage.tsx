import { ChevronRight, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import './EditMonitorPage.css';

interface EditableMonitor {
  id: string;
  name: string;
  url?: string;
}

type EditMonitorSideSection = 'details' | 'integrations' | 'maintenance';

interface EditMonitorPageProps {
  monitor: EditableMonitor;
  onBack: () => void;
  onOpenMonitorDetails: () => void;
  onOpenIntegrationsTeam?: () => void;
  onOpenMaintenanceInfo?: () => void;
  initialSection?: EditMonitorSideSection;
}

function EditMonitorPage({
  monitor,
  onBack,
  onOpenMonitorDetails,
  onOpenIntegrationsTeam,
  onOpenMaintenanceInfo,
  initialSection = 'integrations',
}: EditMonitorPageProps) {
  const editLabel = monitor.name === 'Metal 2000 Website' ? 'Metal 2000 website' : monitor.name;
  const [activeSideSection, setActiveSideSection] = useState<EditMonitorSideSection>(initialSection);

  useEffect(() => {
    setActiveSideSection(initialSection);
  }, [initialSection]);

  return (
    <section className="edit-monitor-page">
      <div className="edit-monitor-breadcrumb">
        <button type="button" className="edit-monitor-breadcrumb-link" onClick={onBack}>
          Monitoring
        </button>
        <ChevronRight size={14} />
        <span>Monitoring</span>
      </div>

      <h2 className="edit-monitor-title">Edit {editLabel}</h2>

      <div className="edit-monitor-content-grid">
        <div className="edit-monitor-main">
          <section className="edit-monitor-card">
            <div className="edit-monitor-notify-shell">
              <div className="edit-monitor-card-header">
                <h3>Notify team members</h3>

                <div className="edit-monitor-actions">
                  <label className="edit-monitor-search">
                    <Search size={13} />
                    <input type="text" placeholder="Search by name or url" />
                  </label>

                  <button type="button" className="edit-monitor-manage-btn">
                    <Users size={13} />
                    Manage team
                  </button>
                </div>
              </div>

              <div className="edit-monitor-empty-state">
                <p className="edit-monitor-empty-title">
                  <span>Notify</span> anyone via e-mail, SMS or voice call
                </p>
                <p>Solve incidents faster, together. Keep every team member in the loop with their own access.</p>
                <p>Available on our Team and Enterprise plans.</p>
                <p>Notify anyone without sharing your account with Notify-only seats.</p>
              </div>
            </div>
          </section>

          <section className="edit-monitor-submit-card">
            <button type="button">Create monitor</button>
          </section>
        </div>

        <aside className="edit-monitor-side-card">
          <button
            type="button"
            className={`edit-monitor-side-title-link ${activeSideSection === 'details' ? 'active' : ''}`}
            onClick={() => {
              setActiveSideSection('details');
              onOpenMonitorDetails();
            }}
          >
            Monitor details
          </button>
          <button
            type="button"
            className={`edit-monitor-side-link ${activeSideSection === 'integrations' ? 'active' : ''}`}
            onClick={() => {
              setActiveSideSection('integrations');
              onOpenIntegrationsTeam?.();
            }}
          >
            Integrations & Team
          </button>
          <button
            type="button"
            className={`edit-monitor-side-link ${activeSideSection === 'maintenance' ? 'active' : ''}`}
            onClick={() => {
              setActiveSideSection('maintenance');
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
