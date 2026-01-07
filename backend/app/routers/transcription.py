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
from sse_starlette.sse import EventSourceResponse

from ..config import get_settings
from ..models import (
    TranscriptionResult,
    TranscriptionProgress,
    TranscriptionStatus,
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
    
    Note: First request may take longer as the Whisper model needs to load (~3GB).
    """
    validate_audio_file(file)
    
    transcription_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    logger.info(f"📤 Received file: {file.filename} (ID: {transcription_id})")
    
    # Read file content
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    logger.info(f"   File size: {file_size_mb:.2f} MB")
    
    # Check file size
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB"
        )
    
    try:
        # Get the Whisper service and transcribe
        from ..services import get_whisper_service
        whisper = get_whisper_service()
        
        result = await whisper.transcribe_bytes(content)
        
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return TranscriptionResult(
            id=transcription_id,
            status=TranscriptionStatus.COMPLETED,
            text=result.text,
            duration_seconds=result.duration_seconds,
            word_count=result.word_count,
            processing_time_seconds=processing_time,
            created_at=start_time,
        )
        
    except ImportError as e:
        # ML dependencies not installed
        logger.warning(f"ML dependencies not available: {e}")
        raise HTTPException(
            status_code=503,
            detail="Transcription service not available. ML dependencies may not be installed."
        )
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
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
    start_time = datetime.utcnow()
    
    logger.info(f"📤 Received file for streaming: {file.filename} (ID: {transcription_id})")
    
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    logger.info(f"   File size: {file_size_mb:.2f} MB")
    
    # Check file size
    if len(content) > settings.max_upload_size_bytes:
        async def error_generator():
            yield {
                "event": "error",
                "data": f"File too large. Maximum size: {settings.max_upload_size_mb}MB"
            }
        return EventSourceResponse(error_generator())
    
    progress_updates = []
    
    def on_progress(progress):
        """Callback for progress updates."""
        progress_updates.append(progress)
    
    async def generate_events():
        """Generate SSE events for transcription progress."""
        try:
            from ..services import get_whisper_service
            whisper = get_whisper_service()
            
            # Send initial event
            yield {
                "event": "progress",
                "data": TranscriptionProgress(
                    status=TranscriptionStatus.PROCESSING,
                    progress_percent=0,
                    current_chunk=0,
                    total_chunks=1,
                    message="Loading model and starting transcription..."
                ).model_dump_json()
            }
            
            # Run transcription with progress callback
            result = await whisper.transcribe_bytes(content, progress_callback=on_progress)
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            # Send completion event
            yield {
                "event": "complete",
                "data": TranscriptionResult(
                    id=transcription_id,
                    status=TranscriptionStatus.COMPLETED,
                    text=result.text,
                    duration_seconds=result.duration_seconds,
                    word_count=result.word_count,
                    processing_time_seconds=processing_time,
                    created_at=start_time,
                ).model_dump_json()
            }
            
        except ImportError as e:
            yield {
                "event": "error",
                "data": "Transcription service not available. ML dependencies may not be installed."
            }
        except Exception as e:
            logger.error(f"Streaming transcription failed: {e}")
            yield {
                "event": "error",
                "data": f"Transcription failed: {str(e)}"
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
