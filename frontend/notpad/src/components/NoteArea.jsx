import { useEffect, useState } from 'react';
import Masonry from 'react-masonry-css';
import api from '../api/axios';
import NoteInput from './NoteInput';
import NoteCard from './NoteCard';

export default function NoteArea() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    api.get('/notes/').then(res => setNotes(res.data.notes));
  }, []);

  const breakpoints = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  };

  return (
    <div className="w-full keep-container mx-auto">
      <NoteInput onNoteAdded={(newNote) => setNotes([newNote, ...notes])} />
      
      <Masonry
        breakpointCols={breakpoints}
        className="flex w-auto -ml-4"
        columnClassName="pl-4 bg-clip-padding"
      >
        {notes.map(note => (
          <div key={note.note_id} className="mb-4">
            <NoteCard note={note} />
          </div>
        ))}
      </Masonry>
    </div>
  );
}