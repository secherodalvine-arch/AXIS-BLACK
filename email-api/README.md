# Axis Black Email API

FastAPI serverless microservice designed for deployment on Vercel (`@vercel/python`). Dispatches HTML/text emails via Gmail SMTP SSL (`smtp.gmail.com:465`).

## Deployment (Vercel)

### Option 1: Vercel CLI
```bash
cd email-api
npx vercel
```

### Option 2: GitHub Integration
1. Connect repository in Vercel Dashboard.
2. Set Root Directory to `email-api`.
3. Deploy.

## Environment Variables

Configure the following variables in Vercel Project Settings:

| Variable | Description |
| :--- | :--- |
| `GMAIL_USER` | Sender Gmail address |
| `GMAIL_APP_PASSWORD` | 16-character Gmail App Password |
| `EMAIL_API_KEY` | Shared secret token for Bearer authorization |
| `BACKEND_API_URL` | Backend production URL |

## Local Execution

```bash
cd email-api
pip install -r requirements.txt
uvicorn api.send_email:app --reload --port 8001
```

## API Specification

### GET `/`
Health check.
- Response: `{"status": "ok", "service": "axis-black-email-api", "backend_api_url": "..."}`

### POST `/send_email`
Sends an email via Gmail SMTP.
- Headers:
  - `Authorization: Bearer <EMAIL_API_KEY>`
  - `Content-Type: application/json`
- Request Body:
  ```json
  {
    "to_email": "user@example.com",
    "subject": "Email Subject",
    "html": "<p>HTML Body Content</p>",
    "text": "Plain text fallback",
    "reply_to": "support@example.com"
  }
  ```
- Response: `{"sent": true, "provider": "gmail-smtp"}`
