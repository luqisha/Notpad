export default function NoteComposer({ setIsOpen, setEditing }) {
  function handleClick() {
    setIsOpen(true)
    setEditing(null)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      setIsOpen(true)
      setEditing(null)
    }
  }

  return (
    <div
      className="note-composer-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="composer-placeholder">Take a note...</span>
    </div>
  )
}
