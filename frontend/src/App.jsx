import { useEffect, useMemo, useState } from 'react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_BACKEND_API_KEY;

// Authentic Google Keep Pastel Hex Colors
const COLOR_PRESETS = [
  '#ffffff', // Default white
  '#f28b82', // Red
  '#fbbc04', // Orange
  '#fff475', // Yellow
  '#ccff90', // Green
  '#a7ffeb', // Teal
  '#cbf0f8', // Blue
  '#aecbfa', // Dark Blue
  '#d7aefb', // Purple
  '#fdcfe8', // Pink
  '#e6c9a8', // Brown
];

function App() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(localStorage.getItem('notpad_email') || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [notes, setNotes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [homeView, setHomeView] = useState('notes');
  const [search, setSearch] = useState('');
  
  const [composer, setComposer] = useState(createEmptyNote());
  const [editingNoteId, setEditingNoteId] = useState(null);
  
  const [groupDraft, setGroupDraft] = useState({ name: '', description: '' });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);

  const isNotesView = homeView === 'notes';

  useEffect(() => {
    if (!API_KEY) {
      setMessage('Missing VITE_BACKEND_API_KEY in frontend environment.');
      return;
    }
    restoreSession();
  }, []);

  const selectedGroup = groups.find((group) => group.group_id === selectedGroupId);
  const selectedGroupNoteIds = useMemo(
    () => new Set(selectedGroup?.note_ids || []),
    [selectedGroup]
  );

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) =>
      [note.note_title, note.note_body].some((value) =>
        value?.toLowerCase().includes(query)
      )
    );
  }, [notes, search]);

  const displayedNotes = selectedGroupId
    ? filteredNotes.filter((note) => selectedGroupNoteIds.has(note.note_id))
    : filteredNotes;

  const pinnedNotes = displayedNotes.filter((note) => note.is_pinned);
  const unpinnedNotes = displayedNotes.filter((note) => !note.is_pinned);

  // -- API Helpers --

  async function apiFetch(path, options = {}) {
    if (!API_KEY) {
      throw new Error('Missing API key. Set VITE_BACKEND_API_KEY in frontend .env.');
    }

    const headers = {
      'x-api-key': API_KEY,
      ...(options.headers || {}),
    };

    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
      }
      throw new Error(data.detail || data.message || response.statusText || 'Request failed');
    }

    return data;
  }

  function clearSession() {
    localStorage.removeItem('notpad_email');
    setAuthenticated(false);
    setNotes([]);
    setGroups([]);
    setSelectedGroupId(null);
    setEditingNoteId(null);
    setEditingGroupId(null);
  }

  async function restoreSession() {
    try {
      await refreshData();
      setAuthenticated(true);
    } catch {
      clearSession();
    }
  }

  async function refreshData() {
    await Promise.all([loadNotes(), loadGroups()]);
  }

  async function loadNotes() {
    const data = await apiFetch('/notes');
    setNotes(data.notes || []);
    return data.notes || [];
  }

  async function loadGroups() {
    const data = await apiFetch('/groups');
    setGroups(data.groups || []);
    return data.groups || [];
  }

  // -- Handlers --

  const onSubmitAuth = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setMessage('Email and password are required.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const data = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_mail: email, password }),
      });

      if (mode === 'login') {
        localStorage.setItem('notpad_email', email);
        setAuthenticated(true);
        setMessage(data.message || 'Logged in successfully.');
        await refreshData();
      } else {
        setMode('login');
        setMessage(data.message || 'Registration successful. Please login.');
      }
      setPassword('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    setLoading(true);
    setMessage('');

    try {
      await apiFetch('/auth/logout', { method: 'POST' });
      clearSession();
      setMessage('Logged out successfully.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onSaveNote = async () => {
    if (!composer.note_title.trim() && !composer.note_body.trim()) {
      setMessage('Note cannot be completely empty.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const method = editingNoteId ? 'PATCH' : 'POST';
      const url = editingNoteId ? `/notes/${editingNoteId}` : '/notes';
      const data = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composer),
      });

      if (editingNoteId) {
        setNotes((current) => current.map((note) => (note.note_id === editingNoteId ? data.note : note)));
        setMessage('Note updated.');
      } else {
        setNotes((current) => [data.note, ...current]);
        setMessage('Note created.');
      }
      setComposer(createEmptyNote());
      setEditingNoteId(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onEditNote = (note) => {
    setEditingNoteId(note.note_id);
    setComposer({
      note_title: note.note_title,
      note_body: note.note_body,
      bg_color: note.bg_color || '#ffffff',
      is_pinned: note.is_pinned || false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    setLoading(true);
    setMessage('');

    try {
      await apiFetch(`/notes/${noteId}`, { method: 'DELETE' });
      setNotes((current) => current.filter((note) => note.note_id !== noteId));
      setMessage('Note removed.');
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setComposer(createEmptyNote());
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onTogglePin = async (note) => {
    setLoading(true);
    setMessage('');

    try {
      const data = await apiFetch(`/notes/${note.note_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      });
      setNotes((current) => current.map((item) => (item.note_id === note.note_id ? data.note : item)));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onSaveGroup = async () => {
    if (!groupDraft.name.trim()) {
      setMessage('Group name is required.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const method = editingGroupId ? 'PATCH' : 'POST';
      const url = editingGroupId ? `/groups/${editingGroupId}` : '/groups';
      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupDraft.name, description: groupDraft.description }),
      });
      await loadGroups();
      setMessage(editingGroupId ? 'Group updated.' : 'Group created.');
      setGroupDraft({ name: '', description: '' });
      setEditingGroupId(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onEditGroup = (group) => {
    setEditingGroupId(group.group_id);
    setGroupDraft({ name: group.name, description: group.description || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDeleteGroup = async (groupId) => {
    if (!window.confirm('Delete this group?')) return;
    setLoading(true);
    setMessage('');

    try {
      await apiFetch(`/groups/${groupId}`, { method: 'DELETE' });
      await loadGroups();
      setMessage('Group deleted.');
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onAddNoteToGroup = async (groupId, noteId) => {
    if (!groupId) return;
    setLoading(true);
    setMessage('');

    try {
      await apiFetch(`/groups/${groupId}/notes?note_id=${noteId}`, { method: 'POST' });
      await loadGroups();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRemoveNoteFromGroup = async (groupId, noteId) => {
    setLoading(true);
    setMessage('');

    try {
      await apiFetch(`/groups/${groupId}/notes/${noteId}`, { method: 'DELETE' });
      await loadGroups();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadMedia = async (noteId, file, type) => {
    if (!file) return;
    setLoading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await apiFetch(`/notes/${noteId}/${type}`, {
        method: 'POST',
        body: formData,
      });
      if (data.note) {
        setNotes((current) => current.map((note) => (note.note_id === noteId ? data.note : note)));
      }
      setMessage(type === 'images' ? 'Image uploaded.' : 'Voice uploaded.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // -- Views --

  const authScreen = (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-subtitle">Continue to Notpad (Keep Clone)</p>
        
        <div className="toggle-row">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Login
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmitAuth}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          </label>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Working…' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        {message && <div className="message-box">{message}</div>}
      </div>
    </div>
  );

  const homeSidebar = (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <button type="button" className={homeView === 'notes' && !selectedGroupId ? 'active' : ''} onClick={() => { setHomeView('notes'); setSelectedGroupId(null); }}>
          💡 Notes
        </button>
        <button type="button" className={homeView === 'groups' ? 'active' : ''} onClick={() => setHomeView('groups')}>
          🏷️ Edit labels
        </button>
        {groups.map((group) => (
          <button 
            key={group.group_id}
            type="button" 
            className={homeView === 'notes' && selectedGroupId === group.group_id ? 'active' : ''}
            onClick={() => { setSelectedGroupId(group.group_id); setHomeView('notes'); }}
          >
            🏷️ {group.name}
          </button>
        ))}
      </nav>
    </aside>
  );

  const renderNoteCard = (note) => {
    const noteGroups = groups.filter((group) => group.note_ids?.includes(note.note_id));
    const availableGroups = groups.filter((group) => !noteGroups.some((g) => g.group_id === group.group_id));

    return (
      <article className="note-card" key={note.note_id} style={{ backgroundColor: note.bg_color || '#ffffff' }}>
        <div className="note-card-header">
          <strong>{note.note_title}</strong>
          <button type="button" className={`icon-button pin-button ${note.is_pinned ? 'active' : ''}`} onClick={() => onTogglePin(note)} title={note.is_pinned ? "Unpin note" : "Pin note"}>
            {note.is_pinned ? '📌' : '📍'}
          </button>
        </div>

        <p className="note-text">{note.note_body}</p>

        {noteGroups.length > 0 && (
          <div className="group-badges">
            {noteGroups.map((group) => (
              <span key={group.group_id} className="group-pill">
                {group.name}
                <button type="button" className="icon-button" style={{padding: '2px'}} onClick={() => onRemoveNoteFromGroup(group.group_id, note.note_id)}>×</button>
              </span>
            ))}
          </div>
        )}

        <div className="note-actions-row">
          <button type="button" className="icon-button" onClick={() => onEditNote(note)} title="Edit Note">✏️</button>
          
          <label className="file-picker" title="Add Image">
            📷 <input type="file" accept="image/*" onChange={(e) => uploadMedia(note.note_id, e.target.files?.[0], 'images')} />
          </label>
          <label className="file-picker" title="Add Audio">
            🎙️ <input type="file" accept="audio/*" onChange={(e) => uploadMedia(note.note_id, e.target.files?.[0], 'voices')} />
          </label>

          {availableGroups.length > 0 && (
            <select
              className="group-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) { onAddNoteToGroup(e.target.value, note.note_id); e.target.value = ''; }
              }}
            >
              <option value="" disabled>Add label</option>
              {availableGroups.map((group) => (
                <option key={group.group_id} value={group.group_id}>{group.name}</option>
              ))}
            </select>
          )}

          <button type="button" className="icon-button" onClick={() => onDeleteNote(note.note_id)} title="Delete Note">🗑️</button>
        </div>
      </article>
    );
  };

  const notesView = (
    <main className="main-column">
      <section className="composer" style={{ backgroundColor: composer.bg_color }}>
        <div className="composer-row">
          <input
            className="composer-title"
            placeholder="Title"
            value={composer.note_title}
            onChange={(e) => setComposer((prev) => ({ ...prev, note_title: e.target.value }))}
          />
          <button
            type="button"
            className={`pin-button ${composer.is_pinned ? 'active' : ''}`}
            onClick={() => setComposer((prev) => ({ ...prev, is_pinned: !prev.is_pinned }))}
            title={composer.is_pinned ? "Unpin note" : "Pin note"}
          >
            {composer.is_pinned ? '📌' : '📍'}
          </button>
        </div>
        
        <textarea
          className="composer-body"
          placeholder="Take a note..."
          value={composer.note_body}
          onChange={(e) => setComposer((prev) => ({ ...prev, note_body: e.target.value }))}
        />
        
        <div className="composer-footer">
          <div className="palette-row">
            {COLOR_PRESETS.map((color) => (
              <div
                key={color}
                className={`color-swatch ${composer.bg_color === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setComposer((prev) => ({ ...prev, bg_color: color }))}
                title="Change color"
              />
            ))}
          </div>
          <div className="composer-actions">
            {editingNoteId && (
              <button type="button" className="ghost-button" onClick={() => { setEditingNoteId(null); setComposer(createEmptyNote()); }}>
                Close
              </button>
            )}
            <button type="button" className="ghost-button" onClick={onSaveNote}>
              {editingNoteId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </section>

      {message && <div className="message-box" style={{maxWidth: 600, margin: '0 auto 32px'}}>{message}</div>}

      <section className="notes-section">
        {pinnedNotes.length > 0 && (
          <div className="note-group">
            <div className="section-heading">Pinned</div>
            <div className="note-grid">
              {pinnedNotes.map(renderNoteCard)}
            </div>
          </div>
        )}

        <div className="note-group">
          {pinnedNotes.length > 0 && <div className="section-heading">Others</div>}
          <div className="note-grid">
            {unpinnedNotes.length > 0 ? (
              unpinnedNotes.map(renderNoteCard)
            ) : (
              <div className="empty-state">No notes appear here yet.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );

  const groupsView = (
    <main className="main-column">
      <div className="group-panel">
        <h3>{editingGroupId ? 'Edit Label' : 'Create a Label'}</h3>
        <div className="input-group">
          <input
            value={groupDraft.name}
            onChange={(e) => setGroupDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Label name"
          />
          <textarea
            rows={2}
            value={groupDraft.description}
            onChange={(e) => setGroupDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Optional description"
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          {editingGroupId && (
            <button type="button" style={{padding: '8px 16px', color: '#5f6368'}} onClick={() => { setEditingGroupId(null); setGroupDraft({ name: '', description: '' }); }}>
              Cancel
            </button>
          )}
          <button type="button" style={{padding: '8px 16px', background: '#1a73e8', color: 'white', borderRadius: '4px'}} onClick={onSaveGroup}>
            {editingGroupId ? 'Update label' : 'Create label'}
          </button>
        </div>
      </div>

      <div className="group-list">
        {groups.map((group) => (
          <div key={group.group_id} className="group-card">
            <h4>{group.name}</h4>
            <p>{group.description || 'No description'}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" style={{color: '#1a73e8', fontWeight: 500}} onClick={() => onEditGroup(group)}>Edit</button>
              <button type="button" style={{color: '#d93025', fontWeight: 500}} onClick={() => onDeleteGroup(group.group_id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );

  return (
    <>
      {authenticated && (
        <header className="topbar">
          <div className="topbar-brand">
            <span style={{ fontSize: '24px' }}>📝</span>
            <h1>Keep Clone</h1>
          </div>
          
          <div className="search-bar">
            <span style={{ marginRight: '12px', fontSize: '18px', color: '#5f6368' }}>🔍</span>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="top-actions">
            <span className="user-email">{email}</span>
            <button type="button" style={{color: '#5f6368', fontWeight: 500}} onClick={onLogout}>Logout</button>
          </div>
        </header>
      )}

      <div className="app-container">
        {authenticated ? (
          <div className="layout-row">
            {homeSidebar}
            {isNotesView ? notesView : groupsView}
          </div>
        ) : (
          authScreen
        )}
      </div>
    </>
  );
}

function createEmptyNote() {
  return {
    note_title: '',
    note_body: '',
    bg_color: '#ffffff',
    is_pinned: false,
  };
}

export default App;