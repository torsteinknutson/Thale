"""
Summarization API endpoints.
Handles text summarization using AWS Bedrock (Claude).
"""

import logging
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..config import get_settings
from ..models import SummarizationRequest, SummarizationResult

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# Rate limiter for AI operations
limiter = Limiter(key_func=get_remote_address)


@router.post("/", response_model=SummarizationResult)
@limiter.limit("20/minute")  # Max 20 summaries per minute per user
async def summarize_text(request: Request, req: SummarizationRequest):
    """
    Generate an AI summary of the provided text.
    
    Styles:
    - meeting_notes: Structured meeting notes with action items (Norwegian)
    - bullet_points: Concise bullet point summary (Norwegian)
    - executive_summary: High-level executive summary (Norwegian)
    """
    # Validate input length
    if len(req.text) == 0:
        raise HTTPException(status_code=400, detail="Teksten kan ikke være tom")
    
    if len(req.text) > 1_000_000:  # ~1M chars max
        raise HTTPException(
            status_code=400,
            detail="Teksten er for lang. Maksimal lengde er 1 million tegn."
        )
    
    logger.info(f"📝 Summarization request: {len(req.text)} chars, style={req.style}")
    
    try:
        from ..services import get_bedrock_service
        bedrock = get_bedrock_service()
        
        if not bedrock.is_available:
            raise HTTPException(
                status_code=503,
                detail="Oppsummeringstjenesten er ikke tilgjengelig. Sjekk AWS-konfigurasjon."
            )
        
        # Generate summary
        summary = bedrock.summarize(
            text=req.text,
            style=req.style,
            max_length=req.max_length,
            prompt=req.prompt,
        )
        
        original_word_count = len(req.text.split())
        summary_word_count = len(summary.split())
        
        logger.info(f"   Generated summary: {summary_word_count} words from {original_word_count} words")
        
        return SummarizationResult(
            summary=summary,
            original_word_count=original_word_count,
            summary_word_count=summary_word_count,
            style=req.style,
        )
        
    except ImportError as e:
        logger.warning(f"Bedrock dependencies not available: {e}")
        raise HTTPException(
            status_code=503,
            detail="Oppsummeringstjenesten er ikke tilgjengelig. AWS SDK kan mangle."
        )
    except HTTPException:
        raise
    except ValueError as e:
        # AWS quota exceeded or invalid request
        logger.error(f"Bedrock API error: {e}")
        raise HTTPException(
            status_code=429,
            detail=f"AWS-kvote overskredet eller ugyldig forespørsel. Prøv igjen om noen minutter."
        )
    except Exception as e:
        logger.error(f"Summarization failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Oppsummering feilet: {str(e)}"
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
