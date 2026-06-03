# Notpad Frontend

This is the React frontend for the Notpad project, bootstrapped with Vite.

## Requirements

- Node.js 18+ or compatible
- npm

## Setup

From the `frontend/` folder:

```bash
npm install
```

## Development

Start the Vite development server:

```bash
npm run dev
```

Then open the local URL shown in the terminal, typically `http://localhost:5173`.

## Build

Create a production build:

```bash
npm run build
```

## Preview

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

- `src/main.jsx` - React application entry point
- `src/App.jsx` - Main app component
- `src/index.css` - Global styles
- `vite.config.js` - Vite configuration
- `package.json` - Dependencies and scripts

## Notes

The frontend is currently a minimal scaffold. It now sends the backend API key from `VITE_BACKEND_API_KEY` in `frontend/.env` as the `x-api-key` header for auth requests.

If your backend uses an API key, ensure the server is configured with the same value in its `API_KEY` environment variable.

Update `src/App.jsx` to begin adding your app UI and connect to other backend APIs as needed.
