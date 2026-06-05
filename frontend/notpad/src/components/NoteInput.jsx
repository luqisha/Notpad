import { useState } from 'react';
import api from '../api/axios';

export default function NoteInput({ onNoteAdded }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleSave = async () => {
    if (!title.trim() && !body.trim()) {
      setIsExpanded(false);
      return;
    }
    
    try {
      const res = await api.post('/notes/', { note_title: title, note_body: body });
      onNoteAdded(res.data.note);
      setTitle('');
      setBody('');
      setIsExpanded(false);
    } catch (err) {
      console.error("Failed to save note", err);
    }
  };

  return (
    <div className="max-w-4xl keep-container mx-auto mb-6">
      <div className="bg-white rounded shadow-sm p-3">
        {isExpanded && (
          <input 
            type="text"
            placeholder="Title"
            className="w-full p-2 mb-1 text-sm font-semibold outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
        <textarea
          placeholder="Take a note..."
          className="w-full p-2 text-sm resize-none outline-none"
          rows={isExpanded ? 3 : 1}
          onClick={() => setIsExpanded(true)}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {isExpanded && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2 text-gray-500 text-sm">
              <button title="Add reminder">Remind me</button>
              <button title="Add collaborator">Collaborator</button>
              <button title="Change color">Color</button>
              <button title="Add image">Image</button>
            </div>
            <div>
              <button onClick={handleSave} className="px-3 py-1 bg-gray-100 rounded text-sm">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}