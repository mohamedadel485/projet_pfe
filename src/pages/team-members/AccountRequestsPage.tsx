import {
  ArrowLeft,
  Trash2,
  UserCheck,
  UserX,
  X,
  Shield,
  Monitor,
} from "lucide-react";
import { useState } from "react";
import "./TeamMembersPage.css";

interface AccountRequest {
  id: string;
  email: string;
  name: string;
  message?: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
}

interface MonitorOption {
  id: string;
  name: string;
  protocol: string;
  status: "up" | "down" | "paused" | "pending";
}

interface AccountRequestsPageProps {
  accountRequests: AccountRequest[];
  isLoadingRequests: boolean;
  monitors: MonitorOption[];
  onBack: () => void;
  onApproveRequest: (
    requestId: string,
    role: "user" | "admin",
    monitorIds: string[],
  ) => void;
  onRejectRequest: (requestId: string) => void;
  onDeleteApprovedRequests?: () => void;
  onDeleteRejectedRequests?: () => void;
}

function AccountRequestsPage({
  accountRequests,
  isLoadingRequests,
  monitors,
  onBack,
  onApproveRequest,
  onRejectRequest,
  onDeleteApprovedRequests,
  onDeleteRejectedRequests,
}: AccountRequestsPageProps) {
  const pendingRequests = accountRequests.filter((r) => r.status === "pending");
  const approvedRequests = accountRequests.filter(
    (r) => r.status === "approved",
  );
  const rejectedRequests = accountRequests.filter(
    (r) => r.status === "rejected",
  );

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [selectedRole, setSelectedRole] = useState<"user" | "admin">("user");
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  const handleOpenApproveModal = (requestId: string) => {
    setSelectedRequestId(requestId);
    setSelectedRole("user");
    setSelectedMonitors([]);
    setShowApproveModal(true);
  };

  const handleCloseApproveModal = () => {
    setShowApproveModal(false);
    setSelectedRequestId(null);
    setSelectedRole("user");
    setSelectedMonitors([]);
  };

  const handleConfirmApprove = () => {
    if (selectedRequestId) {
      onApproveRequest(selectedRequestId, selectedRole, selectedMonitors);
      handleCloseApproveModal();
    }
  };

  const toggleMonitorSelection = (monitorId: string) => {
    setSelectedMonitors((prev) =>
      prev.includes(monitorId)
        ? prev.filter((id) => id !== monitorId)
        : [...prev, monitorId],
    );
  };

  const getMonitorStatusLabel = (status: MonitorOption["status"]): string => {
    if (status === "down") return "Down";
    if (status === "paused") return "Paused";
    if (status === "pending") return "Pending";
    return "Up";
  };

  return (
    <div className="team-management-page">
      {/* Header */}
      <div className="management-page-header">
        <div className="management-page-title">
          <h1>Demandes de création de compte</h1>
          <p className="management-page-subtitle">
            Gérer les demandes d'accès au système.
          </p>
        </div>
        <div className="management-page-actions">
          <button type="button" className="btn-outline" onClick={onBack}>
            <ArrowLeft size={16} />
            Retour
          </button>
        </div>
      </div>

      {/* Pending Requests Section */}
      <section className="management-card">
        <div className="management-card-header">
          <h2>Demandes en attente</h2>
          <span className="count-badge has-requests">
            {pendingRequests.length}
          </span>
        </div>
        <div className="requests-list-compact">
          {isLoadingRequests ? (
            <p className="loading-message">Chargement...</p>
          ) : pendingRequests.length === 0 ? (
            <p className="empty-row">Aucune demande en attente</p>
          ) : (
            pendingRequests.map((request) => (
              <div key={request.id} className="request-item">
                <div className="request-item-info">
                  <strong>{request.name}</strong>
                  <span>{request.email}</span>
                  <small>{formatDate(request.createdAt)}</small>
                  {request.message && (
                    <p className="request-message">{request.message}</p>
                  )}
                </div>
                <div className="request-item-actions">
                  <button
                    type="button"
                    className="btn-approve-sm"
                    onClick={() => handleOpenApproveModal(request.id)}
                  >
                    <UserCheck size={14} />
                    Approuver
                  </button>
                  <button
                    type="button"
                    className="btn-reject-sm"
                    onClick={() => onRejectRequest(request.id)}
                  >
                    <UserX size={14} />
                    Rejeter
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Approved Requests Section */}
      {approvedRequests.length > 0 && (
        <section className="management-card">
          <div className="management-card-header">
            <h2>Demandes approuvées</h2>
            <div className="management-card-actions">
              <span className="count-badge">{approvedRequests.length}</span>
              {onDeleteApprovedRequests && (
                <button
                  type="button"
                  className="btn-delete-sm"
                  onClick={onDeleteApprovedRequests}
                  disabled={isLoadingRequests}
                  title="Supprimer toutes les demandes approuvées"
                >
                  <Trash2 size={14} />
                  Tout supprimer
                </button>
              )}
            </div>
          </div>
          <div className="requests-list-compact">
            {approvedRequests.map((request) => (
              <div key={request.id} className="request-item">
                <div className="request-item-info">
                  <strong>{request.name}</strong>
                  <span>{request.email}</span>
                  <small>Approuvé le {formatDate(request.createdAt)}</small>
                </div>
                <span className="status-badge status-accepted">Approuvé</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rejected Requests Section */}
      {rejectedRequests.length > 0 && (
        <section className="management-card">
          <div className="management-card-header">
            <h2>Demandes rejetées</h2>
            <div className="management-card-actions">
              <span className="count-badge">{rejectedRequests.length}</span>
              {onDeleteRejectedRequests && (
                <button
                  type="button"
                  className="btn-delete-sm"
                  onClick={onDeleteRejectedRequests}
                  disabled={isLoadingRequests}
                  title="Supprimer toutes les demandes rejetées"
                >
                  <Trash2 size={14} />
                  Tout supprimer
                </button>
              )}
            </div>
          </div>
          <div className="requests-list-compact">
            {rejectedRequests.map((request) => (
              <div key={request.id} className="request-item">
                <div className="request-item-info">
                  <strong>{request.name}</strong>
                  <span>{request.email}</span>
                  <small>Rejeté le {formatDate(request.createdAt)}</small>
                </div>
                <span className="status-badge status-expired">Rejeté</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal d'approbation */}
      {showApproveModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Approuver la demande</h2>
              <button
                type="button"
                className="modal-close"
                onClick={handleCloseApproveModal}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <label className="form-label">Rôle</label>
                <div className="role-options">
                  <button
                    type="button"
                    className={`role-option ${selectedRole === "user" ? "selected" : ""}`}
                    onClick={() => setSelectedRole("user")}
                  >
                    <Monitor size={16} />
                    <span>Membre</span>
                  </button>
                  <button
                    type="button"
                    className={`role-option ${selectedRole === "admin" ? "selected" : ""}`}
                    onClick={() => setSelectedRole("admin")}
                  >
                    <Shield size={16} />
                    <span>Admin</span>
                  </button>
                </div>
              </div>

              <div className="form-section">
                <label className="form-label">Monitors accessibles</label>
                <div className="monitors-list">
                  {monitors.length === 0 ? (
                    <p className="empty-message">Aucun monitor disponible</p>
                  ) : (
                    monitors.map((monitor) => (
                      <div
                        key={monitor.id}
                        className={`monitor-item ${selectedMonitors.includes(monitor.id) ? "selected" : ""}`}
                        onClick={() => toggleMonitorSelection(monitor.id)}
                      >
                        <div className="monitor-icon">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="2"
                              y="3"
                              width="20"
                              height="14"
                              rx="2"
                              ry="2"
                            ></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                          </svg>
                        </div>
                        <div className="monitor-info">
                          <span className="monitor-name">{monitor.name}</span>
                          <div className="monitor-meta">
                            <span className="monitor-type">
                              {monitor.protocol}
                            </span>
                            <span
                              className={`monitor-status monitor-status-${monitor.status}`}
                            >
                              {getMonitorStatusLabel(monitor.status)}
                            </span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          className="monitor-input"
                          checked={selectedMonitors.includes(monitor.id)}
                          onChange={() => toggleMonitorSelection(monitor.id)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={handleCloseApproveModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmApprove}
                disabled={isLoadingRequests}
              >
                Confirmer l'approbation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountRequestsPage;
