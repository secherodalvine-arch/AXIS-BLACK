# Axis Black Email API (Vercel Microservice)

A lightweight FastAPI serverless microservice designed for deployment on [Vercel](https://vercel.com). Outbound Gmail SMTP connections are dispatched directly from Vercel serverless functions, bypassing Render free-tier outbound SMTP port blocks.

---

## 🚀 Deployment Instructions (Vercel)

### Option 1: Deploy via Vercel CLI
1. Open a terminal in the `email-api` directory:
   ```bash
   cd email-api
   ```
2. Deploy directly using Vercel CLI:
   ```bash
   npx vercel
   ```
3. Follow the CLI prompts to connect your Vercel account and set project settings.

---

### Option 2: Deploy via GitHub Integration
1. Push your changes to your GitHub repository.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New Project**.
3. Select your GitHub repository.
4. Set **Root Directory** to `email-api`.
5. Deploy.

---

## ⚙️ Environment Variables

Add the following environment variables in your Vercel Project Settings (**Settings > Environment Variables**):

| Variable | Value / Description |
| :--- | :--- |
| `GMAIL_USER` | `secherodalvine@gmail.com` |
| `GMAIL_APP_PASSWORD` | `xtxydcwqwxhmcmlg` (or your 16-character App Password) |
| `EMAIL_API_KEY` | `axis_black_email_secret_key_2026` (Bearer authentication token) |
| `BACKEND_API_URL` | `https://axis-black.onrender.com` |

---

## 📡 Endpoint API Documentation

### `GET /`
Health check endpoint.
- **Response**: `{"status": "ok", "service": "axis-black-email-api", "backend_api_url": "..."}`

### `POST /send_email`
Sends an email via Gmail SMTP SSL (`smtp.gmail.com:465`).
- **Headers**:
  - `Authorization`: `Bearer <EMAIL_API_KEY>`
  - `Content-Type`: `application/json`
- **Request Body**:
  ```json
  {
    "to_email": "user@example.com",
    "subject": "Verify Your Account",
    "html": "<p>Click here to verify</p>",
    "text": "Click here to verify",
    "reply_to": "support@axisblack.io"
  }
  ```
- **Response**:
  ```json
  {
    "sent": true,
    "provider": "gmail-smtp"
  }
  ```
