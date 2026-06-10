import { useState } from 'react'

export default function NoteModal({ initial, onCancel, onSave }) {
	const [title, setTitle] = useState(initial?.title || '')
	const [body, setBody] = useState(initial?.body || '')
	const [error, setError] = useState('')

	function submit(e) {
		e.preventDefault()
		setError('')

		const trimmedTitle = title.trim()
		const trimmedBody = body.trim()

		if (!trimmedTitle || !trimmedBody) {
			setError('Title and body are required')
			return
		}

		if (trimmedTitle.length < 10) {
			setError('Title must be at least 10 characters')
			return
		}

		if (trimmedBody.length > 1000) {
			setError('Body must be less than 1000 characters')
			return
		}

		onSave({ ...initial, title: trimmedTitle, body: trimmedBody, id: initial?.id })
	}

	return (
		<div className="modal">
			<form className="modal-content" onSubmit={submit}>
				<div className="modal-header">
					<h3>{initial ? 'Edit Note' : 'New Note'}</h3>
				</div>
				{error && <div className="modal-error">{error}</div>}
				<label className="field">
					Title
					<input
						placeholder="Give it a short title (min 10 chars)"
						value={title}
						onChange={e => setTitle(e.target.value)}
					/>
					<span className="char-count">{title.length}/100</span>
				</label>
				<label className="field">
					Body
					<textarea
						placeholder="Write your note here..."
						value={body}
						onChange={e => setBody(e.target.value)}
					/>
					<span className="char-count">{body.length}/1000</span>
				</label>
				<div className="modal-actions">
					<button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
					<button type="submit" className="btn primary">Save</button>
				</div>
			</form>
		</div>
	)
}
