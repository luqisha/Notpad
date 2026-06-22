import { useRef } from 'react'

export default function ConfirmModal({ isOpen, message = 'Are you sure?', onCancel, onConfirm }) {
  const contentRef = useRef(null)

  if (!isOpen) return null

  function handleBackdropClick(e) {
    if (contentRef.current && !contentRef.current.contains(e.target)) {
      onCancel()
    }
  }

  return (
    <div className="modal" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div ref={contentRef} className="modal-content">
        <div className="modal-header">
          <h3>Confirm</h3>
        </div>
        <div>
          <p style={{ margin: 0, color: 'var(--text)' }}>{message}</p>
        </div>
        <div className="modal-actions" style={{ marginTop: '8px' }}>
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn danger" onClick={onConfirm}>OK</button>
        </div>
      </div>
    </div>
  )
}
