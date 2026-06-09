import { useState } from 'react'

export default function NoteModal({ initial, onCancel, onSave }) {
	const [title, setTitle] = useState(initial?.title || '')
	const [body, setBody] = useState(initial?.body || '')

	function submit(e) {
		e.preventDefault()
		if (!title.trim() && !body.trim()) return
		onSave({ ...initial, title: title.trim(), body: body.trim(), id: initial?.id })
	}

	return (
		<div className="modal">
			<form className="modal-content" onSubmit={submit}>
				<div className="modal-header">
					<h3>{initial ? 'Edit Note' : 'New Note'}</h3>
				</div>
				<label className="field">
					Title
					<input
						placeholder="Give it a short title"
						value={title}
						onChange={e => setTitle(e.target.value)}
					/>
				</label>
				<label className="field">
					Body
					<textarea
						placeholder="Write your note here..."
						value={body}
						onChange={e => setBody(e.target.value)}
					/>
				</label>
				<div className="modal-actions">
					<button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
					<button type="submit" className="btn primary">Save</button>
				</div>
			</form>
		</div>
	)
}
