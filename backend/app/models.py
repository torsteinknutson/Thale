"""
Pydantic models for API request/response schemas.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class TranscriptionStatus(str, Enum):
    """Status of a transcription job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptionRequest(BaseModel):
    """Request model for transcription (metadata only, file sent separately)."""
    language: str = Field(default="no", description="Language code for transcription")
    generate_summary: bool = Field(default=False, description="Whether to generate AI summary")


class TranscriptionProgress(BaseModel):
    """Progress update for ongoing transcription."""
    status: TranscriptionStatus
    progress_percent: float = Field(ge=0, le=100)
    current_chunk: int = 0
    total_chunks: int = 0
    message: str = ""
    partial_text: str = ""


class TranscriptionResult(BaseModel):
    """Result of a completed transcription."""
    id: str
    status: TranscriptionStatus
    text: str
    duration_seconds: float
    word_count: int
    processing_time_seconds: float
    created_at: datetime
    

class SummarizationRequest(BaseModel):
    """Request model for text summarization."""
    text: str = Field(..., min_length=10, description="Text to summarize")
    style: str = Field(default="meeting_notes", description="Summary style: meeting_notes, bullet_points, executive_summary")
    max_length: int = Field(default=500, ge=100, le=2000, description="Maximum summary length")
    prompt: Optional[str] = Field(default=None, description="Custom prompt template to use instead of style-based defaults")


class SummarizationResult(BaseModel):
    """Result of text summarization."""
    summary: str
    original_word_count: int
    summary_word_count: int
    style: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    version: str
    gpu_available: bool
    model_loaded: bool
    timestamp: datetime


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
    code: str
