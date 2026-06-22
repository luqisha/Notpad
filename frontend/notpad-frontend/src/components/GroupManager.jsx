import { useState } from 'react'
import { apiClient } from '../services/api'

export default function GroupManager({ group, notes, onClose, onUpdate, onDelete }) {
  const [name, setName] = useState(group?.name || '')
  const [description, setDescription] = useState(group?.description || '')
  const [error, setError] = useState('')
  const [selectedNotes, setSelectedNotes] = useState(group?.note_ids || [])
  const [saving, setSaving] = useState(false)

  function handleToggleNote(noteId) {
    setSelectedNotes(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const originalIds = group?.note_ids || []
      const toAdd = selectedNotes.filter(id => !originalIds.includes(id))
      const toRemove = originalIds.filter(id => !selectedNotes.includes(id))

      await Promise.all([
        apiClient.updateGroup(group.group_id, { name, description }),
        ...toAdd.map(id => apiClient.addNoteToGroup(group.group_id, id)),
        ...toRemove.map(id => apiClient.removeNoteFromGroup(group.group_id, id)),
      ])

      onUpdate?.()
      onClose?.()
    } catch (err) {
      setError('Failed to save group: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this group?')) return
    setSaving(true)
    try {
      await apiClient.deleteGroup(group.group_id)
      onDelete?.()
      onClose?.()
    } catch (err) {
      setError('Failed to delete group: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const unselectedNotes = notes.filter(n => !selectedNotes.includes(n.note_id))

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Manage Group</h3>
        </div>
        {error && <div className="modal-error">{error}</div>}

        <label className="field">
          Group Name
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name"
          />
        </label>

        <label className="field">
          Description
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add a description..."
            style={{ minHeight: '80px' }}
          />
        </label>

        <div className="group-notes-section">
          <h4>Notes in Group ({selectedNotes.length})</h4>
          {selectedNotes.length === 0 ? (
            <p style={{ color: 'var(--subtle)' }}>No notes in this group</p>
          ) : (
            <div className="group-notes-list">
              {selectedNotes.map(noteId => {
                const note = notes.find(n => n.note_id === noteId)
                return note ? (
                  <div key={noteId} className="group-note-item">
                    <div className="group-note-info">
                      <div className="group-note-title">{note.note_title}</div>
                      <div className="group-note-preview">{note.note_body.substring(0, 40)}</div>
                    </div>
                    <button
                      className="btn danger"
                      onClick={() => handleToggleNote(noteId)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </div>
                ) : null
              })}
            </div>
          )}

          {unselectedNotes.length > 0 && (
            <>
              <h4 style={{ marginTop: '20px' }}>Add Notes</h4>
              <div className="group-notes-list">
                {unselectedNotes.map(note => (
                  <div key={note.note_id} className="group-note-item">
                    <div className="group-note-info">
                      <div className="group-note-title">{note.note_title}</div>
                      <div className="group-note-preview">{note.note_body.substring(0, 40)}</div>
                    </div>
                    <button
                      className="btn secondary"
                      onClick={() => handleToggleNote(note.note_id)}
                      disabled={saving}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn danger" onClick={handleDelete} disabled={saving}>
            Delete Group
          </button>
          <div style={{ flex: 1 }}></div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
