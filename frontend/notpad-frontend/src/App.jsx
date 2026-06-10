import { useEffect, useState, useRef } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import NoteModal from './components/NoteModal'
import NoteDisplay from './components/NoteDisplay'
import ConfirmModal from './components/ConfirmModal'
import Sidebar from './components/Sidebar'
import Auth from './components/Auth'
import GroupManager from './components/GroupManager'
import GroupCreator from './components/GroupCreator'
import { useAuth } from './context/AuthContext'
import { apiClient } from './services/api'

export default function App() {
	const { user, loading: authLoading } = useAuth()
	const [activeTab, setActiveTab] = useState('notes')
	const [collapsed, setCollapsed] = useState(false)
	const [selected, setSelected] = useState(null)
	const [groups, setGroups] = useState([])
	const [notes, setNotes] = useState([])
	const [search, setSearch] = useState('')
	const [isOpen, setIsOpen] = useState(false)
	const [editing, setEditing] = useState(null)
	const [deleteCandidate, setDeleteCandidate] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [showGroupCreator, setShowGroupCreator] = useState(false)
	const [editingGroup, setEditingGroup] = useState(null)

	const notesRef = useRef(null)
	const [columnsCount, setColumnsCount] = useState(0)

	// Fetch notes and groups from backend
	useEffect(() => {
		if (!user) return

		const fetchData = async () => {
			try {
				setLoading(true)
				setError(null)
				const [notesRes, groupsRes] = await Promise.all([
					apiClient.getNotes(),
					apiClient.getGroups(),
				])
				let notesList = notesRes.notes || []

				// Load images and voices for each note
				const notesWithMedia = await Promise.all(
					notesList.map(async (note) => {
						try {
							const [imagesRes, voicesRes] = await Promise.all([
								apiClient.getNoteImages(note.note_id),
								apiClient.getNoteVoices(note.note_id),
							])
							return {
								...note,
								images: imagesRes.images || [],
								voices: voicesRes.voices || [],
							}
						} catch (err) {
							console.error(`Failed to load media for note ${note.note_id}:`, err)
							return note
						}
					})
				)

				setNotes(notesWithMedia)
				setGroups(groupsRes.groups || [])
			} catch (err) {
				setError(err.message)
				console.error('Failed to fetch data:', err)
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [user])

	const normalizedSearch = search.trim().toLowerCase()
	const filteredNotes = notes.filter(note => {
		if (!normalizedSearch) return true
		return [note.note_title, note.note_body]
			.some(value => value?.toLowerCase().includes(normalizedSearch))
	})

	function handleSave(note) {
		if (note.id) {
			// Update existing note
			apiClient.updateNote(note.id, {
				note_title: note.title,
				note_body: note.body,
			})
				.then(res => {
					setNotes(n => n.map(x => (x.note_id === note.id ? res.note : x)))
					setIsOpen(false)
					setEditing(null)
				})
				.catch(err => setError(err.message))
		} else {
			// Create new note
			apiClient.createNote(note.title, note.body)
				.then(res => {
					setNotes(n => [res.note, ...n])
					setIsOpen(false)
					setEditing(null)
				})
				.catch(err => setError(err.message))
		}
	}

	function handleEdit(note) {
		setEditing({
			id: note.note_id,
			title: note.note_title,
			body: note.note_body,
			images: note.images || [],
			voices: note.voices || [],
		})
		setIsOpen(true)
	}

	function handleDelete(note) {
		setDeleteCandidate(note)
	}

	function confirmDelete() {
		if (!deleteCandidate) return
		apiClient.deleteNote(deleteCandidate.note_id)
			.then(() => {
				setNotes(n => n.filter(x => x.note_id !== deleteCandidate.note_id))
				setDeleteCandidate(null)
			})
			.catch(err => setError(err.message))
	}

	function cancelDelete() {
		setDeleteCandidate(null)
	}

	function handleTabChange(tab) {
		setActiveTab(tab)
		setSelected(null)
	}

	function handleGroupCreated(newGroup) {
		setGroups([...groups, newGroup])
		setShowGroupCreator(false)
	}

	function handleGroupUpdated() {
		// Refetch groups
		apiClient.getGroups()
			.then(res => setGroups(res.groups || []))
			.catch(err => setError(err.message))
		setEditingGroup(null)
	}

	function handleGroupDeleted() {
		// Refetch groups
		apiClient.getGroups()
			.then(res => setGroups(res.groups || []))
			.catch(err => setError(err.message))
		setSelected(null)
		setEditingGroup(null)
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

	if (authLoading) {
		return <div className="loading">Loading...</div>
	}

	if (!user) {
		return <Auth />
	}

	if (loading) {
		return <div className="loading">Loading your notes...</div>
	}

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

			{error && <div className="error-banner">{error}</div>}

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
								const note = notes.find(n => n.note_id === selected.id)
								if (!note) return <div className="empty-state"><h3>Note not found</h3></div>
								return (
									<div className="note-full">
										<h2>{note.note_title || 'Untitled'}</h2>
										<p>{note.note_body}</p>
										{(note.images?.length > 0 || note.voices?.length > 0) && (
											<div className="media-section">
												{note.images?.length > 0 && (
													<div className="media-list">
														<h4>Images ({note.images.length})</h4>
														<div className="images-grid">
															{note.images.map(img => (
																<img
																	key={img.id}
																	src={img.picture_url}
																	alt="Note"
																	className="media-thumbnail"
																	style={{cursor: 'pointer'}}
																	onClick={() => window.open(img.picture_url)}
																/>
															))}
														</div>
													</div>
												)}
												{note.voices?.length > 0 && (
													<div className="media-list">
														<h4>Voices ({note.voices.length})</h4>
														{note.voices.map(voice => (
															<audio
																key={voice.id}
																src={voice.voice_url}
																controls
																className="media-audio"
															/>
														))}
													</div>
												)}
											</div>
										)}
									</div>
								)
							})()
						) : (
							notes.length === 0 ? (
								<div className="empty-state">
									<h3>No notes yet</h3>
									<p>Start capturing your ideas with quick notes. Tap "New Note" when you're ready.</p>
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
													key={note.note_id}
													note={{
														id: note.note_id,
														title: note.note_title,
														body: note.note_body,
													}}
													onEdit={() => handleEdit(note)}
													onDelete={() => handleDelete(note)}
													onSelect={() => setSelected({ type: 'note', id: note.note_id })}
												/>
											))}
										</div>
									</>
							)
						)
					) : (
						selected && selected.type === 'group' ? (
							(() => {
								const group = groups.find(g => g.group_id === selected.id)
								if (!group) return <div className="empty-state"><h3>Group not found</h3></div>
								const groupNotes = notes.filter(n => group.note_ids?.includes(n.note_id))
								return (
									<div className="group-full">
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px' }}>
											<div>
												<h2>{group.name || group.group_name || 'Untitled Group'}</h2>
												<p>{group.description || group.group_description || 'No description'}</p>
											</div>
											<button
												className="btn secondary"
												onClick={() => setEditingGroup(group)}
												style={{ whiteSpace: 'nowrap' }}
											>
												✎ Edit
											</button>
										</div>
										{groupNotes.length === 0 ? (
											<div style={{ marginTop: '20px', padding: '20px', textAlign: 'center', color: 'var(--subtle)' }}>
												No notes in this group yet. Edit the group to add notes.
											</div>
										) : (
											<div style={{ marginTop: '20px' }}>
												<h4>Notes ({groupNotes.length})</h4>
												<div ref={notesRef} className={`notes ${collapsed ? 'collapsed' : 'expanded'}`}>
													{groupNotes.map(note => (
														<NoteDisplay
															key={note.note_id}
															note={{
																id: note.note_id,
																title: note.note_title,
																body: note.note_body,
															}}
															onEdit={() => handleEdit(note)}
															onDelete={() => handleDelete(note)}
															onSelect={() => setSelected({ type: 'note', id: note.note_id })}
														/>
													))}
												</div>
											</div>
										)}
									</div>
								)
							})()
						) : (
							groups.length === 0 ? (
								<div className="empty-state">
									<h3>No groups yet</h3>
									<p>Create a group to organize notes.</p>
									<button className="btn primary" onClick={() => setShowGroupCreator(true)} style={{ marginTop: '16px' }}>
										Create Group
									</button>
								</div>
							) : (
								<div style={{ maxWidth: '800px', margin: '0 auto' }}>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
										<h3>Your Groups</h3>
										<button className="btn primary" onClick={() => setShowGroupCreator(true)}>
											+ New Group
										</button>
									</div>
									<ul className="group-list">
										{groups.map(g => (
											<li
												key={g.group_id}
												className="group-item"
												onClick={() => setSelected({ type: 'group', id: g.group_id })}
											>
												<div>
													<div style={{ fontWeight: '600', fontSize: '1.05rem' }}>{g.name || g.group_name}</div>
													<div style={{ color: 'var(--subtle)', fontSize: '0.9rem', marginTop: '4px' }}>
														{g.note_ids?.length || 0} notes
													</div>
												</div>
											</li>
										))}
									</ul>
								</div>
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

			{showGroupCreator && (
				<GroupCreator
					onCancel={() => setShowGroupCreator(false)}
					onSuccess={handleGroupCreated}
				/>
			)}

			{editingGroup && (
				<GroupManager
					group={editingGroup}
					notes={notes}
					onClose={() => setEditingGroup(null)}
					onUpdate={handleGroupUpdated}
					onDelete={handleGroupDeleted}
				/>
			)}

			<ConfirmModal
				isOpen={Boolean(deleteCandidate)}
				message={
					deleteCandidate
						? `Delete "${deleteCandidate.note_title || 'Untitled'}"? This action cannot be undone.`
						: 'Delete this note?'
				}
				onConfirm={confirmDelete}
				onCancel={cancelDelete}
			/>
		</div>
	)
}
