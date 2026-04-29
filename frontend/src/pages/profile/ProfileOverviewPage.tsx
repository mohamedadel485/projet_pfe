import {
  ChevronDown,
  ChevronRight,
  X,
  LayoutDashboard,
  LogOut,
  Wrench,
  Settings2,
  UserCircle2,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { AuthUser } from "../../lib/api";
import { resolveAvatarUrl } from "../../lib/api";
import monitoringMenuIcon from "../../images/m1.png";
import ExclamationHexagonIcon from "../../ExclamationHexagonIcon";

interface ProfileOverviewPageProps {
  authToken?: string | null;
  currentUser?: AuthUser | null;
  onGoDashboard: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

const roleLabel = (role?: AuthUser["role"]): string => {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    default:
      return "User";
  }
};

const ProfileOverviewPage = ({
  authToken,
  currentUser,
  onGoDashboard,
  onOpenSettings,
  onLogout,
}: ProfileOverviewPageProps) => {
  const displayName = currentUser?.name || currentUser?.email || "Account";
  const displayEmail = currentUser?.email || "No email available";
  const avatarUrl = currentUser?.avatar
    ? resolveAvatarUrl(currentUser.avatar)
    : null;
  const sessionState = authToken ? "Connected" : "Offline";
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const initials =
    (currentUser?.name || currentUser?.email || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "S";

  return (
    <div className="profile-page-shell">
      <span
        className="profile-page-orb profile-page-orb-left"
        aria-hidden="true"
      />
      <span
        className="profile-page-orb profile-page-orb-right"
        aria-hidden="true"
      />
      <aside className="sidebar profile-page-sidebar">
        <div className="sidebar-head">
          <button
            className="sidebar-collapse-toggle"
            type="button"
            aria-label="Sidebar pinned"
          >
            <ChevronRight size={14} />
          </button>
          <div className="brand-copy">
            <h2>Monitoring</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className="menu-link menu-link-monitoring active"
            type="button"
            onClick={onGoDashboard}
          >
            <span className="menu-icon-slot" aria-hidden="true">
              <img
                src={monitoringMenuIcon}
                alt=""
                className="menu-monitoring-image"
              />
            </span>
            <span className="menu-text">Monitoring</span>
          </button>
          <button className="menu-link" type="button" aria-disabled="true">
            <span className="menu-icon-slot" aria-hidden="true">
              <ExclamationHexagonIcon size={16} className="menu-custom-icon" />
            </span>
            <span className="menu-text">Incidents</span>
          </button>
          <button className="menu-link" type="button" aria-disabled="true">
            <span className="menu-icon-slot" aria-hidden="true">
              <span className="material-symbols-outlined menu-material-icon">
                sensors
              </span>
            </span>
            <span className="menu-text">Status pages</span>
          </button>
          <button className="menu-link" type="button" aria-disabled="true">
            <span className="menu-icon-slot" aria-hidden="true">
              <Wrench size={15} />
            </span>
            <span className="menu-text">Maintenance</span>
          </button>
          <button className="menu-link" type="button" aria-disabled="true">
            <span className="menu-icon-slot" aria-hidden="true">
              <Users size={15} />
            </span>
            <span className="menu-text">Team members</span>
          </button>
          <button className="menu-link" type="button" aria-disabled="true">
            <span className="menu-icon-slot" aria-hidden="true">
              <span className="material-symbols-outlined menu-material-icon">
                graph_1
              </span>
            </span>
            <span className="menu-text">Integrations & API</span>
          </button>
        </nav>

        <div className="sidebar-footer profile-page-footer">
          <div className="profile-avatar profile-page-avatar">
            {avatarUrl ? (
              <img src={`${avatarUrl}?t=${Date.now()}`} alt="" />
            ) : (
              initials
            )}
          </div>
          <div className="profile-copy">
            <strong>{displayName}</strong>
            <span>{displayEmail}</span>
          </div>
          <button
            className="logout-button"
            type="button"
            aria-label="Open profile page"
            onClick={onGoDashboard}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>

      <main className="profile-page-main">
        <header className="workspace-top profile-page-top">
          <div>
            <span className="profile-page-badge">USER SPACE</span>
            <h1>Account center</h1>
            <p>Accedez rapidement aux actions essentielles de votre espace.</p>
          </div>
        </header>

        <div className="profile-page-grid">
          <section className="profile-page-card profile-menu-card">
            <div className="profile-hero profile-hero-accent">
              <div className="profile-hero-copy">
                <div className="profile-hero-avatar profile-hero-avatar-large">
                  {avatarUrl ? (
                    <img src={`${avatarUrl}?t=${Date.now()}`} alt="" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="profile-hero-copy-block">
                  <span className="profile-hero-kicker">Welcome back</span>
                  <div className="profile-hero-name-row">
                    <h2>{displayName}</h2>
                    <span className="profile-role-pill">
                      {roleLabel(currentUser?.role)}
                    </span>
                  </div>
                  <p>{displayEmail}</p>
                </div>
              </div>

              <div className="profile-session-chip">
                <span
                  className={`profile-session-dot ${authToken ? "online" : "offline"}`}
                />
                <span>{sessionState}</span>
              </div>
            </div>

            <div className="profile-action-list">
              <button
                className="profile-action-item"
                type="button"
                onClick={onGoDashboard}
              >
                <span
                  className="profile-action-icon profile-action-icon-dashboard"
                  aria-hidden="true"
                >
                  <LayoutDashboard size={18} />
                </span>
                <span className="profile-action-copy-block">
                  <strong>Menu</strong>
                  <span>Retour au tableau de bord</span>
                </span>
                <ChevronRight size={18} />
              </button>

              <button
                className="profile-action-item"
                type="button"
                onClick={() => setIsProfilePopupOpen(true)}
              >
                <span
                  className="profile-action-icon profile-action-icon-profile"
                  aria-hidden="true"
                >
                  <UserCircle2 size={18} />
                </span>
                <span className="profile-action-copy-block">
                  <strong>Profile</strong>
                  <span>Modifier vos informations</span>
                </span>
                <ChevronRight size={18} />
              </button>

              <button
                className="profile-action-item"
                type="button"
                onClick={onOpenSettings}
              >
                <span
                  className="profile-action-icon profile-action-icon-settings"
                  aria-hidden="true"
                >
                  <Settings2 size={18} />
                </span>
                <span className="profile-action-copy-block">
                  <strong>Settings</strong>
                  <span>Preferences et securite</span>
                </span>
                <ChevronRight size={18} />
              </button>

              <button
                className="profile-action-item profile-action-danger"
                type="button"
                onClick={onLogout}
              >
                <span
                  className="profile-action-icon profile-action-icon-logout"
                  aria-hidden="true"
                >
                  <LogOut size={18} />
                </span>
                <span className="profile-action-copy-block">
                  <strong>Log out</strong>
                  <span>Se deconnecter de la session</span>
                </span>
                <ChevronRight size={18} />
              </button>
            </div>
          </section>

          <aside className="profile-page-card profile-overview-card">
            <h2>Quick Overview</h2>
            <p className="profile-overview-intro">
              Accedez rapidement aux reglages importants de votre compte.
            </p>

            <div className="profile-overview-list">
              <div className="profile-overview-item">
                <span className="profile-overview-label">SESSION</span>
                <strong>{authToken ? "Active" : "Inactive"}</strong>
              </div>
              <div className="profile-overview-item">
                <span className="profile-overview-label">ROLE</span>
                <strong>{roleLabel(currentUser?.role)}</strong>
              </div>
              <div className="profile-overview-item">
                <span className="profile-overview-label">E MAIL</span>
                <strong>{displayEmail}</strong>
              </div>
            </div>

            <div className="profile-tip">
              Conseil: completez votre profil et activez un mot de passe fort
              pour renforcer la securite.
            </div>
          </aside>
        </div>

        {isProfilePopupOpen && (
          <div
            className="modal-overlay profile-consult-modal"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsProfilePopupOpen(false);
              }
            }}
          >
            <div className="modal-container profile-consult-modal-container">
              <div className="modal-header profile-consult-modal-header">
                <h2>Profil</h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setIsProfilePopupOpen(false)}
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body profile-consult-modal-body">
                <div className="profile-consult-hero">
                  <div className="profile-consult-avatar">
                    {avatarUrl ? (
                      <img src={`${avatarUrl}?t=${Date.now()}`} alt="" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="profile-consult-copy">
                    <span className="profile-hero-kicker">
                      Profile overview
                    </span>
                    <h3>{displayName}</h3>
                    <p>{displayEmail}</p>
                    <span className="profile-role-pill">
                      {roleLabel(currentUser?.role)}
                    </span>
                  </div>
                </div>

                <div className="profile-consult-grid">
                  <div className="profile-consult-item">
                    <span>Nom</span>
                    <strong>{displayName}</strong>
                  </div>
                  <div className="profile-consult-item">
                    <span>Email</span>
                    <strong>{displayEmail}</strong>
                  </div>
                  <div className="profile-consult-item">
                    <span>Role</span>
                    <strong>{roleLabel(currentUser?.role)}</strong>
                  </div>
                  <div className="profile-consult-item">
                    <span>Session</span>
                    <strong>{sessionState}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfileOverviewPage;
