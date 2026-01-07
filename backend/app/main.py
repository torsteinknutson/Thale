"""
THALE Backend - FastAPI Application Entry Point
Speech-to-Text Transcription Service for Fremtind Forsikring
"""

import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .models import HealthResponse
from .routers import transcription, summarization

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    logger.info("🚀 Starting THALE Backend...")
    logger.info(f"   Environment: {settings.app_env}")
    logger.info(f"   Whisper Model: {settings.whisper_model_id}")
    logger.info(f"   Frontend URL: {settings.frontend_url}")
    
    # TODO: Pre-load Whisper model here for faster first request
    # This is done in lifespan to avoid blocking startup
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down THALE Backend...")


# Create FastAPI app
app = FastAPI(
    title="THALE API",
    description="Speech-to-Text Transcription Service for Fremtind Forsikring",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
allowed_origins = settings.frontend_url.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(transcription.router, prefix="/api/transcription", tags=["transcription"])
app.include_router(summarization.router, prefix="/api/summarization", tags=["summarization"])


@app.get("/", tags=["root"])
async def root():
    """Root endpoint with API info."""
    return {
        "name": "THALE API",
        "description": "Speech-to-Text Transcription Service",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Health check endpoint for monitoring."""
    import torch
    from . import __version__
    
    return HealthResponse(
        status="ok",
        version=__version__,
        gpu_available=torch.cuda.is_available(),
        model_loaded=False,  # TODO: Check if model is loaded
        timestamp=datetime.utcnow(),
    )
