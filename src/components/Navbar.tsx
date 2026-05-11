import { Link, useLocation } from "react-router-dom";

function Navbar() {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <h2 className="logo">
          Certificate Mailer
        </h2>

        <div className="nav-links">
          <Link
            to="/"
            className={
              location.pathname === "/"
                ? "active-link"
                : "nav-link"
            }
          >
            Dashboard
          </Link>

          <Link
            to="/logs"
            className={
              location.pathname ===
              "/logs"
                ? "active-link"
                : "nav-link"
            }
          >
            Logs
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;