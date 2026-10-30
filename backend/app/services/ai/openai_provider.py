"""OpenAI-backed analyser (FR-10). Falls back to the local analyser if the API fails."""
import json
import logging
import re
import time

from ..text import safe_filename_part
from .base import CATEGORIES, AnalysisResult
from .local import LocalAnalyzer

log = logging.getLogger(__name__)

SYSTEM_PROMPT = f"""You organise a person's digital documents. Read the document and reply with ONE JSON object:
{{
  "title": "clear human-readable title",
  "summary": "1-2 sentences, max 300 characters",
  "category": one of {json.dumps(CATEGORIES)},
  "subject": "main topic, e.g. Database Systems or the company name on an invoice",
  "document_type": "e.g. Assignment, Invoice, Resume, Lecture Notes, Contract",
  "keywords": ["3 to 8 short keywords"],
  "suggested_filename": "Words_Joined_By_Underscores without extension, max 80 characters",
  "suggested_folder_path": ["2 to 5 folder names, general to specific"],
  "confidence": number between 0 and 1 for how sure you are about the category
}}
Rules:
- For university work use folders like ["University", "Year 2", "Semester 1", "Database Systems"] when that information is in the text.
- If one of the user's existing folders fits, reuse its exact names instead of inventing new ones.
- Use only information found in the document. Reply with JSON only."""


class OpenAIAnalyzer:
    def __init__(self, api_key: str, model: str, max_chars: int, client=None):
        if client is None:
            from openai import OpenAI

            client = OpenAI(api_key=api_key, timeout=45, max_retries=0)
        self.client = client
        self.model = model
        self.max_chars = max_chars
        self.fallback = LocalAnalyzer()
        self.name = f"openai:{model}"

    def analyze(self, text: str, original_name: str, existing_folders: list[list[str]] | None = None,
                extension: str = "") -> AnalysisResult:
        if sum(ch.isalpha() for ch in text) < 40:
            return self.fallback.analyze(text, original_name, existing_folders, extension)
        folders = ["/".join(p) for p in (existing_folders or [])][:200]
        user_message = (
            f"Original filename: {original_name}\n"
            f"User's existing folders: {json.dumps(folders)}\n\n"
            f"Document text:\n{text[: self.max_chars]}"
        )
        for attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                )
                data = json.loads(response.choices[0].message.content or "{}")
                return self._to_result(data, extension)
            except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
                log.warning("OpenAI returned unusable output (attempt %s): %s", attempt + 1, exc)
            except Exception as exc:  # network, rate limit, auth...
                log.warning("OpenAI request failed (attempt %s): %s", attempt + 1, exc)
                time.sleep(2 ** attempt)
        log.error("Falling back to the local analyser for %s", original_name)
        result = self.fallback.analyze(text, original_name, existing_folders, extension)
        result.model = "local-fallback"
        return result

    def _to_result(self, data: dict, extension: str) -> AnalysisResult:
        def text_field(key: str, limit: int, default: str = "") -> str:
            value = data.get(key, default)
            return str(value).strip()[:limit] if value is not None else default

        title = text_field("title", 255)
        if not title:
            raise ValueError("missing title")
        category = text_field("category", 100, "Other")
        if category not in CATEGORIES:
            category = next((c for c in CATEGORIES if c.lower() == category.lower()), "Other")
        keywords = [str(k).strip()[:100] for k in (data.get("keywords") or []) if str(k).strip()][:8]
        folder = [re.sub(r"[\\/]+", "-", str(p)).strip()[:150] for p in (data.get("suggested_folder_path") or [])]
        folder = [p for p in folder if p][:6] or [category]
        filename = safe_filename_part(text_field("suggested_filename", 120) or title, 80) or "Document"
        try:
            confidence = max(0.0, min(float(data.get("confidence", 0.5)), 1.0))
        except (TypeError, ValueError):
            confidence = 0.5
        return AnalysisResult(
            title=title,
            summary=text_field("summary", 600),
            category=category,
            subject=text_field("subject", 150),
            document_type=text_field("document_type", 100, "Document") or "Document",
            keywords=list(dict.fromkeys(keywords)),
            suggested_filename=filename + extension,
            suggested_folder_path=folder,
            confidence=round(confidence, 4),
            model=self.name,
        )
