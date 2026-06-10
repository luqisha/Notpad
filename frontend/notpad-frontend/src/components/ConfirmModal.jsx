export default function ConfirmModal({ isOpen, message = 'Are you sure?', onCancel, onConfirm }) {
  if (!isOpen) return null

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Confirm</h3>
        </div>
        <div>
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button className="btn danger" onClick={onConfirm}>OK</button>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
