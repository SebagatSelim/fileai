"""Chooses the AI providers from configuration. Instances are created once per app."""
import logging

from flask import current_app

from .embeddings import HashingEmbedder, OpenAIEmbedder, SentenceTransformerEmbedder
from .local import LocalAnalyzer

log = logging.getLogger(__name__)


def _make_analyzer(config):
    if config["AI_PROVIDER"] == "openai":
        if not config["OPENAI_API_KEY"]:
            log.warning("AI_PROVIDER=openai but OPENAI_API_KEY is empty; using the local analyser.")
            return LocalAnalyzer()
        try:
            from .openai_provider import OpenAIAnalyzer

            return OpenAIAnalyzer(config["OPENAI_API_KEY"], config["OPENAI_MODEL"], config["AI_MAX_INPUT_CHARS"])
        except Exception:
            log.exception("Could not start the OpenAI client; using the local analyser.")
    return LocalAnalyzer()


def _make_embedder(config):
    provider = config["EMBEDDING_PROVIDER"]
    try:
        if provider == "openai" and config["OPENAI_API_KEY"]:
            return OpenAIEmbedder(config["OPENAI_API_KEY"], config["OPENAI_EMBEDDING_MODEL"])
        if provider == "sentence-transformers":
            return SentenceTransformerEmbedder(config["SENTENCE_TRANSFORMER_MODEL"])
    except Exception:
        log.exception("Could not start the %s embedder; using local hashing embeddings.", provider)
    return HashingEmbedder()


def get_analyzer():
    ext = current_app.extensions
    if "analyzer" not in ext:
        ext["analyzer"] = _make_analyzer(current_app.config)
    return ext["analyzer"]


def get_embedder():
    ext = current_app.extensions
    if "embedder" not in ext:
        ext["embedder"] = _make_embedder(current_app.config)
    return ext["embedder"]


def provider_info() -> dict:
    analyzer, embedder = get_analyzer(), get_embedder()
    return {
        "ai_provider": "openai" if analyzer.name.startswith("openai") else "local",
        "ai_model": analyzer.name,
        "embedding_provider": "openai" if isinstance(embedder, OpenAIEmbedder) else
        ("sentence-transformers" if isinstance(embedder, SentenceTransformerEmbedder) else "local"),
        "embedding_model": embedder.name,
    }
