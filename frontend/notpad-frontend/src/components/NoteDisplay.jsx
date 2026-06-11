export default function NoteDisplay({ note, onEdit, onDelete, onSelect, className = '' }) {
  if (!note) return null

  function renderBodyPreview(body = '', maxChars = 120) {
    if (!body) return 'No content yet.'

    const placeholderMap = {
      IMG: '[Image]',
      AUD: '[Audio]',
    }
    const regex = /\[(IMG|AUD):(\d+)[^\]]*\]/g
    let result = ''
    let lastIndex = 0
    let match

    while ((match = regex.exec(body)) !== null) {
      const [placeholder, type] = match
      const start = match.index

      if (start > lastIndex) {
        result += body.slice(lastIndex, start)
      }

      result += placeholderMap[type] || placeholder
      lastIndex = start + placeholder.length

      if (result.length >= maxChars) {
        break
      }
    }

    if (lastIndex < body.length && result.length < maxChars) {
      result += body.slice(lastIndex)
    }

    if (result.length > maxChars) {
      result = `${result.slice(0, maxChars).trimEnd()}...`
    }

    return result || 'No content yet.'
  }

  function getMediaPreviewItems() {
    const images = Array.isArray(note.mediaImages) ? note.mediaImages : []
    const voices = Array.isArray(note.mediaVoices) ? note.mediaVoices : []

    return {
      images: images.map((image) => ({
        type: 'image',
        key: image.picture_id || image.picture_url || image.id,
        src: image.picture_url || image.image_url || image.url,
      })),
      voices: voices.map((voice) => ({
        type: 'audio',
        key: voice.voice_id || voice.voice_url || voice.id,
        src: voice.voice_url || voice.url,
      })),
    }
  }

  function renderMediaPreview() {
    const { images, voices } = getMediaPreviewItems()
    if (images.length === 0 && voices.length === 0) return null

    let visibleItems = []
    if (images.length > 0 && voices.length > 0) {
      visibleItems = [images[0], voices[0]]
    } else if (images.length > 0) {
      visibleItems = images.slice(0, 2)
    } else if (voices.length > 0) {
      visibleItems = voices.slice(0, 2)
    }

    const totalCount = images.length + voices.length
    const moreCount = Math.max(0, totalCount - visibleItems.length)

    return (
      <div className="note-media-preview-row">
        {visibleItems.map((item) => (
          item.type === 'image' ? (
            <img
              key={item.key}
              src={item.src}
              alt="Image preview"
              className="note-preview-media note-preview-image"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div key={item.key} className="note-preview-media note-preview-audio" onClick={(e) => e.stopPropagation()}>
              <audio controls src={item.src} className="note-preview-audio-element" />
            </div>
          )
        ))}
        {moreCount > 0 && (
          <div className="note-media-more">+{moreCount}</div>
        )}
      </div>
    )
  }

  return (
    <div
      className={["note", typeof onSelect === 'function' && 'note-clickable', className].filter(Boolean).join(' ')}
      onClick={typeof onSelect === 'function' ? onSelect : undefined}
      role={typeof onSelect === 'function' ? 'button' : undefined}
      tabIndex={typeof onSelect === 'function' ? 0 : undefined}
      onKeyDown={typeof onSelect === 'function' ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      } : undefined}
    >
      <div className="note-body">
        <strong className="note-title">{note.note_title || note.title || 'Untitled'}</strong>
        <p className="note-text">
          {renderBodyPreview(note.note_body || note.body || '')}
        </p>
        {renderMediaPreview()}
      </div>
      <div className="note-actions">
        <div className="note-actions-left">
          {typeof onEdit === 'function' && (
            <button className="btn ghost" onClick={(e) => { e.stopPropagation(); onEdit(note) }}>
              Edit
            </button>
          )}
        </div>
        <div className="note-actions-right">
          {typeof onDelete === 'function' && (
            <button className="btn danger" onClick={(e) => { e.stopPropagation(); onDelete(note) }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
