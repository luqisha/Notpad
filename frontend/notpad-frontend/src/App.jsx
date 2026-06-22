import { useEffect, useState } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import NoteModal from './components/NoteModal'
import NoteDisplay from './components/NoteDisplay'
import ConfirmModal from './components/ConfirmModal'
import Sidebar from './components/Sidebar'
import Auth from './components/Auth'
import GroupManager from './components/GroupManager'
import GroupCreator from './components/GroupCreator'
import Pagination from './components/Pagination'
import NoteCreator from './components/NoteCreator'
import { useAuth } from './context/useAuth'
import { apiClient } from './services/api'

export default function App() {
	const { user } = useAuth()
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
	const [initialLoad, setInitialLoad] = useState(true)
	const [error, setError] = useState(null)
	const [showGroupCreator, setShowGroupCreator] = useState(false)
	const [editingGroup, setEditingGroup] = useState(null)
	const [currentPage, setCurrentPage] = useState(1)
	const [pagination, setPagination] = useState(null)
	const [reloadNotesKey, setReloadNotesKey] = useState(0)

	const ITEMS_PER_PAGE = collapsed ? 15 : 12

	// Fetch notes and groups from backend
	useEffect(() => {
		if (!user) return

		const fetchData = async () => {
			try {
				setLoading(true)
				setError(null)
				const effectivePage = search.trim() ? 1 : currentPage
				const skip = (effectivePage - 1) * ITEMS_PER_PAGE
				const [notesRes, groupsRes] = await Promise.all([
					apiClient.getNotes(skip, ITEMS_PER_PAGE, search),
					apiClient.getGroups(),
				])
				let notesList = notesRes.notes || []

				// Load images and voices for each note while preserving placeholder metadata
				const notesWithMedia = await Promise.all(
					notesList.map(async (note) => {
						try {
							const [imagesRes, voicesRes] = await Promise.all([
								apiClient.getNoteImages(note.note_id),
								apiClient.getNoteVoices(note.note_id),
							])
							return {
								...note,
								mediaImages: imagesRes.images || [],
								mediaVoices: voicesRes.voices || [],
							}
						} catch (err) {
							console.error(`Failed to load media for note ${note.note_id}:`, err)
							return note
						}
					})
				)

				setNotes(notesWithMedia)
				setGroups(groupsRes.groups || [])
				setPagination(notesRes.pagination)
			} catch (err) {
				setError(err.message)
				console.error('Failed to fetch data:', err)
			} finally {
				setLoading(false)
				setInitialLoad(false)
			}
		}

		fetchData()
	}, [user, currentPage, search, reloadNotesKey, collapsed, ITEMS_PER_PAGE])

	useEffect(() => {
		setCurrentPage(1)
	}, [search])

	const selectedGroup = selected?.type === 'group' ? groups.find(g => g.group_id === selected.id) : null
	const filteredNotes = selectedGroup
		? notes.filter(n => selectedGroup.note_ids?.includes(n.note_id))
		: notes

	const pinnedNotes = filteredNotes.filter(n => n.is_pinned)
	const otherNotes = filteredNotes.filter(n => !n.is_pinned)

	const modalVisible = isOpen || showGroupCreator || Boolean(editingGroup) || Boolean(deleteCandidate)
	const showPagination = pagination && !search && !selectedGroup && pagination.total_pages > 1 && !modalVisible
	const paginationInline = showPagination && notes.length === ITEMS_PER_PAGE

	function handleSave(savedNote) {
		setReloadNotesKey(key => key + 1)
		setIsOpen(false)
		setEditing(null)
		setSelected(null)
	}

	async function handlePinToggle(note) {
		const newPinnedState = !note.is_pinned
		// Optimistically update local state
		setNotes(prevNotes => prevNotes.map(n => n.note_id === note.note_id ? { ...n, is_pinned: newPinnedState } : n))
		
		try {
			await apiClient.updateNote(note.note_id, { is_pinned: newPinnedState })
		} catch (err) {
			setError(err.message || 'Failed to update pin state')
			// Revert on failure
			setNotes(prevNotes => prevNotes.map(n => n.note_id === note.note_id ? { ...n, is_pinned: !newPinnedState } : n))
		}
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
				setReloadNotesKey(key => key + 1)
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
		apiClient.getGroups()
			.then(res => setGroups(res.groups || []))
			.catch(err => setError(err.message))
		setEditingGroup(null)
		setReloadNotesKey(key => key + 1)
	}

	function handleGroupDeleted() {
		apiClient.getGroups()
			.then(res => setGroups(res.groups || []))
			.catch(err => setError(err.message))
		setSelected(null)
		setEditingGroup(null)
		setReloadNotesKey(key => key + 1)
	}

	if (!user) {
		return <Auth />
	}

	if (loading && initialLoad) {
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
					groups={groups}
					selected={selected}
					onGroupSelect={(groupId) => {
						if (groupId) {
							setSelected({ type: 'group', id: groupId })
						} else {
							setSelected(null)
						}
					}}
				/>

				<main className="main">
					{activeTab === 'notes' ? (
						<>
							{selectedGroup && (
								<div className="label-header">
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
										<div>
											<h2>{selectedGroup.name}</h2>
											{selectedGroup.description && <p>{selectedGroup.description}</p>}
										</div>
										<button
											className="icon-btn"
											onClick={() => setEditingGroup(selectedGroup)}
											title="Edit Group Details"
											type="button"
										>
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
												<path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
											</svg>
										</button>
									</div>
								</div>
							)}

							{!selectedGroup && (
								<NoteCreator onSave={() => setReloadNotesKey(k => k + 1)} />
							)}

							{filteredNotes.length === 0 ? (
								<div className="empty-state">
									<svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
										<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
										<line x1="9" y1="18" x2="15" y2="18" />
										<line x1="10" y1="22" x2="14" y2="22" />
									</svg>
									<h3>No notes here</h3>
									<p>{selectedGroup ? "Add notes to this group to see them here." : "Start capturing your thoughts by taking a note!"}</p>
								</div>
							) : (
								<>
									{pinnedNotes.length > 0 ? (
										<>
											<div className="notes-section-title">Pinned</div>
											<div className="notes">
												{pinnedNotes.map(note => (
													<NoteDisplay
														key={note.note_id}
														note={note}
														onDelete={() => handleDelete(note)}
														onPin={() => handlePinToggle(note)}
														onSelect={() => {
															setEditing({
																id: note.note_id,
																note_id: note.note_id,
																title: note.note_title,
																note_title: note.note_title,
																body: note.note_body,
																note_body: note.note_body,
																mediaImages: note.mediaImages,
																mediaVoices: note.mediaVoices
															})
															setIsOpen(true)
														}}
													/>
												))}
											</div>
											{otherNotes.length > 0 && (
												<>
													<div className="notes-section-title">Others</div>
													<div className="notes">
														{otherNotes.map(note => (
															<NoteDisplay
																key={note.note_id}
																note={note}
																onDelete={() => handleDelete(note)}
																onPin={() => handlePinToggle(note)}
																onSelect={() => {
																	setEditing({
																		id: note.note_id,
																		note_id: note.note_id,
																		title: note.note_title,
																		note_title: note.note_title,
																		body: note.note_body,
																		note_body: note.note_body,
																		mediaImages: note.mediaImages,
																		mediaVoices: note.mediaVoices
																	})
																	setIsOpen(true)
																}}
															/>
														))}
													</div>
												</>
											)}
										</>
									) : (
										<div className="notes">
											{filteredNotes.map(note => (
												<NoteDisplay
													key={note.note_id}
													note={note}
													onDelete={() => handleDelete(note)}
													onPin={() => handlePinToggle(note)}
													onSelect={() => {
														setEditing({
															id: note.note_id,
															note_id: note.note_id,
															title: note.note_title,
															note_title: note.note_title,
															body: note.note_body,
															note_body: note.note_body,
															mediaImages: note.mediaImages,
															mediaVoices: note.mediaVoices
														})
														setIsOpen(true)
													}}
												/>
											))}
										</div>
									)}
									{showPagination && (
										<Pagination
											pagination={pagination}
											onPageChange={setCurrentPage}
											inline={paginationInline}
										/>
									)}
								</>
							)}
						</>
					) : (
						<div style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
								<h3 style={{ fontSize: '20px', fontWeight: '500', margin: 0 }}>Your Groups</h3>
								<button className="btn primary" onClick={() => setShowGroupCreator(true)}>
									+ New Group
								</button>
							</div>
							{groups.length === 0 ? (
								<div className="empty-state" style={{ marginTop: '40px' }}>
									<h3>No groups yet</h3>
									<p>Create a group to organize notes.</p>
								</div>
							) : (
								<ul className="group-list">
									{groups.map(g => (
										<li
											key={g.group_id}
											className="group-item"
											onClick={() => setSelected({ type: 'group', id: g.group_id })}
											style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
										>
											<div>
												<div style={{ fontWeight: '600', fontSize: '1.05rem', color: 'var(--text)' }}>{g.name}</div>
												<div style={{ color: 'var(--subtle)', fontSize: '0.9rem', marginTop: '4px' }}>
													{g.note_ids?.length || 0} notes
												</div>
											</div>
											<button
												className="card-icon-btn"
												type="button"
												onClick={(e) => {
													e.stopPropagation()
													setEditingGroup(g)
												}}
											>
												<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
													<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
													<path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
												</svg>
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
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
