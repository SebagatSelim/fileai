"""Natural-language search (FR-06) and similar-document detection (FR-07)."""
import numpy as np

from .ai import get_embedder
from .index import cosine_scores, get_index
from .text import QUERY_STOPWORDS, tokenize

SEMANTIC_WEIGHT = 0.6
KEYWORD_WEIGHT = 0.4
MIN_RELEVANCE = 0.12


def keyword_scores(query_terms: list[str], strong: list[set[str]], weak: list[set[str]]) -> np.ndarray:
    """Share of query words found in each document; title/keyword/folder hits count fully, body hits half."""
    if not query_terms:
        return np.zeros(len(strong), dtype=np.float32)
    terms = set(query_terms)
    scores = np.zeros(len(strong), dtype=np.float32)
    for i, (strong_terms, weak_terms) in enumerate(zip(strong, weak)):
        hit = sum(1.0 if t in strong_terms else 0.5 if t in weak_terms else 0.0 for t in terms)
        scores[i] = hit / len(terms)
    return scores


def search(user_id: int, query: str, limit: int = 10) -> list[tuple[int, float]]:
    """Return [(file_id, relevance 0-1)] for the user's stored documents, best first."""
    embedder = get_embedder()
    index = get_index(user_id, embedder.name)
    if not index.file_ids:
        return []
    terms = tokenize(query, stopwords=QUERY_STOPWORDS)
    semantic = np.clip(cosine_scores(index, embedder.embed_query(query)), 0, 1)
    keyword = keyword_scores(terms, index.strong_terms, index.weak_terms)
    relevance = SEMANTIC_WEIGHT * semantic + KEYWORD_WEIGHT * keyword
    # A document must share at least one word with the query, or be clearly similar in meaning.
    relevant = (keyword > 0) | (semantic >= 0.45)
    order = np.argsort(-relevance)
    results = []
    for i in order:
        if not relevant[i] or relevance[i] < MIN_RELEVANCE:
            continue
        results.append((index.file_ids[i], round(float(min(relevance[i], 1.0)), 4)))
        if len(results) >= limit:
            break
    return results


def find_similar(user_id: int, vector: list[float], model_name: str, exclude_file_id: int,
                 threshold: float, limit: int = 5) -> list[tuple[int, float]]:
    """Documents whose embedding is at least `threshold` cosine-similar to `vector`."""
    index = get_index(user_id, model_name, statuses=("AWAITING_REVIEW", "STORED"))
    if not index.file_ids:
        return []
    scores = cosine_scores(index, vector)
    matches = [
        (fid, round(float(score), 4))
        for fid, score in zip(index.file_ids, scores)
        if fid != exclude_file_id and score >= threshold
    ]
    matches.sort(key=lambda item: item[1], reverse=True)
    return matches[:limit]
