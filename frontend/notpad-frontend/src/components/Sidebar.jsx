export default function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  notes = [],
  groups = [],
  selected,
  onSelectNote,
  onSelectGroup,
}) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
            aria-pressed={activeTab === 'notes'}
          >
            <span className="tab-label">Notes</span>
            <span className="tab-abbrev">N</span>
          </button>
          <button
            className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
            aria-pressed={activeTab === 'groups'}
          >
            <span className="tab-label">Groups</span>
            <span className="tab-abbrev">G</span>
          </button>
        </div>
      </div>
      <div className="sidebar-body">
      </div>
    </aside>
  )
}
