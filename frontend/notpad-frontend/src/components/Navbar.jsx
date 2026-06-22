import SearchNotes from './SearchNotes'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ search, setSearch, setIsOpen, setEditing, collapsed, setCollapsed }) {
  const { logout } = useAuth()
  function handleLogoClick() {
    if (typeof setSearch === 'function') {
      setSearch('')
    }

    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      } else if (window.scrollTo) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  function handleNewNote() {
    if (typeof setIsOpen === 'function') {
      setIsOpen(true)
    }
    if (typeof setEditing === 'function') {
      setEditing(null)
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-layout">
        <div className="topbar-left">
          <button
            type="button"
            className="keep-icon"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
            aria-pressed={collapsed}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className="logo"
            role="button"
            tabIndex={0}
            onClick={handleLogoClick}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogoClick() }}
          >
            <h2>Notpad</h2>
          </div>
        </div>

        <div className="topbar-center">
          <SearchNotes value={search} onChange={setSearch} />
        </div>

        <div className="topbar-actions">
          <button className="btn primary" type="button" onClick={handleNewNote}>
            New Note
          </button>
          <button className="btn logout" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
