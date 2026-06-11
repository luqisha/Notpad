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
import Pagination from './components/Pagination'
import { useAuth } from './context/AuthContext'
import { apiClient } from './services/api'

const PLACEHOLDER_REGEX = /\[(IMG|AUD):(\d+)(\|[^\]]+)?\]/g

function escapeHtml(text = '') {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function parsePlaceholderMeta(placeholder) {
  const match = placeholder.match(/\[(IMG|AUD):(\d+)(\|[^\]]+)?\]/)
  if (!match) return null
  const type = match[1]
  const index = Number(match[2])
  const meta = {}
  if (match[3]) {
    match[3].slice(1).split('|').forEach(pair => {
      const [key, value] = pair.split('=')
      if (key && value) meta[key] = value
    })
  }
  return { type, index, meta }
}

function serializePlaceholder(type, index, meta = {}) {
  const parts = []
  if (meta.width) parts.push(`w=${meta.width}`)
  return parts.length > 0 ? `[${type}:${index}|${parts.join('|')}]` : `[${type}:${index}]`
}

function findImageUrlByIndex(note, index) {
  if (!note) return null
  const ref = Array.isArray(note.images) ? note.images.find(item => item.index === index) : null
  if (!ref) return null
  const actual = Array.isArray(note.mediaImages)
    ? note.mediaImages.find(img => img.picture_id === ref.id || img.id === ref.id)
    : null
  return actual?.picture_url || actual?.image_url || actual?.url || null
}

function findVoiceUrlByIndex(note, index) {
  if (!note) return null
  const ref = Array.isArray(note.voices) ? note.voices.find(item => item.index === index) : null
  if (!ref) return null
  const actual = Array.isArray(note.mediaVoices)
    ? note.mediaVoices.find(voice => voice.voice_id === ref.id || voice.id === ref.id)
    : null
  return actual?.voice_url || actual?.url || null
}

function bodyToHtml(body = '', note = {}) {
  const escaped = escapeHtml(body)
  return escaped.replace(PLACEHOLDER_REGEX, (match, type, index, metaPart) => {
    const placeholder = match.slice(1, -1)
    const meta = parsePlaceholderMeta(match)?.meta || {}
    if (type === 'IMG') {
      const src = findImageUrlByIndex(note, Number(index))
      if (!src) return `<span class="note-placeholder">${escapeHtml(match)}</span>`
      const widthStyle = meta.width ? `width:${meta.width}px;` : 'max-width:100%;'
      const dataPlaceholder = serializePlaceholder(type, Number(index), meta)
      return `<img class="note-body-image editor-image" contenteditable="false" data-placeholder="${dataPlaceholder}" src="${src}" style="${widthStyle} display:block; margin:12px 0;" />`
    }
    if (type === 'AUD') {
      const src = findVoiceUrlByIndex(note, Number(index))
      if (!src) return `<span class="note-placeholder">${escapeHtml(match)}</span>`
      const dataPlaceholder = serializePlaceholder(type, Number(index), meta)
      return `<audio controls class="note-body-audio" contenteditable="false" data-placeholder="${dataPlaceholder}" src="${src}"></audio>`
    }
    return `<span class="note-placeholder">${escapeHtml(match)}</span>`
  }).replace(/\n/g, '<br>')
}

