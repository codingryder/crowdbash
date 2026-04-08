from pydantic_settings import BaseSettings
from typing import List
import json

class Settings(BaseSettings):
    DATABASE_URL: str
    UPSTASH_REDIS_URL: str
    UPSTASH_REDIS_TOKEN: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_JWT_SECRET: str
    CRICKETDATA_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = '["http://localhost:5173"]'

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return [self.FRONTEND_URL] if self.FRONTEND_URL else ["*"]
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            # Handle comma-separated string or single URL
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
