import SearchNotes from './SearchNotes'
import { useAuth } from '../context/useAuth'

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
            className="icon-btn"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
            aria-pressed={collapsed}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <div
            className="logo"
            role="button"
            tabIndex={0}
            onClick={handleLogoClick}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogoClick() }}
            aria-label="Notpad home"
          >
            {/* Signature Google Keep Lightbulb Logo */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fbbc04" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ fill: '#feefc3', marginRight: '4px' }}>
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
              <line x1="9" y1="18" x2="15" y2="18" />
              <line x1="10" y1="22" x2="14" y2="22" />
            </svg>
            <h2>Notpad</h2>
          </div>
        </div>

        <div className="topbar-center">
          <SearchNotes value={search} onChange={setSearch} />
        </div>

        <div className="topbar-actions">
          <button className="btn primary" type="button" onClick={handleNewNote} style={{ gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create
          </button>
          <button className="btn ghost" type="button" onClick={logout} style={{ gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
