import {
  ArrowLeft,
  Mail,
  MoreVertical,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useState } from "react";

interface TeamMember {
  id: string;
  name?: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface Invitation {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  createdAt: string;
  expiresAt: string;
}

interface AccountRequest {
  id: string;
  email: string;
  name: string;
  message?: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
}

type EditableUserRole = "user" | "admin";

interface TeamMembersManagementPageProps {
  users: TeamMember[];
  invitations: Invitation[];
  accountRequests: AccountRequest[];
  isLoadingRequests: boolean;
  currentUserId: string;
  currentUserRole: string;
  onBack: () => void;
  onInviteTeam: () => void;
  onManageRequests?: () => void;
  onDeleteUser: (userId: string) => void;
  onUpdateUser: (
    userId: string,
    updates: Partial<{
      name: string;
      email: string;
      role: EditableUserRole;
      isActive: boolean;
    }>,
  ) => Promise<string | null>;
  onDeleteInvitation: (invitationId: string) => void;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
}

function TeamMembersManagementPage({
  users,
  invitations,
  accountRequests,
  isLoadingRequests,
  currentUserId,
  currentUserRole,
  onBack,
  onInviteTeam,
  onManageRequests,
  onDeleteUser,
  onUpdateUser,
  onDeleteInvitation,
  onApproveRequest,
  onRejectRequest,
}: TeamMembersManagementPageProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingRole, setEditingRole] = useState<EditableUserRole>("user");
  const [editingIsActive, setEditingIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editingImmutableContact, setEditingImmutableContact] = useState(false);
  const pendingRequests = accountRequests.filter((r) => r.status === "pending");
  const showInlineAccountRequests = false;
  const isCurrentUserSuperAdmin = currentUserRole === "super_admin";

