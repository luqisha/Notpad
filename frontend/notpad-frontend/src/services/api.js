const API_BASE_URL = 'http://localhost:8000';
const API_KEY = 'pUokR5fyjA866Phf32jq';

export const apiClient = {
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.detail || 'API Error');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  },

  // Auth
  register(email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ user_mail: email, password }),
    });
  },

  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ user_mail: email, password }),
    });
  },

  logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  },

  // Notes
  getNotes(skip = 0, limit = 12, query = '') {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (query?.trim()) {
      params.set('query', query.trim());
    }
    return this.request(`/notes?${params.toString()}`, {
      method: 'GET',
    });
  },

  async createNote(title, body, imageFiles = []) {
    if (imageFiles && imageFiles.length > 0) {
      const formData = new FormData();
      formData.append('note_title', title);
      formData.append('note_body', body);
      formData.append('bg_color', '#FFFFFF');
      formData.append('is_pinned', 'false');

      imageFiles.forEach(imageFile => formData.append('images', imageFile.file));

      const response = await fetch(`${API_BASE_URL}/notes/with-images`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-API-Key': API_KEY,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.detail || 'API Error');
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    }

    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify({
        note_title: title,
        note_body: body,
        bg_color: '#FFFFFF',
        is_pinned: false,
      }),
    });
  },

  updateNote(noteId, updates) {
    const body = {};
    if (updates.note_title) body.note_title = updates.note_title;
    if (updates.note_body) body.note_body = updates.note_body;
    if (updates.bg_color) body.bg_color = updates.bg_color;
    if (typeof updates.is_pinned === 'boolean') body.is_pinned = updates.is_pinned;

    return this.request(`/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteNote(noteId) {
    return this.request(`/notes/${noteId}`, {
      method: 'DELETE',
    });
  },

  // Groups
  getGroups() {
    return this.request('/groups', {
      method: 'GET',
    });
  },

  createGroup(name, description = '') {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  updateGroup(groupId, updates) {
    const body = {};
    if (updates.name) body.name = updates.name;
    if (typeof updates.description === 'string') body.description = updates.description;

    return this.request(`/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteGroup(groupId) {
    return this.request(`/groups/${groupId}`, {
      method: 'DELETE',
    });
  },

  addNoteToGroup(groupId, noteId) {
    return this.request(`/groups/${groupId}/notes?note_id=${noteId}`, {
      method: 'POST',
    });
  },

  removeNoteFromGroup(groupId, noteId) {
    return this.request(`/groups/${groupId}/notes/${noteId}`, {
      method: 'DELETE',
    });
  },

  async uploadFile(noteId, file, fileType) {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {
      'X-API-Key': API_KEY,
    };

    const endpoint = fileType === 'image' ? `/notes/${noteId}/images` : `/notes/${noteId}/voices`;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.detail || 'Upload failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  },

  uploadImage(noteId, file) {
    return this.uploadFile(noteId, file, 'image');
  },

  uploadVoice(noteId, file) {
    return this.uploadFile(noteId, file, 'voice');
  },

  getNoteImages(noteId) {
    return this.request(`/notes/${noteId}/images`, {
      method: 'GET',
    });
  },

  getNoteVoices(noteId) {
    return this.request(`/notes/${noteId}/voices`, {
      method: 'GET',
    });
  },
};
