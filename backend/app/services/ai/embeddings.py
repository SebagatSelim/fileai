"""Text embeddings for semantic search (FR-06) and similar-document detection (FR-07).

Providers:
- local                 : feature-hashing vectors (no downloads, no API key). Matches shared words and phrases.
- sentence-transformers : true semantic vectors computed locally (pip install sentence-transformers).
- openai                : true semantic vectors from the OpenAI API.
"""
import logging
import math
import zlib
from collections import Counter

from ..text import QUERY_STOPWORDS, tokenize

log = logging.getLogger(__name__)


def _normalise(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [round(v / norm, 6) for v in vector]


class HashingEmbedder:
    """Signed feature hashing of words and word pairs into a fixed-size vector."""

    def __init__(self, dimensions: int = 512):
        self.dimensions = dimensions
        self.name = f"local-hashing-{dimensions}"

    def _vector(self, tokens: list[str]) -> list[float]:
        features = Counter(tokens)
        features.update(f"{a} {b}" for a, b in zip(tokens, tokens[1:]))
        vector = [0.0] * self.dimensions
        for feature, count in features.items():
            h = zlib.crc32(feature.encode("utf-8"))
            index = h % self.dimensions
            sign = 1.0 if (h >> 16) & 1 else -1.0
            weight = (1.0 + math.log(count)) * (0.6 if " " in feature else 1.0)
            vector[index] += sign * weight
        return _normalise(vector)

    def embed(self, text: str) -> list[float]:
        return self._vector(tokenize(text))

    def embed_query(self, text: str) -> list[float]:
        return self._vector(tokenize(text, stopwords=QUERY_STOPWORDS))


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer  # optional dependency

        self.model = SentenceTransformer(model_name)
        self.dimensions = self.model.get_sentence_embedding_dimension()
        self.name = model_name.split("/")[-1]

    def embed(self, text: str) -> list[float]:
        vector = self.model.encode(text[:5000], normalize_embeddings=True)
        return [round(float(v), 6) for v in vector]

    embed_query = embed


class OpenAIEmbedder:
    def __init__(self, api_key: str, model: str):
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key, timeout=30, max_retries=2)
        self.name = model
        self.dimensions = 1536 if "small" in model or "ada" in model else 3072

    def embed(self, text: str) -> list[float]:
        response = self.client.embeddings.create(model=self.name, input=text[:8000] or " ")
        return _normalise(list(response.data[0].embedding))

    embed_query = embed


def build_embedding_text(title: str, summary: str, keywords: list[str], category: str, subject: str,
                         document_type: str, folder_path: str, filename: str, body: str) -> str:
    """Metadata is repeated so it outweighs body text; the body adds detail for matching."""
    keyword_text = " ".join(keywords)
    return "\n".join([
        title, title, keyword_text, keyword_text, category, subject, document_type,
        folder_path.replace("/", " "), filename.rsplit(".", 1)[0].replace("_", " "), summary, body[:4000],
    ])
