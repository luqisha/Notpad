export default function NoteCard({ note }) {
  const body = note.note_body || "";
  const title = note.note_title || "";

  return (
    <div className="rounded p-3 shadow-sm" style={{ backgroundColor: 'var(--note-bg)' }}>
      {title && <h3 className="font-medium mb-1 text-sm">{title}</h3>}
      <div className="whitespace-pre-wrap text-sm text-gray-900">{body}</div>
    </div>
  );
}