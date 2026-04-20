import {
  ArrowLeft,
  Mail,
  MoreVertical,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import "./TeamMembersPage.css";

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
  onChangeUserRole: (userId: string, role: EditableUserRole) => void;
  onToggleUserActive: (userId: string, isActive: boolean) => void;
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
  onChangeUserRole,
  onToggleUserActive,
  onDeleteInvitation,
  onApproveRequest,
  onRejectRequest,
}: TeamMembersManagementPageProps) {
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingRequests = accountRequests.filter((r) => r.status === "pending");
  const showInlineAccountRequests = false;
  const isCurrentUserSuperAdmin = currentUserRole === "super_admin";

  // Trier les utilisateurs: super admin en premier, puis par nom
  const sortedUsers = [...users].sort((a, b) => {
    const aIsSuper =
      a.role === "super_admin" || a.name?.toLowerCase().includes("super_admin");
    const bIsSuper =
      b.role === "super_admin" || b.name?.toLowerCase().includes("super_admin");
    if (aIsSuper && !bIsSuper) return -1;
    if (!aIsSuper && bIsSuper) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Fermer le menu quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuUserId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  return (
    <div className="team-management-page">
      {/* Header */}
      <div className="management-page-header">
        <div className="management-page-title">
          <h1>Users & invitations</h1>
          <p className="management-page-subtitle">
            Gerer les comptes et suivre les invitations en attente.
          </p>
        </div>
        <div className="management-page-actions">
          <button type="button" className="btn-outline" onClick={onBack}>
            <ArrowLeft size={16} />
            Retour
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
              Demandes
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
            <div className="empty-row">Aucun utilisateur trouvé</div>
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
                      <span className="role-text">Membre</span>
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
                      <div
                        className="action-menu-container"
                        ref={openMenuUserId === user.id ? menuRef : undefined}
                      >
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() =>
                            setOpenMenuUserId(
                              openMenuUserId === user.id ? null : user.id,
                            )
                          }
                          title="Actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuUserId === user.id && (
                          <div className="action-menu">
                            <button
                              type="button"
                              className="action-menu-item"
                              onClick={() => {
                                onChangeUserRole(
                                  user.id,
                                  user.role === "admin" ? "user" : "admin",
                                );
                                setOpenMenuUserId(null);
                              }}
                            >
                              <Shield size={16} />
                              Passer{" "}
                              {user.role === "admin" ? "Membre" : "Admin"}
                            </button>
                            <button
                              type="button"
                              className="action-menu-item"
                              onClick={() => {
                                onToggleUserActive(user.id, !user.isActive);
                                setOpenMenuUserId(null);
                              }}
                            >
                              <UserX size={16} />
                              {user.isActive ? "Désactiver" : "Activer"}
                            </button>
                            <button
                              type="button"
                              className="action-menu-item action-menu-item-danger"
                              onClick={() => {
                                onDeleteUser(user.id);
                                setOpenMenuUserId(null);
                              }}
                            >
                              <Trash2 size={16} />
                              Supprimer user
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

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
            <div className="empty-row">Aucune invitation</div>
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
                    title="Supprimer l'invitation"
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
            <h2>Demandes de compte</h2>
            <span className="count-badge has-requests">
              {pendingRequests.length}
            </span>
          </div>
          <div className="requests-list-compact">
            {isLoadingRequests ? (
              <p className="loading-message">Chargement...</p>
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
      )}
    </div>
  );
}

export default TeamMembersManagementPage;
