import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Button from "../common/Button";

const Sidebar = () => {
  const { profileType, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navLinkStyle = ({ isActive }) => ({
    textDecoration: "none",
    color: isActive ? "var(--accent-dark)" : "var(--muted)",
    padding: "var(--space-sm) var(--space-md)",
    borderRadius: "var(--radius-sm)",
    background: isActive ? "var(--accent-soft)" : "transparent",
    fontWeight: isActive ? 600 : 400,
  });

  return (
    <aside className="app-sidebar">
      <div className="brand">StartupLink</div>
      <nav className="nav-menu">
        {profileType === "founder" ? (
          <>
            <NavLink to="/app" style={navLinkStyle} end>
              Overview
            </NavLink>
            <NavLink to="/app/ideas" style={navLinkStyle}>
              My Ideas
            </NavLink>
            <NavLink to="/app/talent" style={navLinkStyle}>
              Discover Talent
            </NavLink>
            <NavLink to="/app/founder-team" style={navLinkStyle}>
              Team
            </NavLink>
            <NavLink to="/app/invitations" style={navLinkStyle}>
              Invitations
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/app" style={navLinkStyle} end>
              Overview
            </NavLink>
            <NavLink to="/app/explore" style={navLinkStyle}>
              Explore Startups
            </NavLink>
            <NavLink to="/app/matches" style={navLinkStyle}>
              Matches
            </NavLink>
            <NavLink to="/app/team" style={navLinkStyle}>
              My Team
            </NavLink>
            <NavLink to="/app/invitations" style={navLinkStyle}>
              Invitations
            </NavLink>
          </>
        )}
      </nav>
      <div className="sidebar-footer">
        <Button variant="secondary" onClick={handleLogout}>
          Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
