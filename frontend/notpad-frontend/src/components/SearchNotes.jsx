export default function SearchNotes({ value, onChange, placeholder = 'Search notes...', className = '' }) {
  function handleChange(e) {
    if (typeof onChange === 'function') onChange(e.target.value)
  }

  return (
    <input
      className={["search", className].filter(Boolean).join(' ')}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  )
}
