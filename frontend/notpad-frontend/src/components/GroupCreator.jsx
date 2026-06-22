import { useState } from 'react'
import { apiClient } from '../services/api'

export default function GroupCreator({ onCancel, onSuccess }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    if (trimmedName.length < 3) {
      setError('Group name must be at least 3 characters')
      return
    }

    setLoading(true)
    try {
      const result = await apiClient.createGroup(trimmedName, description.trim())
      onSuccess?.(result.group)
    } catch (err) {
      setError(err.message || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal">
      <form className="modal-content" onSubmit={handleCreate}>
        <div className="modal-header">
          <h3>Create New Group</h3>
        </div>
        {error && <div className="modal-error">{error}</div>}

        <label className="field">
          Group Name
          <input
            autoFocus
            placeholder="e.g., Project Ideas, Learning Resources..."
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={3}
          />
          <span className="char-count">{name.length}/100</span>
        </label>

        <label className="field">
          Description (Optional)
          <textarea
            placeholder="Describe what this group is for..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ minHeight: '100px' }}
          />
          <span className="char-count">{description.length}/1000</span>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  )
}
