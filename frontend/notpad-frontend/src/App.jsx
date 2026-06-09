import { useEffect, useState } from 'react'
import './App.css'

function NoteForm({ initial, onCancel, onSave }) {
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

export default function App() {
	const [notes, setNotes] = useState(() => {
		try {
			const raw = localStorage.getItem('notes')
			return raw ? JSON.parse(raw) : []
		} catch {
			return []
		}
	})
	const [search, setSearch] = useState('')
	const [isOpen, setIsOpen] = useState(false)
	const [editing, setEditing] = useState(null)

	useEffect(() => {
		localStorage.setItem('notes', JSON.stringify(notes))
	}, [notes])

	const normalizedSearch = search.trim().toLowerCase()
	const filteredNotes = notes.filter(note => {
		if (!normalizedSearch) return true
		return [note.title, note.body]
			.some(value => value?.toLowerCase().includes(normalizedSearch))
	})

	function handleSave(note) {
		if (note.id) {
			setNotes(n => n.map(x => (x.id === note.id ? { ...x, title: note.title, body: note.body } : x)))
		} else {
			const id = Date.now().toString()
			setNotes(n => [{ id, title: note.title, body: note.body }, ...n])
		}
		setIsOpen(false)
		setEditing(null)
	}

	function handleEdit(note) {
		setEditing(note)
		setIsOpen(true)
	}

	function handleDelete(id) {
		if (!confirm('Delete this note?')) return
		setNotes(n => n.filter(x => x.id !== id))
	}

	return (
		<div className="app">
			<header className="topbar">
				<div>
					<h2>Notpad</h2>
					<p className="subtitle">Fast, clean notes for everyday ideas.</p>
				</div>
				<button className="btn primary" onClick={() => { setIsOpen(true); setEditing(null) }}>New Note</button>
			</header>

			<main className="container">
				<div className="toolbar">
					<div className="status">
						<strong>{notes.length}</strong> note{notes.length === 1 ? '' : 's'}
						{notes.length > 0 && <span> • {filteredNotes.length} shown</span>}
					</div>
					<input
						className="search"
						placeholder="Search notes..."
						value={search}
						onChange={e => setSearch(e.target.value)}
					/>
				</div>

				{notes.length === 0 ? (
					<div className="empty-state">
						<h3>Welcome to Notpad</h3>
						<p>Start capturing your ideas with quick notes. Tap “New Note” when you’re ready.</p>
					</div>
				) : filteredNotes.length === 0 ? (
					<div className="empty-state">
						<h3>No notes found</h3>
						<p>Try a different search term or create a new note.</p>
					</div>
				) : (
					<div className="notes">
						{filteredNotes.map(note => (
							<div className="note" key={note.id}>
								<div className="note-body">
									<strong className="note-title">{note.title || 'Untitled'}</strong>
									<p className="note-text">{note.body || 'No content yet.'}</p>
								</div>
								<div className="note-actions">
									<button className="btn ghost" onClick={() => handleEdit(note)}>Edit</button>
									<button className="btn danger" onClick={() => handleDelete(note.id)}>Delete</button>
								</div>
							</div>
						))}
					</div>
				)}
			</main>

			{isOpen && (
				<NoteForm
					key={editing?.id ?? 'new'}
					initial={editing}
					onCancel={() => { setIsOpen(false); setEditing(null) }}
					onSave={handleSave}
				/>
			)}
		</div>
	)
}

