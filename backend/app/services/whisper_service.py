"""
Whisper Transcription Service
Handles audio transcription using NB-Whisper (Norwegian Whisper model)
Ported from NBWhisper project with modifications for async API usage.
"""

import os
import warnings
import logging
import asyncio
from pathlib import Path
from datetime import timedelta
from typing import Optional, Callable, AsyncGenerator
from dataclasses import dataclass

# Suppress verbose warnings from transformers
warnings.filterwarnings("ignore")
os.environ['TRANSFORMERS_NO_ADVISORY_WARNINGS'] = '1'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class TranscriptionProgress:
    """Progress update for ongoing transcription."""
    current_chunk: int
    total_chunks: int
    progress_percent: float
    message: str
    partial_text: str = ""


@dataclass
class TranscriptionResult:
    """Result of a completed transcription."""
    text: str
    duration_seconds: float
    word_count: int
    chunks_processed: int


class WhisperService:
    """
    Service for transcribing audio using NB-Whisper (Norwegian Whisper model).
    Handles long audio files by processing in chunks.
    """
    
    def __init__(
        self,
        model_id: str = "NbAiLab/nb-whisper-large",
        language: str = "no",
        chunk_length_s: int = 30,
    ):
        self.model_id = model_id
        self.language = language
        self.chunk_length_s = chunk_length_s
        self.sample_rate = 16000
        
        self._model = None
        self._processor = None
        self._device = None
        self._is_loaded = False
    
    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded."""
        return self._is_loaded
    
    @property
    def device_name(self) -> str:
        """Get the device name being used."""
        if self._device is None:
            return "not loaded"
        return str(self._device)
    
    def load_model(self) -> None:
        """
        Load the Whisper model and processor.
        This is a heavy operation (~3GB download on first run).
        Call this during app startup or lazily on first transcription.
        """
        if self._is_loaded:
            logger.info("Model already loaded")
            return
        
        import torch
        from transformers import WhisperProcessor, WhisperForConditionalGeneration
        import transformers.utils.logging as transformers_logging
        transformers_logging.set_verbosity_error()
        
        logger.info(f"🔊 Loading Whisper model: {self.model_id}")
        
        # Setup device (GPU if available, otherwise CPU)
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"🖥️  Using device: {self._device}")
        
        if torch.cuda.is_available():
            logger.info(f"   GPU: {torch.cuda.get_device_name(0)}")
        
        # Load model and processor
        self._processor = WhisperProcessor.from_pretrained(self.model_id)
        self._model = WhisperForConditionalGeneration.from_pretrained(self.model_id).to(self._device)
        
        self._is_loaded = True
        logger.info("✅ Whisper model loaded successfully")
    
    def unload_model(self) -> None:
        """Unload the model to free memory."""
        if self._model is not None:
            del self._model
            self._model = None
        if self._processor is not None:
            del self._processor
            self._processor = None
        self._is_loaded = False
        
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("Model unloaded")
    
    def _format_time(self, seconds: float) -> str:
        """Format seconds as HH:MM:SS."""
        return str(timedelta(seconds=int(seconds)))
    
    async def transcribe_file(
        self,
        file_path: str,
        progress_callback: Optional[Callable[[TranscriptionProgress], None]] = None,
    ) -> TranscriptionResult:
        """
        Transcribe an audio file.
        
        Args:
            file_path: Path to the audio file
            progress_callback: Optional callback for progress updates
            
        Returns:
            TranscriptionResult with the full transcription
        """
        import torch
        import librosa
        
        # Ensure model is loaded
        if not self._is_loaded:
            self.load_model()
        
        audio_path = Path(file_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")
        
        logger.info(f"📁 Transcribing: {audio_path}")
        
        # Load audio
        waveform_np, sr = librosa.load(str(audio_path), sr=self.sample_rate, mono=True)
        duration = len(waveform_np) / sr
        
        logger.info(f"   Duration: {self._format_time(duration)} ({duration:.1f}s)")
        
        # Process chunks
        result = await self._transcribe_waveform(
            waveform_np, 
            duration,
            progress_callback
        )
        
        return result
    
    async def transcribe_bytes(
        self,
        audio_bytes: bytes,
        progress_callback: Optional[Callable[[TranscriptionProgress], None]] = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio from bytes (e.g., uploaded file).
        
        Args:
            audio_bytes: Raw audio file bytes
            progress_callback: Optional callback for progress updates
            
        Returns:
            TranscriptionResult with the full transcription
        """
        import librosa
        import soundfile as sf
        import io
        
        # Ensure model is loaded
        if not self._is_loaded:
            self.load_model()
        
        # Load audio from bytes
        # First try soundfile (faster), fall back to librosa
        try:
            audio_file = io.BytesIO(audio_bytes)
            waveform_np, sr = sf.read(audio_file)
            
            # Convert to mono if stereo
            if len(waveform_np.shape) > 1:
                waveform_np = np.mean(waveform_np, axis=1)
            
            # Resample if needed
            if sr != self.sample_rate:
                waveform_np = librosa.resample(waveform_np, orig_sr=sr, target_sr=self.sample_rate)
                
        except Exception:
            # Fall back to librosa (handles more formats but slower)
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.audio', delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            
            try:
                waveform_np, sr = librosa.load(tmp_path, sr=self.sample_rate, mono=True)
            finally:
                os.unlink(tmp_path)
        
        duration = len(waveform_np) / self.sample_rate
        logger.info(f"📁 Transcribing audio: {duration:.1f}s")
        
        result = await self._transcribe_waveform(
            waveform_np,
            duration,
            progress_callback
        )
        
        return result
    
    async def _transcribe_waveform(
        self,
        waveform_np: np.ndarray,
        duration: float,
        progress_callback: Optional[Callable[[TranscriptionProgress], None]] = None,
    ) -> TranscriptionResult:
        """
        Internal method to transcribe a numpy waveform array.
        """
        import torch
        
        # Calculate chunks
        chunk_samples = self.chunk_length_s * self.sample_rate
        num_chunks = int(np.ceil(len(waveform_np) / chunk_samples))
        
        logger.info(f"   Processing in {num_chunks} chunks of {self.chunk_length_s}s each")
        
        all_transcriptions = []
        
        for i in range(num_chunks):
            # Extract chunk
            start_sample = i * chunk_samples
            end_sample = min((i + 1) * chunk_samples, len(waveform_np))
            chunk = waveform_np[start_sample:end_sample]
            
            # Progress update
            progress = (i + 1) / num_chunks * 100
            start_time = start_sample / self.sample_rate
            end_time = end_sample / self.sample_rate
            
            if progress_callback:
                progress_callback(TranscriptionProgress(
                    current_chunk=i + 1,
                    total_chunks=num_chunks,
                    progress_percent=progress,
                    message=f"Processing {self._format_time(start_time)} - {self._format_time(end_time)}",
                    partial_text=" ".join(all_transcriptions),
                ))
            
            # Log progress to terminal every 10 chunks or 10%
            if (i + 1) % 10 == 0 or (i + 1) == num_chunks:
                logger.info(f"   ⏳ Progress: {i + 1}/{num_chunks} chunks ({progress:.1f}%)")
            
            # Transcribe chunk (run in thread pool to not block async)
            transcription = await asyncio.get_event_loop().run_in_executor(
                None,
                self._transcribe_chunk,
                chunk
            )
            
            if transcription.strip():
                all_transcriptions.append(transcription.strip())
        
        # Combine all transcriptions
        full_text = " ".join(all_transcriptions)
        word_count = len(full_text.split())
        
        logger.info(f"✅ Transcription complete: {word_count} words")
        
        return TranscriptionResult(
            text=full_text,
            duration_seconds=duration,
            word_count=word_count,
            chunks_processed=num_chunks,
        )
    
    def _transcribe_chunk(self, chunk: np.ndarray) -> str:
        """
        Transcribe a single audio chunk (synchronous, called in executor).
        """
        import torch
        
        # Convert to tensor
        chunk_tensor = torch.tensor(chunk, dtype=torch.float32).unsqueeze(0).to(self._device)
        
        # Preprocess
        inputs = self._processor(
            chunk_tensor.squeeze().cpu().numpy(),
            sampling_rate=self.sample_rate,
            return_tensors="pt"
        )
        inputs = {k: v.to(self._device) for k, v in inputs.items()}
        
        # Generate transcription
        with torch.no_grad():
            predicted_ids = self._model.generate(
                inputs["input_features"],
                language=self.language,
                task="transcribe"
            )
        
        # Decode
        transcription = self._processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
        
        return transcription


# Singleton instance for the app
_whisper_service: Optional[WhisperService] = None


def get_whisper_service() -> WhisperService:
    """Get or create the singleton WhisperService instance."""
    global _whisper_service
    if _whisper_service is None:
        from ..config import get_settings
        settings = get_settings()
        _whisper_service = WhisperService(
            model_id=settings.whisper_model_id,
            language=settings.whisper_language,
            chunk_length_s=settings.whisper_chunk_length_s,
        )
    return _whisper_service
