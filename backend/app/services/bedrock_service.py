"""
AWS Bedrock Service
Handles LLM interactions for summarization using Claude.
Ported from DOKAI project with modifications for THALE use case.
"""

import json
import logging
from typing import List, Dict, Optional

import boto3

logger = logging.getLogger(__name__)


# Summarization prompts for different styles
SUMMARY_PROMPTS = {
    "meeting_notes": """Du er en ekspert på å lage strukturerte møtereferater. 
Analyser følgende transkripsjon av et møte og lag et profesjonelt møtereferat på norsk.

Strukturer referatet slik:
1. **Hovedtemaer diskutert**
2. **Viktige beslutninger**
3. **Handlingspunkter** (hvem gjør hva, med frister hvis nevnt)
4. **Oppfølgingssaker**

Hold referatet konsist men fullstendig.

TRANSKRIPSJON:
{text}

MØTEREFERAT:""",

    "bullet_points": """Oppsummer følgende tekst som konsise kulepunkter på norsk.
Fokuser på de viktigste poengene og konklusjonene.
Maks 10 kulepunkter.

TEKST:
{text}

OPPSUMMERING:""",

    "executive_summary": """Lag en kort ledersammendrag (executive summary) på norsk av følgende tekst.
Sammendraget skal være 2-3 avsnitt og dekke:
- Hovedbudskapet/konklusjonen
- Viktigste funn eller beslutninger
- Anbefalte neste steg

TEKST:
{text}

LEDERSAMMENDRAG:""",
}


class BedrockService:
    """
    Service for interacting with AWS Bedrock (Claude) for text summarization.
    """
    
    def __init__(
        self,
        profile_name: str = "nice-dev",
        region_name: str = "eu-west-1",
        model_id: str = "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
        max_tokens: int = 1000,
    ):
        self.model_id = model_id
        self.max_tokens = max_tokens
        self.client = None
        self._initialized = False
        
        try:
            session = boto3.Session(profile_name=profile_name, region_name=region_name)
            self.client = session.client("bedrock-runtime")
            self._initialized = True
            logger.info(f"✅ Bedrock service initialized with profile '{profile_name}'")
        except Exception as e:
            logger.warning(f"⚠️ Could not initialize Bedrock: {e}")
            logger.warning("   Summarization features will not be available.")
    
    @property
    def is_available(self) -> bool:
        """Check if the Bedrock service is available."""
        return self._initialized and self.client is not None
    
    def summarize(
        self,
        text: str,
        style: str = "meeting_notes",
        max_length: int = 500,
    ) -> str:
        """
        Generate a summary of the provided text.
        
        Args:
            text: The text to summarize
            style: Summary style (meeting_notes, bullet_points, executive_summary)
            max_length: Maximum summary length (approximate)
            
        Returns:
            The generated summary
        """
        if not self.is_available:
            return "Feil: AWS Bedrock er ikke konfigurert. Sjekk AWS-legitimasjon."
        
        # Get the appropriate prompt template
        prompt_template = SUMMARY_PROMPTS.get(style, SUMMARY_PROMPTS["meeting_notes"])
        prompt = prompt_template.format(text=text[:15000])  # Limit input size
        
        try:
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": self.max_tokens,
                "temperature": 0.3,  # Lower temperature for more focused summaries
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }
            
            response = self.client.invoke_model(
                modelId=self.model_id,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(body)
            )
            
            response_body = json.loads(response["body"].read())
            
            # Extract text content
            if "content" in response_body and isinstance(response_body["content"], list):
                text_parts = []
                for item in response_body["content"]:
                    if item.get("type") == "text" and "text" in item:
                        text_parts.append(item["text"])
                return "\n".join(text_parts)
            
            return "Ingen respons fra AI-modellen."
            
        except Exception as e:
            logger.error(f"Error invoking Bedrock: {e}")
            return f"Feil ved oppsummering: {str(e)}"
    
    def chat(self, messages: List[Dict[str, str]]) -> str:
        """
        Send a chat request to Claude.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            
        Returns:
            The model's response
        """
        if not self.is_available:
            return "Feil: AWS Bedrock er ikke konfigurert."
        
        try:
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": self.max_tokens,
                "temperature": 0.7,
                "messages": messages
            }
            
            response = self.client.invoke_model(
                modelId=self.model_id,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(body)
            )
            
            response_body = json.loads(response["body"].read())
            
            if "content" in response_body and isinstance(response_body["content"], list):
                text_parts = []
                for item in response_body["content"]:
                    if item.get("type") == "text" and "text" in item:
                        text_parts.append(item["text"])
                return "\n".join(text_parts)
            
            return "Ingen respons."
            
        except Exception as e:
            logger.error(f"Error in Bedrock chat: {e}")
            return f"Feil: {str(e)}"


# Singleton instance
_bedrock_service: Optional[BedrockService] = None


def get_bedrock_service() -> BedrockService:
    """Get or create the singleton BedrockService instance."""
    global _bedrock_service
    if _bedrock_service is None:
        from ..config import get_settings
        settings = get_settings()
        _bedrock_service = BedrockService(
            profile_name=settings.aws_profile,
            region_name=settings.aws_region,
            model_id=settings.bedrock_model_id,
            max_tokens=settings.bedrock_max_tokens,
        )
    return _bedrock_service
