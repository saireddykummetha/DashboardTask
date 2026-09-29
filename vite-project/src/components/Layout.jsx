import { NavLink } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Layout({ children }) {
  const { user, logout } = useAuth()

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">₹</span>
          <div>
            <strong>NiftyWatch</strong>
            <span className="brand-sub">Portfolio & Alerts</span>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Market
          </NavLink>
          <NavLink to="/portfolio">Portfolio</NavLink>
          <NavLink to="/alerts">Alerts</NavLink>
        </nav>
        <div className="user-chip">
          <span>{user?.name}</span>
          <button type="button" className="btn ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  )
}
