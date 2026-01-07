"""
Transcription API endpoints.
Handles audio file upload and transcription using Whisper model.
"""

import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from ..config import get_settings
from ..models import (
    TranscriptionResult,
    TranscriptionProgress,
    TranscriptionStatus,
    ErrorResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


def validate_audio_file(file: UploadFile) -> None:
    """Validate uploaded audio file."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed types: {settings.allowed_audio_extensions}"
        )


@router.post("/upload", response_model=TranscriptionResult)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = Form(default="no", description="Language code"),
    generate_summary: bool = Form(default=False, description="Generate AI summary"),
):
    """
    Upload an audio file and get the transcription.
    
    Supports: .m4a, .wav, .mp3, .aac, .flac, .ogg, .webm
    Max file size: 500MB
    """
    validate_audio_file(file)
    
    transcription_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    logger.info(f"📤 Received file: {file.filename} (ID: {transcription_id})")
    
    # TODO: Implement actual transcription
    # For now, return a placeholder response
    
    # Read file content
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    logger.info(f"   File size: {file_size_mb:.2f} MB")
    
    # Placeholder transcription
    transcription_text = f"[Transcription placeholder for {file.filename}]"
    
    processing_time = (datetime.utcnow() - start_time).total_seconds()
    
    return TranscriptionResult(
        id=transcription_id,
        status=TranscriptionStatus.COMPLETED,
        text=transcription_text,
        duration_seconds=0.0,  # TODO: Get actual audio duration
        word_count=len(transcription_text.split()),
        processing_time_seconds=processing_time,
        created_at=start_time,
    )


@router.post("/upload/stream")
async def transcribe_audio_stream(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = Form(default="no", description="Language code"),
):
    """
    Upload an audio file and stream transcription progress via Server-Sent Events.
    
    Returns SSE stream with progress updates and final transcription.
    """
    validate_audio_file(file)
    
    transcription_id = str(uuid.uuid4())
    logger.info(f"📤 Received file for streaming: {file.filename} (ID: {transcription_id})")
    
    content = await file.read()
    
    async def generate_events():
        """Generate SSE events for transcription progress."""
        # Send initial event
        yield {
            "event": "progress",
            "data": TranscriptionProgress(
                status=TranscriptionStatus.PROCESSING,
                progress_percent=0,
                current_chunk=0,
                total_chunks=1,
                message="Starting transcription..."
            ).model_dump_json()
        }
        
        # TODO: Implement chunked transcription with real progress
        
        # Send completion event
        yield {
            "event": "complete", 
            "data": TranscriptionResult(
                id=transcription_id,
                status=TranscriptionStatus.COMPLETED,
                text=f"[Streaming transcription placeholder for {file.filename}]",
                duration_seconds=0.0,
                word_count=5,
                processing_time_seconds=0.1,
                created_at=datetime.utcnow(),
            ).model_dump_json()
        }
    
    return EventSourceResponse(generate_events())


@router.get("/{transcription_id}", response_model=TranscriptionResult)
async def get_transcription(transcription_id: str):
    """
    Get a transcription by ID.
    
    Used for polling status of async transcription jobs.
    """
    # TODO: Implement storage/retrieval of transcriptions
    raise HTTPException(status_code=404, detail="Transcription not found")
