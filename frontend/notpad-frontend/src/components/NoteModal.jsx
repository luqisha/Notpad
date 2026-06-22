import { useState, useEffect, useRef } from 'react'
import { apiClient } from '../services/api'

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

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function findImageUrlByIndex(images, index) {
  if (!images) return null
  const ref = Array.isArray(images) ? images.find(item => item.index === index) : null
  if (!ref) return null
  return ref?.picture_url || ref?.image_url || ref?.url || null
}

function bodyToHtml(body = '', images = []) {
  const escaped = escapeHtml(body)
  return escaped.replace(/\[(IMG|AUD):(\d+)(\|[^\]]+)?\]/g, (match, type, index) => {
    const meta = parsePlaceholderMeta(match)?.meta || {}
    if (type === 'IMG') {
      const src = findImageUrlByIndex(images, Number(index))
      if (!src) return `<span class="note-placeholder">${escapeHtml(match)}</span>`
      const widthStyle = meta.width ? `width:${meta.width}px;` : 'max-width:100%;'
      const dataPlaceholder = serializePlaceholder(type, Number(index), meta)
      return `<img class="note-body-image editor-image" contenteditable="false" data-placeholder="${dataPlaceholder}" src="${src}" style="${widthStyle} vertical-align:middle; margin:4px;" />`
    }
    if (type === 'AUD') {
      return `<span class="note-placeholder">${escapeHtml(match)}</span>`
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

export default function NoteModal({ initial, onCancel, onSave }) {
 	const [title, setTitle] = useState(initial?.title || '')
 	const [error, setError] = useState('')
 	const [uploading, setUploading] = useState(false)
 	const [selectedMediaPlaceholder, setSelectedMediaPlaceholder] = useState(null)
 	const [selectedMediaWidth, setSelectedMediaWidth] = useState(null)
 	const [bodyLength, setBodyLength] = useState((initial?.body || '').length)
 	const [isResizing, setIsResizing] = useState(false)
 	const [handlePos, setHandlePos] = useState(null)
 	const [isRecording, setIsRecording] = useState(false)
 	const [recordingTime, setRecordingTime] = useState(0)
 	const editorRef = useRef(null)
 	const pendingFilesRef = useRef({})
 	const selectedImageEl = useRef(null)
 	const resizeStartPos = useRef({ x: 0, w: 0, aspect: 1 })
 	const savedRangeRef = useRef(null)
 	const mediaRecorderRef = useRef(null)
 	const audioChunksRef = useRef([])
 	const recordingTimerRef = useRef(null)

	const isEdit = Boolean(initial?.id)
	const noteImages = initial?.mediaImages || []

	useEffect(() => {
		if (editorRef.current) {
			if (initial?.id && initial?.body) {
				editorRef.current.innerHTML = bodyToHtml(initial.body, noteImages)
			} else {
				editorRef.current.innerHTML = ''
			}
		}
	}, [])

	function handleEditorInput() {
		if (!editorRef.current) return
		setBodyLength(htmlToBody(editorRef.current.innerHTML).length)
	}

	function handleEditorClick(event) {
		const img = event.target.closest('.editor-image')
		if (img) {
			const width = parseInt(img.style.width) || 300
			selectedImageEl.current = img
			if (img.dataset.placeholder) {
				setSelectedMediaPlaceholder(img.dataset.placeholder)
			} else if (img.classList.contains('pending-image')) {
				setSelectedMediaPlaceholder(`__pending__:${img.dataset.pendingId}`)
			} else {
				return
			}
			setSelectedMediaWidth(width)
			editorRef.current?.querySelectorAll('.editor-image.selected-image').forEach(el => el.classList.remove('selected-image'))
			img.classList.add('selected-image')
			return
		}
		selectedImageEl.current = null
		setHandlePos(null)
		editorRef.current?.querySelectorAll('.editor-image.selected-image').forEach(el => el.classList.remove('selected-image'))
		setSelectedMediaPlaceholder(null)
		setSelectedMediaWidth(null)
	}

	function updateSelectedImageWidth(width) {
		if (!selectedMediaPlaceholder || !editorRef.current) return
		let image
		if (selectedMediaPlaceholder.startsWith('__pending__:')) {
			const pendingId = selectedMediaPlaceholder.replace('__pending__:', '')
			image = editorRef.current.querySelector(`img[data-pending-id="${CSS.escape(pendingId)}"]`)
		} else {
			image = editorRef.current.querySelector(`img[data-placeholder="${CSS.escape(selectedMediaPlaceholder)}"]`)
		}
		if (!image) return
		const aspect = (image.naturalWidth / image.naturalHeight) || 1
		const height = Math.round(width / aspect)
		image.style.width = `${width}px`
		image.style.height = `${height}px`
		if (image.dataset.placeholder) {
			const [typeIndex, meta] = selectedMediaPlaceholder.split('|')
			const newPlaceholder = meta ? `${typeIndex}|w=${width}` : `${typeIndex}|w=${width}`
			image.dataset.placeholder = newPlaceholder
			setSelectedMediaPlaceholder(newPlaceholder)
		} else if (image.classList.contains('pending-image')) {
			image.dataset.resizeWidth = width
			setSelectedMediaPlaceholder(selectedMediaPlaceholder)
		}
		setSelectedMediaWidth(width)
	}

	function handleResizeMouseDown(e) {
		e.preventDefault()
		e.stopPropagation()
		const img = selectedImageEl.current
		if (!img) return
		const currentWidth = parseInt(img.style.width) || Math.min(img.naturalWidth || 300, 800)
		resizeStartPos.current = { x: e.clientX, w: currentWidth, aspect: (img.naturalWidth / img.naturalHeight) || 1 }
		setIsResizing(true)
		document.body.style.cursor = 'nwse-resize'
		document.body.style.userSelect = 'none'
	}

	useEffect(() => {
		if (!isResizing) return
		function onMouseMove(e) {
			const img = selectedImageEl.current
			if (!img) return
			const dx = e.clientX - resizeStartPos.current.x
			const newWidth = Math.max(80, Math.min(1200, resizeStartPos.current.w + dx))
			const newHeight = Math.round(newWidth / resizeStartPos.current.aspect)
			img.style.width = `${newWidth}px`
			img.style.height = `${newHeight}px`
		}
		function onMouseUp() {
			setIsResizing(false)
			document.body.style.cursor = ''
			document.body.style.userSelect = ''
			if (selectedImageEl.current && selectedMediaPlaceholder) {
				const w = parseInt(selectedImageEl.current.style.width)
				updateSelectedImageWidth(w || 300)
			}
		}
		window.addEventListener('mousemove', onMouseMove)
		window.addEventListener('mouseup', onMouseUp)
		return () => {
			window.removeEventListener('mousemove', onMouseMove)
			window.removeEventListener('mouseup', onMouseUp)
		}
	}, [isResizing])

	useEffect(() => {
		if (!selectedMediaPlaceholder || !selectedImageEl.current) {
			setHandlePos(null)
			return
		}
		function updatePos() {
			const img = selectedImageEl.current
			if (!img || !editorRef.current) return
			const imgRect = img.getBoundingClientRect()
			const wrapper = editorRef.current.parentElement
			if (!wrapper) return
			const wrapperRect = wrapper.getBoundingClientRect()
			setHandlePos({
				top: imgRect.bottom - wrapperRect.top - 8,
				left: imgRect.right - wrapperRect.left - 8,
			})
		}
		updatePos()
		window.addEventListener('scroll', updatePos, true)
		window.addEventListener('resize', updatePos)
		const obs = new ResizeObserver(updatePos)
		if (editorRef.current) obs.observe(editorRef.current)
		return () => {
			window.removeEventListener('scroll', updatePos, true)
			window.removeEventListener('resize', updatePos)
			obs.disconnect()
		}
	}, [selectedMediaPlaceholder, selectedMediaWidth])

	function clearSelectedMedia() {
		selectedImageEl.current = null
		setHandlePos(null)
		setSelectedMediaPlaceholder(null)
		setSelectedMediaWidth(null)
	}

	function saveCursorPosition() {
		const sel = window.getSelection()
		if (sel.rangeCount > 0 && editorRef.current) {
			const range = sel.getRangeAt(0)
			if (editorRef.current.contains(range.commonAncestorContainer)) {
				savedRangeRef.current = range.cloneRange()
			}
		}
	}

	function insertHtmlAtCursor(editor, html) {
		editor.focus()
		const selection = window.getSelection()
		let range
		if (!selection.rangeCount) {
			if (savedRangeRef.current) {
				range = savedRangeRef.current.cloneRange()
				selection.addRange(range)
			} else {
				range = document.createRange()
				range.setStart(editor, 0)
				range.collapse(true)
				selection.addRange(range)
			}
		} else {
			range = selection.getRangeAt(0)
			if (!editor.contains(range.commonAncestorContainer)) {
				if (savedRangeRef.current) {
					range = savedRangeRef.current.cloneRange()
					selection.removeAllRanges()
					selection.addRange(range)
				} else {
					range.selectNodeContents(editor)
					range.collapse(false)
				}
			}
			range.deleteContents()
		}
		const fragment = range.createContextualFragment(html)
		const lastNode = fragment.lastChild
		range.insertNode(fragment)
		if (lastNode) {
			range.setStartAfter(lastNode)
			range.collapse(true)
		}
		selection.removeAllRanges()
		selection.addRange(range)
	}

	async function handleImageUpload(e) {
		const fileList = e.target.files
		const files = Array.from(fileList || [])
		if (files.length === 0 || !editorRef.current) return
		setError('')
		setUploading(true)
		try {
			for (const file of files) {
				if (isEdit) {
					const res = await apiClient.uploadImage(initial.id, file)
					const placeholder = res.placeholder
					const pictureUrl = res.image?.picture_url
					if (placeholder && pictureUrl) {
						const imgHtml = `<img class="note-body-image editor-image" contenteditable="false" data-placeholder="${placeholder}" src="${pictureUrl}" style="width:300px; max-width:100%; vertical-align:middle; margin:4px;" />`
						insertHtmlAtCursor(editorRef.current, imgHtml)
					}
				} else {
					const dataId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
					pendingFilesRef.current[dataId] = file
					const blobUrl = URL.createObjectURL(file)
					const imgHtml = `<img class="note-body-image editor-image pending-image" contenteditable="false" data-pending-id="${dataId}" src="${blobUrl}" style="width:300px; max-width:100%; vertical-align:middle; margin:4px;" />`
					insertHtmlAtCursor(editorRef.current, imgHtml)
				}
			}
			setBodyLength(htmlToBody(editorRef.current.innerHTML).length)
		} catch (err) {
			setError('Failed to upload image: ' + err.message)
		} finally {
			setUploading(false)
			e.target.value = ''
		}
	}

	async function handleVoiceUpload(e) {
 		const file = e.target.files?.[0]
 		if (!file || !isEdit) return
 		setUploading(true)
 		try {
 			await apiClient.uploadVoice(initial.id, file)
 		} catch (err) {
 			setError('Failed to upload voice: ' + err.message)
 		} finally {
 			setUploading(false)
 		}
 	}

 	function startRecordingTimer() {
 		setRecordingTime(0)
 		recordingTimerRef.current = setInterval(() => {
 			setRecordingTime(prev => prev + 1)
 		}, 1000)
 	}

 	function stopRecordingTimer() {
 		if (recordingTimerRef.current) {
 			clearInterval(recordingTimerRef.current)
 			recordingTimerRef.current = null
 		}
 	}

 	async function startVoiceRecording() {
 		try {
 			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
 			audioChunksRef.current = []
 			mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' })

 			mediaRecorderRef.current.ondataavailable = (event) => {
 				if (event.data.size > 0) {
 					audioChunksRef.current.push(event.data)
 				}
 			}

 			mediaRecorderRef.current.onstop = async () => {
 				stream.getTracks().forEach(track => track.stop())
 				const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
 				await uploadVoiceRecording(audioBlob)
 			}

 			mediaRecorderRef.current.start()
 			setIsRecording(true)
 			startRecordingTimer()
 		} catch (err) {
 			setError('Failed to start recording: ' + err.message)
 		}
 	}

 	function stopVoiceRecording() {
 		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
 			mediaRecorderRef.current.stop()
 		}
 		setIsRecording(false)
 		stopRecordingTimer()
 	}

 	async function uploadVoiceRecording(audioBlob) {
 		setUploading(true)
 		try {
 			if (isEdit) {
 				const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
 				await apiClient.uploadVoice(initial.id, file)
 			} else {
 				const pendingId = `pending-voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
 				pendingFilesRef.current[pendingId] = audioBlob
 				const blobUrl = URL.createObjectURL(audioBlob)
 				const audioHtml = `<audio class="note-body-audio editor-audio pending-audio" controls data-pending-id="${pendingId}" src="${blobUrl}" style="width:100%; max-width:400px; margin:8px 0;"></audio>`
 				insertHtmlAtCursor(editorRef.current, audioHtml)
 				setBodyLength(htmlToBody(editorRef.current.innerHTML).length)
 			}
 		} catch (err) {
 			setError('Failed to upload voice: ' + err.message)
 		} finally {
 			setUploading(false)
 		}
 	}

	function handleTitleChange(e) {
		setTitle(e.target.value)
		if (e.target.getAttribute('dir') !== 'ltr') {
			e.target.setAttribute('dir', 'ltr')
		}
	}

	async function submit(e) {
		e.preventDefault()
		setError('')

		const trimmedTitle = title.trim()
		const html = editorRef.current?.innerHTML || ''
		const bodyText = htmlToBody(html)

		if (!trimmedTitle || !bodyText) {
			setError('Title and body are required')
			return
		}

		if (bodyText.length > 1000) {
			setError('Body must be less than 1000 characters')
			return
		}

		setUploading(true)
		try {
			if (isEdit) {
				await apiClient.updateNote(initial.id, {
					note_title: trimmedTitle,
					note_body: bodyText,
				})
				onSave({
					...initial,
					title: trimmedTitle,
					body: bodyText,
				})
			} else {
 				const pendingImgs = Array.from(editorRef.current?.querySelectorAll('.pending-image') || [])
 				const pendingAudios = Array.from(editorRef.current?.querySelectorAll('.pending-audio') || [])

 				let createBody = bodyText
 				const createRes = await apiClient.createNote(trimmedTitle, createBody)

 				const noteId = createRes.note?.note_id || createRes.note?.id
 				if (!noteId) throw new Error('Failed to create note')

 				const hasPendingMedia = pendingImgs.length > 0 || pendingAudios.length > 0

 				if (hasPendingMedia) {
 					for (const img of pendingImgs) {
 						const dataId = img.dataset.pendingId
 						if (!dataId) continue
 						const file = pendingFilesRef.current[dataId]
 						if (!file) continue

 						const uploadRes = await apiClient.uploadImage(noteId, file)
 						let ph = uploadRes.placeholder
 						const picUrl = uploadRes.image?.picture_url
 						const resizeWidth = img.dataset.resizeWidth
 						if (resizeWidth) {
 							const parsed = parsePlaceholderMeta(ph)
 							if (parsed) {
 								ph = serializePlaceholder(parsed.type, parsed.index, { width: Number(resizeWidth) })
 							}
 						}
 						if (ph && picUrl) {
 							URL.revokeObjectURL(img.src)
 							img.src = picUrl
 							img.dataset.placeholder = ph
 							img.style.width = resizeWidth ? `${resizeWidth}px` : ''
 							img.style.height = ''
 							img.classList.remove('pending-image')
 							img.removeAttribute('data-pending-id')
 							img.removeAttribute('data-resize-width')
 						}
 						delete pendingFilesRef.current[dataId]
 					}

 					for (const audio of pendingAudios) {
 						const dataId = audio.dataset.pendingId
 						if (!dataId) continue
 						const audioBlob = pendingFilesRef.current[dataId]
 						if (!audioBlob) continue

 						const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
 						await apiClient.uploadVoice(noteId, file)
 						URL.revokeObjectURL(audio.src)
 						audio.classList.remove('pending-audio')
 						audio.removeAttribute('data-pending-id')
 						delete pendingFilesRef.current[dataId]
 					}

 					const finalHtml = editorRef.current.innerHTML
 					const finalBody = htmlToBody(finalHtml)
 					await apiClient.updateNote(noteId, { note_body: finalBody })
 					onSave({
 						...initial,
 						title: trimmedTitle,
 						body: finalBody,
 						id: noteId,
 					})
 				} else {
 					onSave({
 						...initial,
 						title: trimmedTitle,
 						body: createBody,
 						id: noteId,
 					})
 				}
 			}
		} catch (err) {
			setError(err.message || 'Failed to save note')
		} finally {
			setUploading(false)
		}
	}

	return (
		<div className="modal">
			<form className="modal-content" onSubmit={submit}>
				<div className="modal-header">
					<h3>{isEdit ? 'Edit Note' : 'New Note'}</h3>
				</div>
				{error && <div className="modal-error">{error}</div>}
				<label className="field">
					Title
					<input
						dir="ltr"
						autoComplete="off"
						spellCheck="false"
						placeholder="Give it a short title (min 1 char)"
						value={title}
						onChange={handleTitleChange}
					/>
					<span className="char-count">{title.length}/100</span>
				</label>
				<label className="field">
					Body
					<div className="note-body-editor-wrapper" style={{ position: 'relative', margin: 0 }}>
						<div
							className="note-body-editor ce-editor modal-editor"
							ref={editorRef}
							contentEditable
							suppressContentEditableWarning
							dir="ltr"
							onInput={handleEditorInput}
							onClick={handleEditorClick}
							onMouseUp={saveCursorPosition}
							onKeyUp={saveCursorPosition}
						/>
						{handlePos && !isResizing && (
							<div
								className="image-resize-handle"
								style={{ top: handlePos.top, left: handlePos.left }}
								onMouseDown={handleResizeMouseDown}
							/>
						)}
						{isResizing && (
							<div className="image-resize-overlay" />
						)}
					</div>
					<span className="char-count">{bodyLength}/1000</span>
				</label>

				<div className="media-section">
 					<div className="media-upload">
 						<label className="btn secondary" onMouseDown={saveCursorPosition}>
 							📷 Add Image
 							<input
 								type="file"
 								accept="image/*"
 								onChange={handleImageUpload}
 								disabled={uploading}
 								style={{ display: 'none' }}
 								multiple={true}
 							/>
 						</label>
 						{isEdit && (
 							<label className="btn secondary">
 								🎙️ Add Voice
 								<input
 									type="file"
 									accept="audio/*"
 									onChange={handleVoiceUpload}
 									disabled={uploading}
 									style={{ display: 'none' }}
 								/>
 							</label>
 						)}
 						<button
 							type="button"
 							className={`btn secondary ${isRecording ? 'recording' : ''}`}
 							onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
 							disabled={uploading}
 							onMouseDown={saveCursorPosition}
 						>
 							{isRecording ? (
 								<>
 									⏹️ Stop Recording
 									<span className="recording-time"> ({formatTime(recordingTime)})</span>
 									<span className="recording-indicator" />
 								</>
 							) : (
 								'🎙️ Record Voice'
 							)}
 						</button>
 					</div>
 				</div>

				<div className="modal-actions">
					<button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
					<button type="submit" className="btn primary" disabled={uploading}>
						{uploading ? 'Saving...' : 'Save'}
					</button>
				</div>
			</form>
		</div>
	)
}
