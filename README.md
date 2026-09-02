# Axis Black — Financial Intelligence Platform

Axis Black is a financial and business intelligence platform for real-time financial tracking, autonomous operational advisory, conversational voice interaction, and transactional communications.

## Repository Structure

```
AXIS-BLACK/
├── frontend/     # React 18 + TypeScript + Vite UI dashboard
├── backend/      # FastAPI Python REST API & MongoDB data layer
└── email-api/    # Vercel-ready FastAPI serverless email microservice
```

## Microservice Overview

### 1. Frontend (`/frontend`)
- Tech Stack: React 18, TypeScript, Vite, Chart.js, Lucide Icons, ElevenLabs React SDK.
- Function: Interactive UI dashboard for financial analytics, agent interactions, and voice controls.

### 2. Backend (`/backend`)
- Tech Stack: Python 3.9+, FastAPI, Motor (Async MongoDB), PyJWT, Google GenAI, ElevenLabs.
- Function: Core REST API server handling authentication, user profiles, transaction analytics, inventory records, and AI agent execution.

### 3. Email API (`/email-api`)
- Tech Stack: Python 3.9+, FastAPI, Mangum, Vercel Serverless (`@vercel/python`).
- Function: Serverless microservice dispatching HTML transactional emails via Gmail SMTP SSL (`smtp.gmail.com:465`).

## Environment Configuration

### Backend (`backend/.env`)
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/
DB_NAME=axis_black_db
GEMINI_API_KEY=your_gemini_api_key
PORT=8000
HOST=127.0.0.1

JWT_SECRET_KEY=your_secure_jwt_secret_key
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7

ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,https://axis-black.onrender.com

EMAIL_API_URL=https://your-email-api.vercel.app
EMAIL_API_KEY=your_shared_email_api_bearer_token

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=True
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password
EMAILS_FROM_EMAIL=your_email@gmail.com
EMAILS_FROM_NAME=Axis Black

FRONTEND_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

ELEVENLABS_AGENT_ID=your_elevenlabs_agent_id
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### Email API (`email-api/.env`)
```env
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_gmail_app_password
EMAIL_API_KEY=your_shared_email_api_bearer_token
BACKEND_API_URL=https://axis-black.onrender.com
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_TITLE=Axis Black — Financial Intelligence Platform
```

## Running Locally

### Backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Docs: http://127.0.0.1:8000/docs
- Health Check: http://127.0.0.1:8000/api/health

### Frontend
```bash
cd frontend
npm install
npm run dev
```
- Application URL: http://localhost:5173

### Email API
```bash
cd email-api
python -m venv venv
# Windows: venv\Scripts\activate | Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn api.send_email:app --reload --port 8001
```
- Health Check: http://127.0.0.1:8001/

## Production Deployment

### Email API (Vercel)
1. Deploy `email-api` directory to Vercel (CLI or GitHub integration).
2. Configure environment variables in Vercel settings (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_API_KEY`, `BACKEND_API_URL`).
3. Set deployed Vercel URL as `EMAIL_API_URL` in backend environment variables.

### Backend (Render / VPS)
1. Deploy `backend` directory to hosting provider.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set required environment variables.

### Frontend (Vercel / Netlify / Render)
1. Build command: `npm run build`
2. Deploy output directory `dist/`.
3. Set `VITE_API_BASE_URL` to backend production URL.
