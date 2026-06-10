import { useEffect, useState, useRef } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import NoteModal from './components/NoteModal'
import NoteDisplay from './components/NoteDisplay'
import ConfirmModal from './components/ConfirmModal'
import Sidebar from './components/Sidebar'

export default function App() {
	const [activeTab, setActiveTab] = useState('notes')
	const [collapsed, setCollapsed] = useState(false)
	const [selected, setSelected] = useState(null) // {type: 'note'|'group', id}
	const [groups] = useState(() => {
		try {
			const raw = localStorage.getItem('groups')
			return raw ? JSON.parse(raw) : []
		} catch {
			return []
		}
	})

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
	const [deleteCandidate, setDeleteCandidate] = useState(null)

	const notesRef = useRef(null)
	const [columnsCount, setColumnsCount] = useState(0)

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

	function handleDelete(note) {
		setDeleteCandidate(note)
	}

	function confirmDelete() {
		if (!deleteCandidate) return
		setNotes(n => n.filter(x => x.id !== deleteCandidate.id))
		setDeleteCandidate(null)
	}

	function cancelDelete() {
		setDeleteCandidate(null)
	}

	function handleTabChange(tab) {
		setActiveTab(tab)
		setSelected(null)
	}

useEffect(() => {
	function updateColumns() {
		const el = notesRef.current
		if (!el) return
		const gap = 16
		const containerWidth = el.clientWidth
		const minWidth = 240
		const cols = Math.max(1, Math.floor((containerWidth + gap) / (minWidth + gap)))
		setColumnsCount(cols)
	}

	updateColumns()
	window.addEventListener('resize', updateColumns)
	return () => window.removeEventListener('resize', updateColumns)
}, [collapsed, notesRef, notes.length])

	return (
		<div className="app">
			<Navbar
				search={search}
				setSearch={setSearch}
				setIsOpen={setIsOpen}
				setEditing={setEditing}
				collapsed={collapsed}
				setCollapsed={setCollapsed}
			/>

			<div className="content">
				<Sidebar
					activeTab={activeTab}
					setActiveTab={handleTabChange}
					collapsed={collapsed}
					notes={notes}
					groups={groups}
					selected={selected}
					onSelectNote={(id) => setSelected({ type: 'note', id })}
					onSelectGroup={(id) => setSelected({ type: 'group', id })}
				/>

				<main className="main">

					{activeTab === 'notes' ? (
						selected && selected.type === 'note' ? (
							(() => {
								const note = notes.find(n => n.id === selected.id)
								if (!note) return <div className="empty-state"><h3>Note not found</h3></div>
								return (
									<div className="note-full">
										<h2>{note.title || 'Untitled'}</h2>
										<p>{note.body}</p>
									</div>
								)
							})()
						) : (
							notes.length === 0 ? (
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
										<>
												<div ref={notesRef} className={`notes ${collapsed ? 'collapsed' : 'expanded'}`}>
												{filteredNotes.map(note => (
													<NoteDisplay
														key={note.id}
														note={note}
														onEdit={handleEdit}
														onDelete={handleDelete}
														onSelect={() => setSelected({ type: 'note', id: note.id })}
													/>
												))}
											</div>
										</>
							)
						)
					) : (
						selected && selected.type === 'group' ? (
							(() => {
								const group = groups.find(g => g.id === selected.id)
								if (!group) return <div className="empty-state"><h3>Group not found</h3></div>
								return (
									<div className="group-full">
										<h2>{group.name}</h2>
										<p>{group.description || 'No description'}</p>
									</div>
								)
							})()
						) : (
							groups.length === 0 ? (
								<div className="empty-state">
									<h3>No groups yet</h3>
									<p>Create a group to organize notes.</p>
								</div>
							) : (
								<ul className="group-list">
									{groups.map(g => (
										<li
											key={g.id}
											className="group-item"
											onClick={() => setSelected({ type: 'group', id: g.id })}
										>
											{g.name}
										</li>
									))}
								</ul>
							)
						)
					)}
			</main>
			</div>

			{isOpen && (
				<NoteModal
					key={editing?.id ?? 'new'}
					initial={editing}
					onCancel={() => { setIsOpen(false); setEditing(null) }}
					onSave={handleSave}
				/>
			)}

		<ConfirmModal
			isOpen={Boolean(deleteCandidate)}
			message={
				deleteCandidate
					? `Delete "${deleteCandidate.title || 'Untitled'}"? This action cannot be undone.`
					: 'Delete this note?'
			}
			onConfirm={confirmDelete}
			onCancel={cancelDelete}
		/>
		</div>
	)
}

