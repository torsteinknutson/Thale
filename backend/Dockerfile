# THALE Backend Dockerfile
# GPU-enabled container for Whisper transcription

# Use NVIDIA CUDA base image for GPU support
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    libsndfile1 \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python

# Create app user for security
RUN useradd --create-home --shell /bin/bash appuser

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the Whisper model to avoid download on first request
# This adds ~3GB to the image but improves cold start time significantly
# Set timeouts and retry logic for model download
RUN mkdir -p /app/.cache/huggingface && \
    python -c "\
import os; \
os.environ[''HF_HUB_DOWNLOAD_TIMEOUT''] = ''300''; \
from transformers import WhisperProcessor, WhisperForConditionalGeneration; \
print(''Downloading NB-Whisper model...''); \
WhisperProcessor.from_pretrained(''NbAiLab/nb-whisper-large''); \
WhisperForConditionalGeneration.from_pretrained(''NbAiLab/nb-whisper-large''); \
print(''Model downloaded successfully'')" || echo "Model download skipped - will download at runtime"

# Copy application code
COPY ./app /app/app

# Change ownership to appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
