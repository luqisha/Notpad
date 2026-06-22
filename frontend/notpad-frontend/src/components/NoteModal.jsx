import { useCallback, useState, useEffect, useRef } from 'react'
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

function findVoiceUrlByIndex(voices, index) {
  if (!voices) return null
  const ref = Array.isArray(voices) ? voices.find(item => item.index === index) : null
  if (!ref) return null
  return ref?.voice_url || ref?.url || ref?.audio_url || ref?.file_url || null
}

function bodyToHtml(body = '', images = [], voices = []) {
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
      const src = findVoiceUrlByIndex(voices, Number(index))
      if (!src) return `<span class="note-placeholder">${escapeHtml(match)}</span>`
      const dataPlaceholder = serializePlaceholder(type, Number(index), meta)
      return `<audio controls class="note-body-audio editor-audio" contenteditable="false" data-placeholder="${dataPlaceholder}" src="${src}" style="width:100%; max-width:400px; margin:8px 0;"></audio>`
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
      return node.dataset.placeholder ? node.dataset.placeholder : ''
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
  const [title, setTitle] = useState(initial?.title || initial?.note_title || '')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedMediaPlaceholder, setSelectedMediaPlaceholder] = useState(null)
  const [selectedMediaWidth, setSelectedMediaWidth] = useState(null)
  const [bodyLength, setBodyLength] = useState((initial?.body || initial?.note_body || '').length)
  const [isResizing, setIsResizing] = useState(false)
  const [handlePos, setHandlePos] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const contentRef = useRef(null)
  const editorRef = useRef(null)
  const pendingFilesRef = useRef({})
  const selectedImageEl = useRef(null)
  const resizeStartPos = useRef({ x: 0, w: 0, aspect: 1 })
  const savedRangeRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

  const isEdit = Boolean(initial?.id || initial?.note_id)

  useEffect(() => {
    if (editorRef.current) {
      const noteImages = initial?.mediaImages || []
      const noteVoices = initial?.mediaVoices || []
      const body = initial?.body || initial?.note_body || ''
      if (body) {
        editorRef.current.innerHTML = bodyToHtml(body, noteImages, noteVoices)
      } else {
        editorRef.current.innerHTML = ''
      }
    }
  }, [initial])

  // Backdrop click auto-save helper
  function handleBackdropClick(e) {
    if (contentRef.current && !contentRef.current.contains(e.target)) {
      submit(e)
    }
  }

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

  const updateSelectedImageWidth = useCallback((width) => {
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
      const parsed = parsePlaceholderMeta(selectedMediaPlaceholder)
      if (!parsed) return
      const newPlaceholder = serializePlaceholder(parsed.type, parsed.index, { ...parsed.meta, width })
      image.dataset.placeholder = newPlaceholder
      setSelectedMediaPlaceholder(newPlaceholder)
    } else if (image.classList.contains('pending-image')) {
      image.dataset.resizeWidth = width
      setSelectedMediaPlaceholder(selectedMediaPlaceholder)
    }
    setSelectedMediaWidth(width)
  }, [selectedMediaPlaceholder])

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
  }, [isResizing, selectedMediaPlaceholder, updateSelectedImageWidth])

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

  // Track cursor position for injecting media
  useEffect(() => {
    function handleSelectionChange() {
      const sel = window.getSelection()
      if (sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0)
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          savedRangeRef.current = range.cloneRange()
        }
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])

  function insertHtmlAtCursor(editor, html) {
    editor.focus()
    const selection = window.getSelection()
    let range

    if (savedRangeRef.current) {
      range = savedRangeRef.current.cloneRange()
    } else if (selection.rangeCount > 0) {
      const currentRange = selection.getRangeAt(0)
      if (editor.contains(currentRange.commonAncestorContainer)) {
        range = currentRange.cloneRange()
      }
    }

    if (!range) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false) // Position at the end
    }

    selection.removeAllRanges()
    selection.addRange(range)

    // Delete selected text if any
    range.deleteContents()

    const fragment = range.createContextualFragment(html)
    const lastNode = fragment.lastChild
    range.insertNode(fragment)

    if (lastNode) {
      range.setStartAfter(lastNode)
      range.collapse(true)
    }

    selection.removeAllRanges()
    selection.addRange(range)

    // Save the range right after insertion so subsequent media inserts sequentially
    savedRangeRef.current = range.cloneRange()
  }

  async function handleImageUpload(e) {
    const fileList = e.target.files
    const files = Array.from(fileList || [])
    if (files.length === 0 || !editorRef.current) return
    setError('')
    setUploading(true)
    const noteId = initial?.id || initial?.note_id
    try {
      for (const file of files) {
        if (isEdit) {
          const res = await apiClient.uploadImage(noteId, file)
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
    const noteId = initial?.id || initial?.note_id
    if (!file || !isEdit) return
    setUploading(true)
    try {
      const res = await apiClient.uploadVoice(noteId, file)
      if (res.placeholder && res.voice?.voice_url && editorRef.current) {
        const audioHtml = `<audio class="note-body-audio editor-audio" controls contenteditable="false" data-placeholder="${res.placeholder}" src="${res.voice.voice_url}" style="width:100%; max-width:400px; margin:8px 0;"></audio>`
        insertHtmlAtCursor(editorRef.current, audioHtml)
        setBodyLength(htmlToBody(editorRef.current.innerHTML).length)
      }
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
    const noteId = initial?.id || initial?.note_id
    try {
      if (isEdit) {
        const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        const res = await apiClient.uploadVoice(noteId, file)
        if (res.placeholder && res.voice?.voice_url && editorRef.current) {
          const audioHtml = `<audio class="note-body-audio editor-audio" controls contenteditable="false" data-placeholder="${res.placeholder}" src="${res.voice.voice_url}" style="width:100%; max-width:400px; margin:8px 0;"></audio>`
          insertHtmlAtCursor(editorRef.current, audioHtml)
          setBodyLength(htmlToBody(editorRef.current.innerHTML).length)
        }
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
    if (e) e.preventDefault()
    setError('')

    const trimmedTitle = title.trim()
    const html = editorRef.current?.innerHTML || ''
    const bodyText = htmlToBody(html)

    // If both are empty, don't trigger anything, just cancel
    if (!trimmedTitle && !bodyText) {
      onCancel()
      return
    }

    if (bodyText.length > 1000) {
      setError('Body must be less than 1000 characters')
      return
    }

    setUploading(true)
    const noteId = initial?.id || initial?.note_id
    try {
      if (isEdit) {
        await apiClient.updateNote(noteId, {
          note_title: trimmedTitle,
          note_body: bodyText,
        })
        onSave({
          ...initial,
          title: trimmedTitle,
          body: bodyText,
          note_title: trimmedTitle,
          note_body: bodyText,
        })
      } else {
        const pendingImgs = Array.from(editorRef.current?.querySelectorAll('.pending-image') || [])
        const pendingAudios = Array.from(editorRef.current?.querySelectorAll('.pending-audio') || [])

        let createBody = bodyText
        const createRes = await apiClient.createNote(trimmedTitle, createBody)

        const createdNoteId = createRes.note?.note_id || createRes.note?.id
        if (!createdNoteId) throw new Error('Failed to create note')

        const hasPendingMedia = pendingImgs.length > 0 || pendingAudios.length > 0

        if (hasPendingMedia) {
          for (const img of pendingImgs) {
            const dataId = img.dataset.pendingId
            if (!dataId) continue
            const file = pendingFilesRef.current[dataId]
            if (!file) continue

            const uploadRes = await apiClient.uploadImage(createdNoteId, file)
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
            const uploadRes = await apiClient.uploadVoice(createdNoteId, file)
            if (uploadRes.placeholder) {
              audio.dataset.placeholder = uploadRes.placeholder
            }
            URL.revokeObjectURL(audio.src)
            audio.classList.remove('pending-audio')
            audio.removeAttribute('data-pending-id')
            delete pendingFilesRef.current[dataId]
          }

          const finalHtml = editorRef.current.innerHTML
          const finalBody = htmlToBody(finalHtml)
          await apiClient.updateNote(createdNoteId, { note_body: finalBody })
          onSave({
            ...initial,
            title: trimmedTitle,
            body: finalBody,
            note_title: trimmedTitle,
            note_body: finalBody,
            id: createdNoteId,
            note_id: createdNoteId,
          })
        } else {
          onSave({
            ...initial,
            title: trimmedTitle,
            body: createBody,
            note_title: trimmedTitle,
            note_body: createBody,
            id: createdNoteId,
            note_id: createdNoteId,
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
    <div className="modal" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <form ref={contentRef} className="modal-content" onSubmit={submit}>
        {error && <div className="modal-error">{error}</div>}

        {/* Borderless and label-less Title Input */}
        <div className="field" style={{ marginBottom: '8px' }}>
          <input
            dir="ltr"
            autoComplete="off"
            spellCheck="false"
            placeholder="Title"
            value={title}
            onChange={handleTitleChange}
            style={{ fontSize: '18px', fontWeight: '600' }}
          />
        </div>

        {/* Contenteditable Body Editor */}
        <div className="note-body-editor-wrapper" style={{ margin: 0 }}>
          <div
            className="note-body-editor ce-editor modal-editor"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dir="ltr"
            data-placeholder="Note"
            onInput={handleEditorInput}
            onClick={handleEditorClick}
            style={{ minHeight: '100px', border: 'none', padding: 0 }}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="char-count" style={{ alignSelf: 'center', marginTop: 0 }}>{bodyLength}/1000</span>
        </div>

        {/* Clean Google Keep Footer Actions */}
        <div className="media-section">
          <div className="media-upload">
            {/* SVG Image Upload Button */}
            <label className="card-icon-btn" title="Add Image">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                style={{ display: 'none' }}
                multiple
              />
            </label>

            {/* SVG Voice File Upload Button (only if editing an existing note) */}
            {isEdit && (
              <label className="card-icon-btn" title="Upload Voice File">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleVoiceUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            )}

            {/* SVG Voice Recording Button */}
            <button
              type="button"
              className={`card-icon-btn ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={uploading}
              title={isRecording ? "Stop Recording" : "Record Voice"}
            >
              {isRecording ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fff' }}>
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              )}
            </button>
            {isRecording && (
              <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 'bold' }}>
                {formatTime(recordingTime)}
              </span>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onCancel} style={{ fontWeight: '500' }}>Cancel</button>
            <button type="submit" className="note-creator-btn-close" disabled={uploading} style={{ fontWeight: '600' }}>
              {uploading ? 'Saving...' : 'Close'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
