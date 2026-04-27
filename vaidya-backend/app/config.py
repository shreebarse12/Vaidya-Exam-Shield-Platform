from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────
    APP_NAME: str = "Vaidya Exam-Shield"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"          # development | staging | production

    # ── Database ─────────────────────────────────────────
    # Example: postgresql+asyncpg://user:pass@localhost:5432/vaidya
    DATABASE_URL: str

    # ── Redis ────────────────────────────────────────────
    # Used for: session cache, timer state, Celery broker, ranking
    REDIS_URL: str = "redis://localhost:6379"

    # ── JWT Auth ─────────────────────────────────────────
    JWT_SECRET_KEY: str                       # Keep this long & random in production
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15     # Short-lived access token
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7        # Long-lived refresh token

    # ── AWS S3 (for question images, proctoring snapshots) ─
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"           # Mumbai — DPDP Act data localisation
    S3_BUCKET_NAME: str = "vaidya-assets"

    # ── Payments ─────────────────────────────────────────
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # ── Email / SMS ───────────────────────────────────────
    AWS_SES_SENDER_EMAIL: str = "noreply@vaidya.in"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # ── Frontend URL (for CORS) ───────────────────────────
    FRONTEND_URL: str = "http://localhost:5173"
    
    
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    class Config:
        env_file = ".env"
        case_sensitive = True
    


# lru_cache means Settings() is only created ONCE and reused everywhere.
# Without this, every request would re-read the .env file — wasteful.
@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Convenience alias — import `settings` directly anywhere in the app
settings = get_settings()
