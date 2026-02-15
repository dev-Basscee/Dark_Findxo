import os
import logging
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Findxo API"
    DEBUG: bool = False
    API_V1_STR: str = "/v1"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    DATABASE_URL: str

    # Scraper Settings
    TOR_PROXY_URL: str = "socks5://127.0.0.1:9050"
    TOR_CONTROL_PORT: int = 9051
    TOR_CONTROL_PASS: str
    PLAYWRIGHT_HEADLESS: bool = True
    SCRAPER_TIMEOUT: int = 30000  # ms
    MAX_RETRIES: int = 3
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore" 
    }

@lru_cache()
def get_settings():
    return Settings()
