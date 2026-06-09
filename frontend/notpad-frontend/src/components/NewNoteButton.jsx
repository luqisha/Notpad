export default function NewNoteButton({ setIsOpen, setEditing, onClick }) {
  function handleClick(e) {
    if (onClick) return onClick(e)
    if (typeof setIsOpen === 'function') setIsOpen(true)
    if (typeof setEditing === 'function') setEditing(null)
  }

  return (
    <button className="btn primary" onClick={handleClick}>
      New Note
    </button>
  )
}
