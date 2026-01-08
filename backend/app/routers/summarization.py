"""
Summarization API endpoints.
Handles text summarization using AWS Bedrock (Claude).
"""

import logging
from fastapi import APIRouter, HTTPException

from ..config import get_settings
from ..models import SummarizationRequest, SummarizationResult

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.post("/", response_model=SummarizationResult)
async def summarize_text(request: SummarizationRequest):
    """
    Generate an AI summary of the provided text.
    
    Styles:
    - meeting_notes: Structured meeting notes with action items (Norwegian)
    - bullet_points: Concise bullet point summary (Norwegian)
    - executive_summary: High-level executive summary (Norwegian)
    """
    logger.info(f"📝 Summarization request: {len(request.text)} chars, style={request.style}")
    
    try:
        from ..services import get_bedrock_service
        bedrock = get_bedrock_service()
        
        if not bedrock.is_available:
            raise HTTPException(
                status_code=503,
                detail="Summarization service not available. Check AWS configuration."
            )
        
        # Generate summary
        summary = bedrock.summarize(
            text=request.text,
            style=request.style,
            max_length=request.max_length,
            prompt=request.prompt,
        )
        
        original_word_count = len(request.text.split())
        summary_word_count = len(summary.split())
        
        logger.info(f"   Generated summary: {summary_word_count} words from {original_word_count} words")
        
        return SummarizationResult(
            summary=summary,
            original_word_count=original_word_count,
            summary_word_count=summary_word_count,
            style=request.style,
        )
        
    except ImportError as e:
        logger.warning(f"Bedrock dependencies not available: {e}")
        raise HTTPException(
            status_code=503,
            detail="Summarization service not available. Check dependencies."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Summarization failed: {str(e)}"
        )


@router.get("/status")
async def summarization_status():
    """Check if the summarization service is available."""
    try:
        from ..services import get_bedrock_service
        bedrock = get_bedrock_service()
        
        return {
            "available": bedrock.is_available,
            "model": settings.bedrock_model_id if bedrock.is_available else None,
        }
    except Exception as e:
        return {
            "available": False,
            "error": str(e),
        }