function htmlToBody(html = '') {
  const parser = new DOMParser()
  const document = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  function nodeToText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }
    if (node.nodeName === 'BR') {
      return '\n'
    }
    if (node.nodeName === 'IMG' || node.nodeName === 'AUDIO') {
      return node.dataset.placeholder ? `[${node.dataset.placeholder}]` : ''
    }
    const children = Array.from(node.childNodes).map(nodeToText).join('')
    if (['DIV', 'P', 'LI', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.nodeName)) {
      return `${children}\n`
    }
    return children
  }
  const text = nodeToText(document.body)
  return text.replace(/\n{2,}/g, '\n').trim()
}

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
	const [initialLoad, setInitialLoad] = useState(true)
	const [error, setError] = useState(null)
	const [detailUploadError, setDetailUploadError] = useState('')
	const [detailUploading, setDetailUploading] = useState(false)
	const [showGroupCreator, setShowGroupCreator] = useState(false)
	const [editingGroup, setEditingGroup] = useState(null)
	const [viewDraft, setViewDraft] = useState(null)
	const [viewDraftHtml, setViewDraftHtml] = useState('')
	const [selectedMediaPlaceholder, setSelectedMediaPlaceholder] = useState(null)
	const [selectedMediaWidth, setSelectedMediaWidth] = useState(null)
	const [currentPage, setCurrentPage] = useState(1)
	const [pagination, setPagination] = useState(null)
	const [reloadNotesKey, setReloadNotesKey] = useState(0)
	const ITEMS_PER_PAGE = collapsed ? 15 : 12

	const notesRef = useRef(null)
	const editorRef = useRef(null)

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
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setCurrentPage(1)
	}, [search])

	useEffect(() => {
		if (selected?.type !== 'note') {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setViewDraft(null)
			setViewDraftHtml('')
			setSelectedMediaPlaceholder(null)
			setSelectedMediaWidth(null)
			return
		}

		const note = notes.find(n => n.note_id === selected.id)
		if (note) {
			const body = note.note_body || ''
			setViewDraft({ title: note.note_title, body })
			setViewDraftHtml(bodyToHtml(body, note))
		} else {
			setViewDraft(null)
			setViewDraftHtml('')
		}
	}, [selected, notes])

	const filteredNotes = notes
	const modalVisible = isOpen || showGroupCreator || Boolean(editingGroup) || Boolean(deleteCandidate)
	const showPagination = pagination && !search && pagination.total_pages > 1 && !modalVisible
	const paginationInline = showPagination && notes.length === ITEMS_PER_PAGE
	const activeNote = selected?.type === 'note' ? notes.find(n => n.note_id === selected.id) : null
	const hasDraftChanges = activeNote && viewDraft && (activeNote.note_title !== viewDraft.title || activeNote.note_body !== viewDraft.body)

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
					setActiveTab('notes')
					setSelected(null)
				})
				.catch(err => setError(err.message))
		} else {
			// Create new note
			const imageFiles = note.pendingImages || []
			apiClient.createNote(note.title, note.body, imageFiles)
				.then(() => {
					const currentTotal = pagination?.total ?? notes.length
					const lastPage = Math.ceil((currentTotal + 1) / ITEMS_PER_PAGE)
					if (!search.trim()) {
						setCurrentPage(lastPage)
					}
					setReloadNotesKey(key => key + 1)
					setIsOpen(false)
					setEditing(null)
					setActiveTab('notes')
					setSelected(null)
				})
				.catch(err => setError(err.message))
		}
	}

	async function handleSaveViewNote() {
		if (!activeNote || !viewDraft) return
		const noteId = activeNote.note_id
		const updates = {
			note_title: viewDraft.title,
			note_body: viewDraft.body,
		}
		setError(null)
		setDetailUploading(true)
		try {
			const res = await apiClient.updateNote(noteId, updates)
			const updatedNote = res.note || res
			setNotes(n => n.map(x => (x.note_id === noteId ? { ...x, ...updatedNote } : x)))
			setViewDraft({ title: updatedNote.note_title || '', body: updatedNote.note_body || '' })
			setViewDraftHtml(bodyToHtml(updatedNote.note_body || '', { ...activeNote, ...updatedNote }))
			setSelected(null)
		} catch (err) {
			setError(err.message)
		} finally {
			setDetailUploading(false)
		}
	}

	function handleEditorInput(e) {
		if (!editorRef.current) return
		const value = e.target.value
		setViewDraftHtml(bodyToHtml(value, activeNote || {}))
		setViewDraft(draft => draft ? { ...draft, body: value } : { title: '', body: value })
	}

	function handleEditorClick(event) {
		// With a simple textarea we don't support clicking embedded images.
		setSelectedMediaPlaceholder(null)
		setSelectedMediaWidth(null)
	}

	function handleImageMouseDown() {
		// Not applicable for plain textarea editor.
	}

	function updateImageInHtml() {
		// Not applicable for plain textarea editor.
	}

	async function handleUploadImageForActiveNote(event) {
		if (!selected?.type || selected.type !== 'note' || !editorRef.current) return
		const noteId = selected.id
		const files = Array.from(event.target.files || [])
		if (files.length === 0) return

		setDetailUploadError('')
		setDetailUploading(true)

		try {
			for (const file of files) {
				const res = await apiClient.uploadImage(noteId, file)
				const placeholder = res.placeholder
				const image = res.image
				if (placeholder) {
					insertTextAtCursor(placeholder)
				}
				const body = editorRef.current.value
				const updatedNote = await apiClient.updateNote(noteId, { note_body: body })
				setNotes(n => n.map(x => {
					if (x.note_id !== noteId) return x
					return {
						...updatedNote,
						mediaImages: [
							...(x.mediaImages || []),
							image,
						],
						mediaVoices: x.mediaVoices || [],
					}
				}))
				setViewDraft(draft => draft ? { ...draft, body } : { title: updatedNote.note_title || '', body })
				setViewDraftHtml(bodyToHtml(body, { ...updatedNote, mediaImages: [...(activeNote?.mediaImages || []), image] }))
			}
		} catch (err) {
			setDetailUploadError(err.message || 'Failed to upload image')
		} finally {
			setDetailUploading(false)
		}
	}

	function insertTextAtCursor(text) {
		if (!editorRef.current) return
		const el = editorRef.current
		el.focus()
		const start = el.selectionStart || 0
		const end = el.selectionEnd || 0
		const value = el.value || ''
		const newValue = value.slice(0, start) + text + value.slice(end)
		el.value = newValue
		const cursorPos = start + text.length
		setViewDraft(draft => draft ? { ...draft, body: newValue } : { title: '', body: newValue })
		setViewDraftHtml(bodyToHtml(newValue, activeNote || {}))
		setTimeout(() => {
			el.selectionStart = el.selectionEnd = cursorPos
			el.focus()
		}, 0)
	}

	function handleEditorKeyDown(e) {
		if (e.key === 'Tab') {
			e.preventDefault()
			insertTextAtCursor('  ')
		}
	}

	function updateSelectedImageWidth(width) {
		if (!selectedMediaPlaceholder || !editorRef.current) return
		const image = editorRef.current.querySelector(`img[data-placeholder="${selectedMediaPlaceholder}"]`)
		if (!image) return
		const [base, meta] = selectedMediaPlaceholder.split('|')
		const newPlaceholder = meta ? `${base}|w=${width}` : `${base}|w=${width}`
		image.style.width = `${width}px`
		image.dataset.placeholder = newPlaceholder
		setSelectedMediaPlaceholder(newPlaceholder)
		setSelectedMediaWidth(width)
		const html = editorRef.current.innerHTML
		const body = htmlToBody(html)
		setViewDraftHtml(html)
		setViewDraft(draft => draft ? { ...draft, body } : { title: '', body })
	}

	function clearSelectedMedia() {
		setSelectedMediaPlaceholder(null)
		setSelectedMediaWidth(null)
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

	if (authLoading) {
		return <div className="loading">Loading...</div>
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
					notes={notes}
					groups={groups}
					selected={selected}
					onSelectNote={(id) => setSelected({ type: 'note', id })}
					onSelectGroup={(id) => setSelected({ type: 'group', id })}
				/>

				<main className="main">
					{activeTab === 'notes' ? (
						selected && selected.type === 'note' ? (
					activeNote ? (
						<div className="note-full">
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
								<input
									className="note-title-input"
									dir="ltr"
									value={viewDraft?.title ?? ''}
									onChange={(e) => setViewDraft(d => d ? { ...d, title: e.target.value } : { title: e.target.value, body: '' })}
									placeholder="Untitled"
									aria-label="Note title"
								/>
								<button className="btn primary" disabled={!hasDraftChanges || detailUploading} onClick={handleSaveViewNote}>
									Save
								</button>
							</div>
							<div className="media-section" style={{ margin: '18px 0' }}>
								<label className="btn secondary" style={{ marginRight: '12px' }}>
									📷 Add Image
									<input
										type="file"
										accept="image/*"
										onChange={handleUploadImageForActiveNote}
										disabled={detailUploading}
										style={{ display: 'none' }}
										multiple
									/>
								</label>
								{detailUploading && <span style={{ color: 'var(--primary)', marginLeft: '4px' }}>Uploading...</span>}
								{detailUploadError && <div className="modal-error" style={{ marginTop: '8px' }}>{detailUploadError}</div>}
							</div>
							<div className="note-body-editor-wrapper">
								<textarea
									ref={editorRef}
									className="note-body-editor"
									dir="ltr"
									value={viewDraft?.body ?? ''}
									onChange={handleEditorInput}
									onKeyDown={handleEditorKeyDown}
								/>
								{selectedMediaPlaceholder && (
									<div className="selected-media-controls">
										<div className="selected-media-label">Resize selected image</div>
										<input
											type="range"
											min="80"
											max="800"
											value={selectedMediaWidth || 300}
											onChange={(e) => updateSelectedImageWidth(Number(e.target.value))}
										/>
										<div>{selectedMediaWidth || 300}px</div>
										<button type="button" className="btn ghost" onClick={clearSelectedMedia}>
											Done
										</button>
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="empty-state"><h3>Note not found</h3></div>
					)
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
													note={note}
													onDelete={() => handleDelete(note)}
													onSelect={() => setSelected({ type: 'note', id: note.note_id })}
												/>
											))}
										</div>
										{showPagination && (
											<Pagination
												pagination={pagination}
												onPageChange={setCurrentPage}
												inline={paginationInline}
											/>
										)}
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
															note={note}

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
