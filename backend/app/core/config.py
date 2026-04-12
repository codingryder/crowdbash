from pydantic_settings import BaseSettings
from typing import List
import json

class Settings(BaseSettings):
    DATABASE_URL: str
    UPSTASH_REDIS_URL: str
    UPSTASH_REDIS_TOKEN: str
    # Custom JWT auth (replaces Supabase)
    JWT_SECRET: str = "crowdbash-secret-change-in-production"
    JWT_EXPIRY_HOURS: int = 72
    # Email OTP via Resend
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@crowdbash.codingryder.com"
    # Sport APIs
    CRICKETDATA_API_KEY: str = ""
    FOOTBALL_API_KEY: str = ""  # Football-Data.org X-Auth-Token
    # AI
    GEMINI_API_KEY: str = ""
    # Payments
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    # Admin
    ADMIN_USERNAME: str = "crowdbash_admin"
    ADMIN_PASSWORD: str = "Bash@2025!"
    # App
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = '["http://localhost:5173","http://localhost:5175","https://crowdbash.codingryder.com"]'

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return [self.FRONTEND_URL] if self.FRONTEND_URL else ["*"]
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
