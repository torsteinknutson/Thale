"""
Transcription API endpoints.
Handles audio file upload and transcription using Whisper model.
"""

import logging
import uuid
import asyncio
import os
import magic
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks, Form, Request
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..config import get_settings
from ..models import (
    TranscriptionResult,
    TranscriptionProgress,
    TranscriptionStatus,
)

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# Rate limiter for expensive operations
limiter = Limiter(key_func=get_remote_address)

# Allowed MIME types for audio files
ALLOWED_MIME_TYPES = {
    "audio/mpeg",       # MP3
    "audio/x-m4a",      # M4A
    "audio/mp4",        # M4A/AAC
    "audio/wav",        # WAV
    "audio/x-wav",      # WAV
    "audio/wave",       # WAV
    "audio/aac",        # AAC
    "audio/flac",       # FLAC
    "audio/ogg",        # OGG
    "audio/webm",       # WebM
    "application/octet-stream",  # Sometimes used for audio
}


def validate_audio_file(file: UploadFile, content: bytes) -> None:
    """
    Validate uploaded audio file using both extension and magic bytes.
    
    Args:
        file: The uploaded file
        content: File content bytes for magic byte verification
        
    Raises:
        HTTPException: If file is invalid
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Ingen filnavn oppgitt")
    
    # Check file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=400,
            detail=f"Filtype '{ext}' er ikke støttet. Tillatte typer: {settings.allowed_audio_extensions}"
        )
    
    # Verify file content using magic bytes
    try:
        mime = magic.from_buffer(content[:2048], mime=True)
        if mime not in ALLOWED_MIME_TYPES:
            logger.warning(f"File {file.filename} has unexpected MIME type: {mime}")
            # Don't reject, but log it - some valid audio files may have unusual MIME types
    except Exception as e:
        logger.warning(f"Could not verify MIME type for {file.filename}: {e}")
        # Continue anyway - better to be permissive than break valid uploads


@router.post("/upload", response_model=TranscriptionResult)
@limiter.limit("10/minute")  # Max 10 transcriptions per minute per user
async def transcribe_audio(
    request: Request,
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
    transcription_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    logger.info(f"📤 Received file: {file.filename} (ID: {transcription_id})")
    
    # Read file content
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    logger.info(f"   File size: {file_size_mb:.2f} MB")
    
    # Validate file (extension + magic bytes)
    validate_audio_file(file, content)
    
    # Check file size
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Filen er for stor. Maksimal størrelse: {settings.max_upload_size_mb}MB"
        )
    
    # Ensure file has actual content
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Filen er tom")
    
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
            detail="Transkriberingstjenesten er ikke tilgjengelig. ML-avhengigheter kan mangle."
        )
    except ValueError as e:
        # Invalid audio format or corrupted file
        logger.error(f"Invalid audio file: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Ugyldig lydfil: {str(e)}. Prøv et annet format (MP3, WAV, M4A)."
        )
    except Exception as e:
        logger.error(f"Transcription failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Transkripsjon feilet: {str(e)}"
        )


@router.post("/upload/stream")
@limiter.limit("10/minute")  # Max 10 streaming transcriptions per minute
async def transcribe_audio_stream(
    request: Request,
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = Form(default="no", description="Language code"),
):
    """
    Upload an audio file and stream transcription progress via Server-Sent Events.
    
    Returns SSE stream with progress updates and final transcription.
    """
    transcription_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    logger.info(f"📤 Received file for streaming: {file.filename} (ID: {transcription_id})")
    
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    logger.info(f"   File size: {file_size_mb:.2f} MB")
    
    # Validate file
    try:
        validate_audio_file(file, content)
    except HTTPException as e:
        async def error_generator():
            yield {"event": "error", "data": e.detail}
        return EventSourceResponse(error_generator())
    
    # Check file size
    if len(content) > settings.max_upload_size_bytes:
        async def error_generator():
            yield {
                "event": "error",
                "data": f"Filen er for stor. Maksimal størrelse: {settings.max_upload_size_mb}MB"
            }
        return EventSourceResponse(error_generator())
    
    # Check for empty file
    if len(content) == 0:
        async def error_generator():
            yield {"event": "error", "data": "Filen er tom"}
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
            
            # Create a queue for progress updates
            queue = asyncio.Queue()
            loop = asyncio.get_running_loop()
            
            def on_progress(progress):
                """Callback for progress updates (called from thread)."""
                loop.call_soon_threadsafe(queue.put_nowait, progress)
            
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
            
            # Start transcription as a background task
            task = asyncio.create_task(whisper.transcribe_bytes(content, progress_callback=on_progress))
            
            # Process queue while task is running
            while not task.done():
                try:
                    # Wait for next progress update or timeout to check task status
                    progress_data = await asyncio.wait_for(queue.get(), timeout=0.1)
                    
                    # Convert dataclass to Pydantic model
                    progress_model = TranscriptionProgress(
                        status=TranscriptionStatus.PROCESSING,
                        progress_percent=progress_data.progress_percent,
                        current_chunk=progress_data.current_chunk,
                        total_chunks=progress_data.total_chunks,
                        message=progress_data.message,
                        partial_text=progress_data.partial_text
                    )
                    
                    yield {
                        "event": "progress",
                        "data": progress_model.model_dump_json()
                    }
                except asyncio.TimeoutError:
                    continue
            
            # Drain any remaining items in queue
            while not queue.empty():
                progress_data = queue.get_nowait()
                
                progress_model = TranscriptionProgress(
                    status=TranscriptionStatus.PROCESSING,
                    progress_percent=progress_data.progress_percent,
                    current_chunk=progress_data.current_chunk,
                    total_chunks=progress_data.total_chunks,
                    message=progress_data.message,
                    partial_text=progress_data.partial_text
                )
                
                yield {
                    "event": "progress",
                    "data": progress_model.model_dump_json()
                }

            # Get the result (this will raise if task failed)
            result = await task
            
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


# ==================== Recording Persistence Endpoints ====================

@router.post("/recording/save")
async def save_recording(
    file: UploadFile = File(...),
    duration_seconds: int = Form(default=0, description="Recording duration in seconds")
):
    """
    Save an audio recording to persistent storage.
    
    Returns the recording ID for future retrieval.
    Used to prevent loss of recordings on browser refresh.
    """
    try:
        # Generate unique ID for this recording
        recording_id = str(uuid.uuid4())
        
        # Ensure recordings directory exists
        recordings_path = Path(settings.recordings_dir)
        recordings_path.mkdir(parents=True, exist_ok=True)
        
        # Determine file extension from content type or default to .webm
        ext = ".webm"
        if file.filename:
            file_ext = Path(file.filename).suffix.lower()
            if file_ext in settings.allowed_extensions_list:
                ext = file_ext
        
        # Create timestamp and format duration (using local time)
        timestamp = datetime.now().strftime("%d-%m-%y__%H-%M-%S")
        hours = duration_seconds // 3600
        minutes = (duration_seconds % 3600) // 60
        seconds = duration_seconds % 60
        duration_str = f"{hours:02d}-{minutes:02d}-{seconds:02d}"
        
        # Create intuitive filename: thale_DD-MM-YY__HH-MM-SS____HH-MM-SS__shortuuid.webm
        # UUID ensures uniqueness even if recording twice in same second with same duration
        filename = f"thale_{timestamp}____{duration_str}__{recording_id[:8]}{ext}"
        file_path = recordings_path / filename
        
        # Save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        file_size_mb = len(content) / (1024 * 1024)
        logger.info(f"💾 Saved recording: {filename} ({file_size_mb:.2f} MB)")
        
        return {
            "recording_id": recording_id,
            "filename": filename,
            "size_mb": round(file_size_mb, 2)
        }
        
    except Exception as e:
        logger.error(f"Failed to save recording: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save recording: {str(e)}"
        )


@router.get("/recording/{recording_id}")
async def get_recording(recording_id: str):
    """
    Retrieve a saved audio recording by ID.
    
    Returns the audio file for playback or transcription.
    """
    try:
        recordings_path = Path(settings.recordings_dir)
        
        # Search for file containing the recording ID (handles both old UUID-only and new timestamped formats)
        for file_path in recordings_path.glob(f"*{recording_id[:8]}*"):
            if file_path.is_file():
                logger.info(f"📁 Retrieved recording: {file_path.name}")
                return FileResponse(
                    path=str(file_path),
                    media_type="audio/webm",
                    filename=file_path.name
                )
        
        # Fallback: try old format with full UUID
        for ext in settings.allowed_extensions_list:
            file_path = recordings_path / f"{recording_id}{ext}"
            if file_path.exists():
                logger.info(f"📁 Retrieved recording: {recording_id}{ext}")
                return FileResponse(
                    path=str(file_path),
                    media_type="audio/webm",
                    filename=f"recording{ext}"
                )
        
        raise HTTPException(status_code=404, detail="Recording not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve recording: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve recording: {str(e)}"
        )


@router.delete("/recording/{recording_id}")
async def delete_recording(recording_id: str):
    """
    Delete a saved audio recording by ID.
    
    Permanently removes the recording file from storage.
    """
    try:
        recordings_path = Path(settings.recordings_dir)
        deleted = False
        
        # Search for file containing the recording ID (handles both old and new formats)
        for file_path in recordings_path.glob(f"*{recording_id[:8]}*"):
            if file_path.is_file():
                os.remove(file_path)
                deleted = True
                logger.info(f"🗑️  Deleted recording: {file_path.name}")
                break
        
        # Fallback: try old format with full UUID
        if not deleted:
            for ext in settings.allowed_extensions_list:
                file_path = recordings_path / f"{recording_id}{ext}"
                if file_path.exists():
                    os.remove(file_path)
                    deleted = True
                    logger.info(f"🗑️  Deleted recording: {recording_id}{ext}")
                    break
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        return {"message": "Recording deleted successfully", "recording_id": recording_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete recording: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete recording: {str(e)}"
        )
