export default function NoteDisplay({ note, onEdit, onDelete, onSelect, onRemoveImage, className = '' }) {
  if (!note) return null

  function renderBodyPreview(body = '', maxChars = 120) {
    if (!body) return 'No content yet.'

    const cleanBody = body
      .replace(/\[IMG:[^\]]*\]/g, '')
      .replace(/\[AUD:[^\]]*\]/g, '[Audio]')
      .replace(/[\[\]]+/g, '')

    if (cleanBody.length > maxChars) {
      return `${cleanBody.slice(0, maxChars).trimEnd()}...`
    }
    return cleanBody || 'No content yet.'
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
        key: voice.voice_id || voice.voice_url || voice.id || voice.picture_id,
        src: voice.voice_url || voice.url || voice.audio_url || voice.file_url,
      })),
    }
  }

  function renderMediaPreview() {
    const { images, voices } = getMediaPreviewItems()
    if (images.length === 0 && voices.length === 0) return null

    const MAX_PREVIEW_IMAGES = 2
    const MAX_PREVIEW_AUDIO = 2

    let visibleItems = []
    if (images.length > 0 && voices.length > 0) {
      visibleItems = [
        ...images.slice(0, MAX_PREVIEW_IMAGES - 1),
        ...voices.slice(0, MAX_PREVIEW_AUDIO)
      ]
    } else if (images.length > 0) {
      visibleItems = images.slice(0, MAX_PREVIEW_IMAGES)
    } else if (voices.length > 0) {
      visibleItems = voices.slice(0, MAX_PREVIEW_AUDIO)
    }

    const totalCount = images.length + voices.length
    const moreCount = Math.max(0, totalCount - visibleItems.length)

    return (
      <div className="note-media-preview-row">
        {visibleItems.map((item) => (
          item.type === 'image' ? (
            <div key={item.key} className="note-preview-image-wrapper">
              <img
                src={item.src}
                alt="Image preview"
                className="note-preview-media note-preview-image"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <div key={item.key} className="note-preview-media note-preview-audio" onClick={(e) => e.stopPropagation()}>
              <audio controls src={item.src} className="note-preview-audio-element" style={{ width: '180px', minWidth: '180px' }} />
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
