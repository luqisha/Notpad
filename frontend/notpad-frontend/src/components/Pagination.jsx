export default function Pagination({ pagination, onPageChange, inline = false }) {
  if (!pagination || pagination.total_pages <= 1) {
    return null
  }

  const { page, total_pages, has_prev, has_next } = pagination

  const goToPage = (value) => {
    const pageNum = Number(value)
    if (!Number.isInteger(pageNum)) {
      return false
    }
    if (pageNum < 1 || pageNum > total_pages) {
      return false
    }
    if (pageNum !== page) {
      onPageChange(pageNum)
    }
    return true
  }

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      const valid = goToPage(event.currentTarget.value)
      if (!valid) {
        event.currentTarget.value = page.toString()
      }
      event.currentTarget.blur()
    }
  }

  const handleInputBlur = (event) => {
    if (event.currentTarget.value !== page.toString()) {
      const valid = goToPage(event.currentTarget.value)
      if (!valid) {
        event.currentTarget.value = page.toString()
      }
    }
  }

  return (
    <div className={`pagination ${inline ? 'pagination-inline' : 'pagination-fixed'}`}>
      <button
        className="pagination-btn"
        onClick={() => onPageChange(page - 1)}
        disabled={!has_prev}
      >
        ← Previous
      </button>

      <div className="pagination-current">
        <input
          className="pagination-input"
          type="number"
          min="1"
          max={total_pages}
          key={page}
          defaultValue={page}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          aria-label="Enter page number"
        />
        <span className="pagination-total">/ {total_pages}</span>
      </div>

      <button
        className="pagination-btn"
        onClick={() => onPageChange(page + 1)}
        disabled={!has_next}
      >
        Next →
      </button>
    </div>
  )
}
