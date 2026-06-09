import { useEffect, useState } from 'react'
import './App.css'
import NewNoteButton from './components/NewNoteButton'
import SearchNotes from './components/SearchNotes'
import NoteModal from './components/NoteModal'
import NoteDisplay from './components/NoteDisplay'

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
				<NewNoteButton setIsOpen={setIsOpen} setEditing={setEditing} />
			</header>

			<main className="container">
				<div className="toolbar">
					<div className="status">
						<strong>{notes.length}</strong> note{notes.length === 1 ? '' : 's'}
						{notes.length > 0 && <span> • {filteredNotes.length} shown</span>}
					</div>
					<SearchNotes value={search} onChange={setSearch} />
				</div>

				{notes.length === 0 ? (
					<div className="empty-state">
						<h3>No notes yet</h3>
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
							<NoteDisplay
								key={note.id}
								note={note}
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>
						))}
					</div>
				)}
			</main>

			{isOpen && (
				<NoteModal
					key={editing?.id ?? 'new'}
					initial={editing}
					onCancel={() => { setIsOpen(false); setEditing(null) }}
					onSave={handleSave}
				/>
			)}
		</div>
	)
}

