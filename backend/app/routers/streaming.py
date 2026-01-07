"""
Streaming Transcription API endpoints.
Handles real-time audio transcription via WebSockets.
"""

import logging
import os
import tempfile
import asyncio
import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from ..services import get_whisper_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/realtime")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time transcription.
    
    Protocol:
    1. Client connects
    2. Client sends audio chunks (binary, e.g., audio/webm)
    3. Server appends chunks to a buffer
    4. Server periodically transcribes the buffer and sends back text
    5. Server sends JSON: {"text": "...", "is_final": false}
    """
    await websocket.accept()
    logger.info("WebSocket connected")
    
    # Create a temp file to store the audio stream
    # We use a temp file because ffmpeg (via librosa/soundfile) handles file formats better than raw bytes
    fd, temp_path = tempfile.mkstemp(suffix=".webm")
    os.close(fd)
    
    try:
        whisper = get_whisper_service()
        
        # Ensure model is loaded (this might take time on first connection)
        if not whisper.is_loaded:
            await websocket.send_json({"status": "loading_model", "message": "Loading Whisper model..."})
            # Run load in executor to not block
            await asyncio.get_event_loop().run_in_executor(None, whisper.load_model)
            await websocket.send_json({"status": "ready", "message": "Model loaded"})
        
        chunk_count = 0
        TRANSCRIPTION_INTERVAL = 5  # Transcribe every 5 chunks (adjust based on chunk size)
        
        while True:
            # Receive audio chunk
            # We expect binary data (audio blobs)
            data = await websocket.receive_bytes()
            
            # Append to file
            with open(temp_path, "ab") as f:
                f.write(data)
            
            chunk_count += 1
            
            # Periodically transcribe
            if chunk_count % TRANSCRIPTION_INTERVAL == 0:
                # Run transcription in a separate thread to avoid blocking the WebSocket loop
                # We use the existing transcribe_file method but suppress logging to avoid noise
                try:
                    # We need to check if the file has valid audio data
                    # librosa might fail if the chunk is too small or header is incomplete
                    if os.path.getsize(temp_path) > 10 * 1024:  # > 10KB
                        
                        # Use transcribe_file but we need to be careful about concurrency
                        # For this MVP, we re-transcribe the whole growing file
                        # This provides better context correction but gets slower as file grows
                        
                        # Run in executor
                        result = await whisper.transcribe_file(temp_path)
                        
                        if result.text.strip():
                            await websocket.send_json({
                                "type": "transcription",
                                "text": result.text,
                                "is_final": False
                            })
                            
                except Exception as e:
                    # Log error but don't crash the connection
                    # Common errors: "Input file is empty" or "Invalid data found"
                    # logger.warning(f"Streaming transcription error: {e}")
                    pass
                    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.close(code=1011)
        except:
            pass
    finally:
        # Cleanup temp file
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
