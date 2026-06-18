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
import { useAppLanguage } from "../../lib/language";
import { canManageUser as canManageTargetUser } from "../../lib/roles";
import type { UserRole } from "../../lib/api";

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
  const { language, t } = useAppLanguage();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingRole, setEditingRole] = useState<EditableUserRole>("user");
  const [editingIsActive, setEditingIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const pendingRequests = accountRequests.filter((r) => r.status === "pending");
  const showInlineAccountRequests = false;

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
    const locale = language === "fr" ? "fr-FR" : language === "ar" ? "ar-TN" : "en-US";
    return new Date(dateStr).toLocaleDateString(locale);
  };

  const getRoleLabel = (role: string) => {
    const normalizedRole = String(role ?? "").toLowerCase();
    if (
      normalizedRole === "super" ||
      normalizedRole === "superadmin" ||
      normalizedRole === "super_admin"
    ) {
      return t("team.management.roleSuperAdmin");
    }
    if (normalizedRole === "admin") {
      return t("team.management.roleAdmin");
    }
    return t("team.management.roleMember");
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

    setEditSaving(true);
    setEditError(null);
    try {
      const errorMessage = await onUpdateUser(editingUserId, {
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
          <h1>{t("team.management.title")}</h1>
          <p className="management-page-subtitle">
            {t("team.management.subtitle")}
          </p>
        </div>
        <div className="management-page-actions">
          <button type="button" className="btn-outline" onClick={onBack}>
            <ArrowLeft size={16} />
            {t("team.management.back")}
          </button>
          <button
            type="button"
            className="btn-primary btn-requests"
            onClick={onInviteTeam}
          >
            <Plus size={16} />
            {t("team.management.inviteTeam")}
          </button>
          {onManageRequests && (
            <button
              type="button"
              className="btn-primary btn-requests"
              onClick={onManageRequests}
            >
              <UserCheck size={16} />
              {t("team.management.requests")}
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
          <h2>{t("team.management.users")}</h2>
          <span className="count-badge">{users.length}</span>
        </div>
        <div className="management-table">
          <div className="table-row table-header-row">
            <span>{t("common.name").toUpperCase()}</span>
            <span>{t("common.email").toUpperCase()}</span>
            <span>{t("common.role").toUpperCase()}</span>
            <span>{t("team.management.status").toUpperCase()}</span>
            <span>{t("team.management.actions").toUpperCase()}</span>
          </div>
          {users.length === 0 ? (
            <div className="empty-row">{t("team.management.noUsers")}</div>
          ) : (
            sortedUsers.map((user) => {
              const normalizedRole = String(user.role ?? "").toLowerCase();
              const isTargetSuperAdmin =
                normalizedRole === "super" ||
                normalizedRole === "superadmin" ||
                normalizedRole === "super_admin" ||
                user.name?.toLowerCase().includes("super_admin");
              const targetRole = normalizedRole === "admin" ? "admin" : normalizedRole === "super_admin" || normalizedRole === "super" || normalizedRole === "superadmin" ? "super_admin" : "user";
              const managerRole = (currentUserRole === "super_admin" || currentUserRole === "admin" ? currentUserRole : "user") as UserRole;
              const canManageUser =
                user.id !== currentUserId &&
                !isTargetSuperAdmin &&
                canManageTargetUser(managerRole, targetRole as UserRole);

              return (
                <div
                  key={user.id}
                  className={`table-row ${!user.isActive ? "inactive" : ""} ${user.id === currentUserId ? "current-user" : ""}`}
                >
                  <span className="cell-name">{user.name || "-"}</span>
                  <span className="cell-email">{user.email}</span>
                  <span className="cell-role">
                    {isTargetSuperAdmin ? (
                      <span className="role-text role-super">{t("team.management.roleSuperAdmin")}</span>
                    ) : targetRole === "admin" ? (
                      <span className="role-text role-admin">{t("team.management.roleAdmin")}</span>
                    ) : (
                      <span className="role-text">{t("team.management.roleMember")}</span>
                    )}
                  </span>
                  <span className="cell-status">
                    <span
                      className={`status-badge ${user.isActive ? "status-active" : "status-inactive"}`}
                    >
                      {user.isActive ? t("team.management.active") : t("team.management.inactive")}
                    </span>
                  </span>
                  <span className="cell-actions">
                    {canManageUser && (
                      <div className="action-menu-container">
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => openEditUserModal(user)}
                          title={
                            targetRole === "admin"
                              ? t("team.management.editAdminTitle")
                              : t("team.management.editUserTitle")
                          }
                        >
                          <MoreVertical size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-delete"
                          onClick={() => {
                            // confirmation before delete
                            // eslint-disable-next-line no-restricted-globals
                            if (window.confirm(t("team.management.deleteUser"))) {
                              onDeleteUser(user.id);
                            }
                          }}
                          title={t("team.management.deleteUser")}
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
              <h2>
                {editingRole === "admin"
                  ? t("team.management.editAdminTitle")
                  : t("team.management.editUserTitle")}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeEditUserModal}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-section">
                <label className="form-label" htmlFor="team-user-name">
                  {t("common.name")}
                </label>
                <input
                  id="team-user-name"
                  className="form-input form-input-readonly"
                  type="text"
                  value={editingName}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </div>

              <div className="form-section">
                <label className="form-label" htmlFor="team-user-email">
                  {t("common.email")}
                </label>
                <input
                  id="team-user-email"
                  className="form-input form-input-readonly"
                  type="email"
                  value={editingEmail}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </div>

              <div className="form-section">
                <label className="form-label">{t("common.role")}</label>
                <div className="role-options">
                  <button
                    type="button"
                    className={`role-option ${editingRole === "user" ? "selected" : ""}`}
                    onClick={() => setEditingRole("user")}
                  >
                    <UserX size={16} />
                    <span>{t("team.management.roleMember")}</span>
                  </button>
                  <button
                    type="button"
                    className={`role-option ${editingRole === "admin" ? "selected" : ""}`}
                    onClick={() => setEditingRole("admin")}
                  >
                    <Shield size={16} />
                    <span>{t("team.management.roleAdmin")}</span>
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
                  <span>{t("team.management.active")}</span>
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
                  {t("common.cancel")}
                </button>
                
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleSaveEditUser()}
                  disabled={editSaving}
                >
                  {editSaving ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invitations Section */}
      <section className="management-card">
        <div className="management-card-header">
          <h2>{t("team.management.invitations")}</h2>
          <span className="count-badge">{invitations.length}</span>
        </div>
        <div className="management-table">
          <div className="table-row table-header-row">
            <span>{t("common.email").toUpperCase()}</span>
            <span>{t("team.management.status").toUpperCase()}</span>
            <span>{t("team.management.created").toUpperCase()}</span>
            <span>{t("team.management.expires").toUpperCase()}</span>
            <span>{t("team.management.actions").toUpperCase()}</span>
          </div>
          {invitations.length === 0 ? (
            <div className="empty-row">{t("team.management.noInvitations")}</div>
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
                      ? t("team.management.accepted")
                      : invitation.status === "pending"
                        ? t("team.management.pending")
                        : t("team.management.expired")}
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
                    title={t("team.management.deleteInvitation")}
                  >
                    <Trash2 size={14} />
                    {t("team.management.deleteInvitation")}
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
            <h2>{t("users.accountRequests")}</h2>
            <span className="count-badge has-requests">
              {pendingRequests.length}
            </span>
          </div>
          <div className="requests-list-compact">
            {isLoadingRequests ? (
              <p className="loading-message">{t("team.management.loading")}</p>
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
                      {t("team.management.approve")}
                    </button>
                    <button
                      type="button"
                      className="btn-reject-sm"
                      onClick={() => onRejectRequest(request.id)}
                    >
                      <UserX size={14} />
                      {t("team.management.reject")}
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
