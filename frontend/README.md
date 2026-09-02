# Axis Black Frontend

React 18 + TypeScript + Vite frontend dashboard for Axis Black.

## Tech Stack
- React 18 & TypeScript
- Vite
- Chart.js & react-chartjs-2
- Lucide React Icons
- ElevenLabs React SDK

## Local Setup

```bash
cd frontend
npm install
npm run dev
```

The application will run on http://localhost:5173.

## Production Build & Deployment

```bash
cd frontend
npm run build
```

The output files will be generated in the `dist` directory. Deploy `dist/` to any static site host (Vercel, Netlify, Render Static Site).

## Environment Variables

Configure in `.env`:
- `VITE_API_BASE_URL`: Backend API base URL (e.g. `http://localhost:8000/api`)
- `VITE_APP_TITLE`: Application title
