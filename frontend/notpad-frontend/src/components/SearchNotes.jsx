export default function SearchNotes({ value, onChange, placeholder = 'Search...', className = '' }) {
  function handleChange(e) {
    if (typeof onChange === 'function') onChange(e.target.value)
  }

  function handleClear() {
    if (typeof onChange === 'function') onChange('')
  }

  return (
    <div className={['search-container', className].filter(Boolean).join(' ')}>
      <div className="search-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <input
        className="search"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        type="text"
        aria-label="Search notes"
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={handleClear}
          aria-label="Clear search query"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  )
}