  // Sort users: super admin first, then by name
  const sortedUsers = [...users].sort((a, b) => {
    const aIsSuper =
      a.role === "super_admin" || a.name?.toLowerCase().includes("super_admin");
    const bIsSuper =
      b.role === "super_admin" || b.name?.toLowerCase().includes("super_admin");
    if (aIsSuper && !bIsSuper) return -1;
    if (!aIsSuper && bIsSuper) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US");
  };

  const getRoleLabel = (role: string) => {
    const normalizedRole = String(role ?? "").toLowerCase();
    if (
      normalizedRole === "super" ||
      normalizedRole === "superadmin" ||
      normalizedRole === "super_admin"
    ) {
      return "Super Admin";
    }
    if (normalizedRole === "admin") {
      return "Admin";
    }
    return "Membre";
  };

  const openEditUserModal = (user: TeamMember) => {
    setEditingUserId(user.id);
    setEditingName(user.name ?? "");
    setEditingEmail(user.email);
    setEditingRole(
      (user.role === "admin" ? "admin" : "user") as EditableUserRole,
    );
    setEditingIsActive(user.isActive);
    setEditError(null);
    const normalizedRole = String(user.role ?? "").toLowerCase();
    const isTargetSuperAdmin =
      normalizedRole === "super" ||
      normalizedRole === "superadmin" ||
      normalizedRole === "super_admin" ||
      user.name?.toLowerCase().includes("super_admin");
    const isTargetAdmin = normalizedRole === "admin";
    setEditingImmutableContact(isTargetSuperAdmin || isTargetAdmin);
  };

  const closeEditUserModal = () => {
    if (editSaving) return;
    setEditingUserId(null);
    setEditingName("");
    setEditingEmail("");
    setEditingRole("user");
    setEditingIsActive(true);
    setEditError(null);
  };

  const handleSaveEditUser = async () => {
    if (!editingUserId) return;
    const trimmedName = editingName.trim();
    const trimmedEmail = editingEmail.trim();

    if (trimmedName === "") {
      setEditError("Le nom est requis.");
      return;
    }
    if (trimmedEmail === "") {
      setEditError("L'email est requis.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEditError("Format d'email invalide.");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const errorMessage = await onUpdateUser(editingUserId, {
        name: trimmedName,
        email: trimmedEmail,
        role: editingRole,
        isActive: editingIsActive,
      });
      if (errorMessage) {
        setEditError(errorMessage);
        return;
      }
      closeEditUserModal();
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="team-management-page">
      {/* Header */}
      <div className="management-page-header">
        <div className="management-page-title">
          <h1>Users & invitations</h1>
          <p className="management-page-subtitle">
            Manage accounts and track pending invitations.
          </p>
        </div>
        <div className="management-page-actions">
          <button type="button" className="btn-outline" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
          <button
            type="button"
            className="btn-primary btn-requests"
            onClick={onInviteTeam}
          >
            <Plus size={16} />
            Invite Team
          </button>
          {onManageRequests && (
            <button
              type="button"
              className="btn-primary btn-requests"
              onClick={onManageRequests}
            >
              <UserCheck size={16} />
              Requests
              {pendingRequests.length > 0 && (
                <span className="btn-badge">{pendingRequests.length}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Users Section */}
      <section className="management-card">
        <div className="management-card-header">
          <h2>Users</h2>
          <span className="count-badge">{users.length}</span>
        </div>
        <div className="management-table">
          <div className="table-row table-header-row">
            <span>NAME</span>
            <span>EMAIL</span>
            <span>ROLE</span>
            <span>STATUS</span>
            <span>ACTIONS</span>
          </div>
          {users.length === 0 ? (
            <div className="empty-row">No users found</div>
          ) : (
            sortedUsers.map((user) => {
              const normalizedRole = String(user.role ?? "").toLowerCase();
              const isTargetSuperAdmin =
                normalizedRole === "super" ||
                normalizedRole === "superadmin" ||
                normalizedRole === "super_admin" ||
                user.name?.toLowerCase().includes("super_admin");
              const isTargetAdmin = normalizedRole === "admin";
              const canManageUser =
                user.id !== currentUserId &&
                !isTargetSuperAdmin &&
                (isCurrentUserSuperAdmin || !isTargetAdmin);

              return (
                <div
                  key={user.id}
                  className={`table-row ${!user.isActive ? "inactive" : ""} ${user.id === currentUserId ? "current-user" : ""}`}
                >
                  <span className="cell-name">{user.name || "-"}</span>
                  <span className="cell-email">{user.email}</span>
                  <span className="cell-role">
                    {isTargetSuperAdmin ? (
                      <span className="role-text role-super">Super Admin</span>
                    ) : isTargetAdmin ? (
                      <span className="role-text role-admin">Admin</span>
                    ) : (
                      <span className="role-text">Member</span>
                    )}
                  </span>
                  <span className="cell-status">
                    <span
                      className={`status-badge ${user.isActive ? "status-active" : "status-inactive"}`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </span>
                  <span className="cell-actions">
                    {canManageUser && (
                      <div className="action-menu-container">
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => openEditUserModal(user)}
                          title="Editer l'utilisateur"
                        >
                          <MoreVertical size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-delete"
                          onClick={() => {
                            // confirmation before delete
                            // eslint-disable-next-line no-restricted-globals
                            if (window.confirm("Supprimer cet utilisateur ?")) {
                              onDeleteUser(user.id);
                            }
                          }}
                          title="Supprimer l'utilisateur"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {editingUserId && (
        <div className="modal-overlay" onClick={closeEditUserModal}>
          <div
            className="modal-content team-user-edit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Editer l'utilisateur</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeEditUserModal}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {!editingImmutableContact ? (
                <>
                  <div className="form-section">
                    <label className="form-label" htmlFor="team-user-name">
                      Nom
                    </label>
                    <input
                      id="team-user-name"
                      className="form-input"
                      type="text"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                    />
                  </div>

                  <div className="form-section">
                    <label className="form-label" htmlFor="team-user-email">
                      Email
                    </label>
                    <input
                      id="team-user-email"
                      className="form-input"
                      type="email"
                      value={editingEmail}
                      onChange={(event) => setEditingEmail(event.target.value)}
                    />
                  </div>
                </>
              ) : (
                <p className="form-note">Le nom et l'email ne peuvent pas être modifiés pour les administrateurs.</p>
              )}

              <div className="form-section">
                <label className="form-label">Rôle</label>
                <div className="role-options">
                  <button
                    type="button"
                    className={`role-option ${editingRole === "user" ? "selected" : ""}`}
                    onClick={() => setEditingRole("user")}
                  >
                    <UserX size={16} />
                    <span>Membre</span>
                  </button>
                  <button
                    type="button"
                    className={`role-option ${editingRole === "admin" ? "selected" : ""}`}
                    onClick={() => setEditingRole("admin")}
                  >
                    <Shield size={16} />
                    <span>Admin</span>
                  </button>
                </div>
                <p className="team-user-edit-note">
                  {getRoleLabel(editingRole)}
                </p>
              </div>

              <div className="form-section">
                <label className="team-user-active-toggle">
                  <input
                    type="checkbox"
                    checked={editingIsActive}
                    onChange={(event) =>
                      setEditingIsActive(event.target.checked)
                    }
                  />
                  <span>Compte actif</span>
                </label>
              </div>

              {editError ? <p className="form-error">{editError}</p> : null}

              <div className="modal-actions team-user-edit-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={closeEditUserModal}
                  disabled={editSaving}
                >
                  Annuler
                </button>
                
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleSaveEditUser()}
                  disabled={editSaving}
                >
                  {editSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invitations Section */}
      <section className="management-card">
        <div className="management-card-header">
          <h2>Invitations</h2>
          <span className="count-badge">{invitations.length}</span>
        </div>
        <div className="management-table">
          <div className="table-row table-header-row">
            <span>EMAIL</span>
            <span>STATUS</span>
            <span>CREATED</span>
            <span>EXPIRES</span>
            <span>ACTIONS</span>
          </div>
          {invitations.length === 0 ? (
            <div className="empty-row">No invitation</div>
          ) : (
            invitations.map((invitation) => (
              <div key={invitation.id} className="table-row">
                <span className="cell-email-with-icon">
                  <Mail size={14} />
                  {invitation.email}
                </span>
                <span className="cell-status">
                  <span className={`status-badge status-${invitation.status}`}>
                    {invitation.status === "accepted"
                      ? "Accepted"
                      : invitation.status === "pending"
                        ? "Pending"
                        : "Expired"}
                  </span>
                </span>
                <span className="cell-date">
                  {formatDate(invitation.createdAt)}
                </span>
                <span className="cell-date">
                  {formatDate(invitation.expiresAt)}
                </span>
                <span className="cell-actions">
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => onDeleteInvitation(invitation.id)}
                    title="Delete invitation"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Account Requests Section (if any pending) */}
      {showInlineAccountRequests && pendingRequests.length > 0 && (
        <section className="management-card requests-section">
          <div className="management-card-header">
            <h2>Account requests</h2>
            <span className="count-badge has-requests">
              {pendingRequests.length}
            </span>
          </div>
          <div className="requests-list-compact">
            {isLoadingRequests ? (
              <p className="loading-message">Loading...</p>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className="request-item">
                  <div className="request-item-info">
                    <strong>{request.name}</strong>
                    <span>{request.email}</span>
                  </div>
                  <div className="request-item-actions">
                    <button
                      type="button"
                      className="btn-approve-sm"
                      onClick={() => onApproveRequest(request.id)}
                    >
                      <UserCheck size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn-reject-sm"
                      onClick={() => onRejectRequest(request.id)}
                    >
                      <UserX size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default TeamMembersManagementPage;
