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
        {activeTab === 'notes' ? (
          notes.length === 0 ? (
            <p className="sidebar-empty">No notes</p>
          ) : (
            <ul className="sidebar-list">
              {notes.map(note => (
                <li
                  key={note.note_id}
                  className={`sidebar-item ${selected?.type === 'note' && selected?.id === note.note_id ? 'active' : ''}`}
                  onClick={() => onSelectNote(note.note_id)}
                >
                  <div className="sidebar-item-content">
                    <div className="sidebar-item-title">{note.note_title || 'Untitled'}</div>
                    <div className="sidebar-item-preview">{note.note_body.substring(0, 30)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          groups.length === 0 ? (
            <p className="sidebar-empty">No groups</p>
          ) : (
            <ul className="sidebar-list">
              {groups.map(group => (
                <li
                  key={group.group_id}
                  className={`sidebar-item ${selected?.type === 'group' && selected?.id === group.group_id ? 'active' : ''}`}
                  onClick={() => onSelectGroup(group.group_id)}
                >
                  <div className="sidebar-item-content">
                    <div className="sidebar-item-title">{group.name || group.group_name || 'Untitled Group'}</div>
                    <div className="sidebar-item-count">{group.note_ids?.length || 0} notes</div>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </aside>
  )
}
