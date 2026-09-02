# Axis Black Backend API

Python FastAPI REST backend providing user management, authentication, AI agent execution, inventory analytics, transaction processing, and voice assistant integration for Axis Black.

## Tech Stack
- Python 3.9+
- FastAPI & Uvicorn
- MongoDB (Motor Async Driver)
- PyJWT & Passlib
- Google GenAI (Gemini)
- ElevenLabs API

## Local Setup

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Interactive API Documentation: http://127.0.0.1:8000/docs
- Health Check: http://127.0.0.1:8000/api/health

## Environment Variables

Copy `.env.example` to `.env` and populate required fields:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET_KEY`: Secret key for JWT token signing
- `ALLOWED_ORIGINS`: Comma-separated list of CORS origins
- `EMAIL_API_URL`: Vercel Email API base URL
- `EMAIL_API_KEY`: Bearer token for Vercel Email API authorization

## Production Deployment (Render)

1. Create a Web Service on Render pointing to the `backend` directory.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
