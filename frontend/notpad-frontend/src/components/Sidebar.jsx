export default function Sidebar({ activeTab, setActiveTab, collapsed, groups = [], onGroupSelect, selected }) {
  const isNotesActive = activeTab === 'notes' && !selected
  const isGroupsListActive = activeTab === 'groups' && !selected

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="tabs">
          {/* Notes Tab */}
          <button
            className={`tab ${isNotesActive ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('notes')
              if (typeof onGroupSelect === 'function') onGroupSelect(null)
            }}
            aria-pressed={isNotesActive}
            title="Notes"
          >
            <span className="tab-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                <line x1="9" y1="18" x2="15" y2="18" />
                <line x1="10" y1="22" x2="14" y2="22" />
              </svg>
            </span>
            <span className="tab-label">Notes</span>
          </button>

          <div className="sidebar-divider" />

          {/* Dynamic Groups/Labels List */}
          {groups.length > 0 && (
            <>
              {!collapsed && <div className="sidebar-section-title">Groups</div>}
              {groups.map((group) => {
                const isGroupActive = selected?.type === 'group' && selected.id === group.group_id
                return (
                  <button
                    key={group.group_id}
                    className={`tab ${isGroupActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('notes') // Set tab to notes, but filter by group
                      if (typeof onGroupSelect === 'function') {
                        onGroupSelect(group.group_id)
                      }
                    }}
                    aria-pressed={isGroupActive}
                    title={group.name}
                  >
                    <span className="tab-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        <circle cx="7" cy="7" r="1" fill="currentColor"></circle>
                      </svg>
                    </span>
                    <span className="tab-label">{group.name}</span>
                  </button>
                )
              })}
              <div className="sidebar-divider" />
            </>
          )}

          {/* Edit Groups Tab */}
          <button
            className={`tab ${isGroupsListActive ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('groups')
              if (typeof onGroupSelect === 'function') onGroupSelect(null)
            }}
            aria-pressed={isGroupsListActive}
            title="Edit Groups"
          >
            <span className="tab-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </span>
            <span className="tab-label">Edit Groups</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
