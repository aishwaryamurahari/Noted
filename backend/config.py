import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Notion OAuth Configuration
    NOTION_CLIENT_ID: str = os.getenv("NOTION_CLIENT_ID", "")
    NOTION_CLIENT_SECRET: str = os.getenv("NOTION_CLIENT_SECRET", "")
    NOTION_REDIRECT_URI: str = os.getenv("NOTION_REDIRECT_URI", "https://noted-six.vercel.app/auth/notion/callback")

    # Server Configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this")

    # Database Configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:////tmp/tokens.db")

    class Config:
        env_file = ".env"

# Create settings instance
settings = Settings()