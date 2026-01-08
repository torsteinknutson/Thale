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
        self.profile_name = profile_name
        self.region_name = region_name
        self.client = None
        self._initialized = False
        
        self.model_id = model_id
        self.max_tokens = max_tokens
        self.profile_name = profile_name
        self.region_name = region_name
        self.client = None
        self._initialized = False
        self.session = None
        
        # 1. Try with specific profile
        try:
            self.session = boto3.Session(profile_name=profile_name, region_name=region_name)
            self.client = self.session.client("bedrock-runtime")
            
            if self.check_connection():
                self._initialized = True
                logger.info(f"✅ Bedrock service fully initialized with profile '{profile_name}'")
                return
        except Exception as e:
            logger.debug(f"Could not load profile '{profile_name}': {e}")

        # 2. Fallback: Try default credentials (env vars or default profile)
        try:
            logger.info(f"🔄 Attempting fallback to default AWS credentials/env vars...")
            self.session = boto3.Session(region_name=region_name)
            self.client = self.session.client("bedrock-runtime")
            
            if self.check_connection():
                self._initialized = True
                logger.info(f"✅ Bedrock service initialized using DEFAULT credentials (env vars or default profile)")
            else:
                logger.warning(f"⚠️ Bedrock service: AWS connection check failed for default credentials.")
                self.client = None
                
        except Exception as e:
            logger.warning(f"⚠️ Could not initialize Bedrock session (Fallback failed): {e}")
            logger.warning("   Summarization features will not be available.")

    def check_connection(self) -> bool:
        """
        Ping AWS STS to verify credentials are valid and active.
        """
        try:
            # Use STS to verify credentials (lightweight)
            sts = self.session.client("sts")
            identity = sts.get_caller_identity()
            logger.info(f"🔑 AWS Credentials verified. User: {identity['Arn'].split('/')[-1]}")
            return True
        except Exception as e:
            logger.error(f"❌ AWS Connection Failed: {e}")
            logger.error("   Please run 'aws sso login' if your session has expired.")
            return False
    
    @property
    def is_available(self) -> bool:
        """Check if the Bedrock service is available."""
        return self._initialized and self.client is not None
    
    def summarize(
        self,
        text: str,
        style: str = "meeting_notes",
        max_length: int = 500,
        prompt: Optional[str] = None,
    ) -> str:
        """
        Generate a summary of the provided text.
        
        Args:
            text: The text to summarize
            style: Summary style (meeting_notes, bullet_points, executive_summary)
            max_length: Maximum summary length (approximate)
            prompt: Optional custom prompt template. If provided, overrides style.
                    Should contain placeholder {text} for the input text.
            
        Returns:
            The generated summary
        """
        if not self.is_available:
            return "Feil: AWS Bedrock er ikke konfigurert. Sjekk AWS-legitimasjon."
        
        # Get the appropriate prompt template
        if prompt:
            prompt_template = prompt
        else:
            prompt_template = SUMMARY_PROMPTS.get(style, SUMMARY_PROMPTS["meeting_notes"])
            
        # Ensure the prompt contains the text placeholder
        if "{text}" in prompt_template:
            final_prompt = prompt_template.format(text=text[:15000])  # Limit input size
        else:
            # If the custom prompt doesn't follow our template format, append the text or handle it gracefully
            # For simplicity, we assume the user knows to include {text} or we append it.
            # But the user request implies they edit the prompt which might be just instructions.
            # Let's assume for now we append the text if {text} is missing, 
            # OR we trust the frontend sends a template.
            # Given the requirements: "user can edit them... split box at top... underneath should be response"
            # It's safest to assume the edited text IS the prompt *instruction*, and we should likely append the text?
            # Or the user sees the *whole* prompt including placeholder?
            # Let's support {text} formatting if present, otherwise append.
            final_prompt = f"{prompt_template}\n\nTEKST:\n{text[:15000]}"

        
        try:
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": self.max_tokens,
                "temperature": 0.3,  # Lower temperature for more focused summaries
                "messages": [
                    {
                        "role": "user",
                        "content": final_prompt
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
