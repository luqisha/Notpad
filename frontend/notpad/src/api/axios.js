import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000', // Change to your FastAPI port
  withCredentials: true, // CRUCIAL: Allows session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// If a Vite env var `VITE_API_KEY` is provided, include it in requests
if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
  api.defaults.headers['x-api-key'] = import.meta.env.VITE_API_KEY;
}

export default api;