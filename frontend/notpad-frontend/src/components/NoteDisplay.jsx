export default function NoteDisplay({ note, onEdit, onDelete, className = '' }) {
  if (!note) return null

  return (
    <div className={["note", className].filter(Boolean).join(' ')}>
      <div className="note-body">
        <strong className="note-title">{note.title || 'Untitled'}</strong>
        <p className="note-text">{note.body || 'No content yet.'}</p>
      </div>
      <div className="note-actions">
        {typeof onEdit === 'function' && (
          <button className="btn ghost" onClick={() => onEdit(note)}>
            Edit
          </button>
        )}
        {typeof onDelete === 'function' && (
          <button className="btn danger" onClick={() => onDelete(note.id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
