"""
Application configuration loaded from environment variables.
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings with environment variable loading."""
    
    # Application
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_url: str = "http://localhost:5173"
    
    # AWS
    aws_profile: str = "nice-dev"
    aws_region: str = "eu-west-1"
    
    # Whisper
    whisper_model_id: str = "NbAiLab/nb-whisper-large"
    whisper_language: str = "no"
    whisper_chunk_length_s: int = 30
    
    # Bedrock
    bedrock_model_id: str = "eu.anthropic.claude-sonnet-4-5-20250929-v1:0"
    bedrock_max_tokens: int = 2000
    
    # File Upload
    max_upload_size_mb: int = 500
    allowed_audio_extensions: str = ".m4a,.wav,.mp3,.aac,.flac,.ogg,.webm"
    recordings_dir: str = "./backend/recordings"
    
    @property
    def allowed_extensions_list(self) -> List[str]:
        """Return allowed extensions as a list."""
        return [ext.strip() for ext in self.allowed_audio_extensions.split(",")]
    
    @property
    def max_upload_size_bytes(self) -> int:
        """Return max upload size in bytes."""
        return self.max_upload_size_mb * 1024 * 1024
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
