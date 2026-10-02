import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "Axis Black"
    VERSION: str = "1.0.0"
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("DB_NAME", "axis_black_db")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # JWT Auth
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_DAYS: int = int(os.getenv("JWT_EXPIRE_DAYS", "7"))

    # CORS / Allowed Origins
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,https://axis-black.onrender.com")

    # Vercel Email API Configuration
    EMAIL_API_URL: str = os.getenv("EMAIL_API_URL", "http://127.0.0.1:8000")
    EMAIL_API_KEY: str = os.getenv("EMAIL_API_KEY", "axis_black_email_secret_key_2026")

    # Email / SMTP Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "True").lower() in ("true", "1", "yes")
    EMAILS_FROM_EMAIL: str = os.getenv("EMAILS_FROM_EMAIL", "noreply@axisblack.io")
    EMAILS_FROM_NAME: str = os.getenv("EMAILS_FROM_NAME", "Axis Black")
    SUPPORT_EMAIL: str = os.getenv("SUPPORT_EMAIL", "secherodalvine@gmail.com")

    # Frontend URL (used in email links)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Cloudinary Storage
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    # ElevenLabs Conversational AI Voice Support Agent
    ELEVENLABS_AGENT_ID: str = os.getenv("ELEVENLABS_AGENT_ID", "")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")

    # TalkSasa SMS Notifications (referenced from HOUSEKONECT)
    TALKSASA_API_KEY: str = os.getenv("TALKSASA_API_KEY", "")
    TALKSASA_SENDER_ID: str = os.getenv("TALKSASA_SENDER_ID", "TALKSASA")
    TALKSASA_API_URL: str = os.getenv("TALKSASA_API_URL", "https://bulksms.talksasa.com/api/v3/sms/send")

    # Admin Platform Configuration
    ADMIN_DEFAULT_EMAIL: str = os.getenv("ADMIN_DEFAULT_EMAIL", "")
    ADMIN_DEFAULT_PASSWORD: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "")
    ADMIN_DEFAULT_NAME: str = os.getenv("ADMIN_DEFAULT_NAME", "Axis Administrator")
    ADMIN_INVITE_CODE: str = os.getenv("ADMIN_INVITE_CODE", "")
    ADMIN_JWT_SECRET: str = os.getenv("ADMIN_JWT_SECRET", "axis-black-super-secure-admin-secret-2026")
    ADMIN_JWT_EXPIRE_HOURS: int = int(os.getenv("ADMIN_JWT_EXPIRE_HOURS", "72"))

    # Paystack & M-Pesa Payment Engine (referenced from REINO FORMS)
    PAYSTACK_SECRET_KEY: str = os.getenv("PAYSTACK_SECRET_KEY", "")
    PAYSTACK_BASE_URL: str = os.getenv("PAYSTACK_BASE_URL", "https://api.paystack.co")
    MPESA_TILL_NUMBER: str = os.getenv("MPESA_TILL_NUMBER", "3645270")
    MPESA_BUSINESS_NAME: str = os.getenv("MPESA_BUSINESS_NAME", "IAN WABWIRE")

settings = Settings()

