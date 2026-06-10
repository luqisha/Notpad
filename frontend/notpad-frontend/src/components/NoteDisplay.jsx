export default function NoteDisplay({ note, onEdit, onDelete, onSelect, className = '' }) {
  if (!note) return null

  return (
    <div
      className={["note", typeof onSelect === 'function' && 'note-clickable', className].filter(Boolean).join(' ')}
      onClick={typeof onSelect === 'function' ? onSelect : undefined}
      role={typeof onSelect === 'function' ? 'button' : undefined}
      tabIndex={typeof onSelect === 'function' ? 0 : undefined}
      onKeyDown={typeof onSelect === 'function' ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      } : undefined}
    >
      <div className="note-body">
        <strong className="note-title">{note.title || 'Untitled'}</strong>
        <p className="note-text">{note.body || 'No content yet.'}</p>
      </div>
      <div className="note-actions">
        <div className="note-actions-left">
          {typeof onEdit === 'function' && (
            <button className="btn ghost" onClick={(e) => { e.stopPropagation(); onEdit(note) }}>
              Edit
            </button>
          )}
        </div>
        <div className="note-actions-right">
          {typeof onDelete === 'function' && (
            <button className="btn danger" onClick={(e) => { e.stopPropagation(); onDelete(note) }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
