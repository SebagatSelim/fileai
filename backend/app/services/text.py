"""Small, dependency-free text helpers: tokenising, keywords and extractive summaries."""
import re
from collections import Counter

STOPWORDS = frozenset("""
a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each either etc few for from further had has
have having he her here hers herself him himself his how however i if in into is it its itself just let
may me might more most must my myself no nor not now of off on once only or other ought our ours
ourselves out over own per same shall she should so some such than that the their theirs them
themselves then there these they this those through thus to too under until up upon us very via was we
were what when where which while who whom why will with within without would yes yet you your yours
yourself yourselves one two three four five six seven eight nine ten page pages
""".split())

# Extra words that carry no meaning in a search query ("find my ... please").
QUERY_STOPWORDS = STOPWORDS | frozenset(
    "find show get give search look looking locate open need want where file files document documents doc docs "
    "please related regarding something thing things".split()
)

# Words that are rarely useful as document keywords.
KEYWORD_STOPWORDS = STOPWORDS | frozenset(
    "january february march april may june july august september october november december "
    "monday tuesday wednesday thursday friday saturday sunday jan feb mar apr jun jul aug sep sept oct nov dec "
    "due date example include includes included using used use make made new next please thank "
    "number name day week month year today available request final first last also well".split()
)

NUMBER_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
    "first": "1", "second": "2", "third": "3", "fourth": "4",
}

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:[.'\-+][A-Za-z0-9]+)*")
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")


def clean_text(text: str) -> str:
    """Normalise whitespace and drop control characters."""
    text = text.replace("\x00", " ")
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def stem(word: str) -> str:
    """Very light stemming: plural forms only, so 'assignments' matches 'assignment'."""
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 4 and word.endswith("es") and word[-3] in "sxz":
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def tokenize(text: str, stopwords=STOPWORDS, keep_numbers: bool = True) -> list[str]:
    tokens = []
    for raw in _TOKEN_RE.findall(text.lower()):
        word = raw.strip(".'-+")
        word = NUMBER_WORDS.get(word, word)
        if not word or word in stopwords:
            continue
        if word.isdigit() and not keep_numbers:
            continue
        if len(word) == 1 and not word.isdigit():
            continue
        tokens.append(stem(word))
    return tokens


def _surface_forms(text: str) -> dict[str, str]:
    """Map each stemmed token back to its most common original spelling (keeps 'IPv6', 'OSPF')."""
    forms: dict[str, Counter] = {}
    for raw in _TOKEN_RE.findall(text):
        key = stem(raw.lower())
        forms.setdefault(key, Counter())[raw] += 1
    return {key: counter.most_common(1)[0][0] for key, counter in forms.items()}


def extract_keywords(text: str, limit: int = 6) -> list[str]:
    """Top keywords and two-word phrases by frequency (ignores numbers, dates and stopwords).

    Acronyms and technical spellings (SQL, IPv6, MySQL) get a boost because they usually name the topic.
    """
    text_no_contacts = re.sub(r"\S+@\S+|\b(?:https?://|www\.)\S+|\b\S+\.(?:com|org|net|edu|au)\b", " ", text)
    tokens = [t for t in tokenize(text_no_contacts, stopwords=KEYWORD_STOPWORDS, keep_numbers=False)
              if len(t) > 2 and "." not in t]
    if not tokens:
        return []
    unigram = Counter(tokens)
    bigram: Counter = Counter()
    # Phrases never cross punctuation: "members, books" is not the phrase "Members Books".
    for chunk in re.split(r"[,.;:!?()\[\]|/\n]+", text_no_contacts):
        chunk_tokens = [t for t in tokenize(chunk, stopwords=KEYWORD_STOPWORDS, keep_numbers=False) if len(t) > 2]
        bigram.update(zip(chunk_tokens, chunk_tokens[1:]))
    forms = _surface_forms(text_no_contacts)
    for token in unigram:
        form = forms.get(token, token)
        if (form.isupper() and 2 <= len(form) <= 6) or (any(c.isupper() for c in form[1:]) and not form.isupper()):
            unigram[token] += 1.5

    def pretty(token: str) -> str:
        word = forms.get(token, token)
        if word.islower():
            return word.capitalize()
        if word.isupper() and len(word) > 5:  # long shouted words, e.g. headings
            return word.capitalize()
        return word

    scored: list[tuple[float, str, set[str]]] = []
    for (a, b), count in bigram.items():
        if count >= 2 and a != b:
            scored.append((count * 2.2, f"{pretty(a)} {pretty(b)}", {a, b}))
    for token, count in unigram.items():
        scored.append((count * (1.0 + min(len(token), 10) / 20), pretty(token), {token}))
    scored.sort(key=lambda item: item[0], reverse=True)

    keywords: list[str] = []
    used: set[str] = set()
    for _, phrase, parts in scored:
        if parts & used and len(parts) == 1:
            continue  # word already covered by a phrase
        if parts <= used:
            continue
        keywords.append(phrase)
        used |= parts
        if len(keywords) >= limit:
            break
    return keywords


def split_sentences(text: str) -> list[str]:
    flat = re.sub(r"\s*\n\s*", " ", text)
    return [s.strip() for s in _SENTENCE_RE.split(flat) if len(s.strip()) > 0]


def _prose_lines(text: str) -> str:
    """Keep lines that read like sentences; drop headings and 'Label: value' lines."""
    keep = []
    for line in text.splitlines():
        line = line.strip()
        words = line.split()
        if not words:
            continue
        if re.match(r"^[\w ]{1,25}:\s", line) and not line.endswith((".", "!", "?")):
            continue  # e.g. "Date: 14 October 2026"
        if line.endswith((".", "!", "?")) or len(words) >= 9:
            keep.append(line)
    return "\n".join(keep)


def summarise(text: str, max_sentences: int = 2, max_chars: int = 320) -> str:
    """Extractive summary: the sentences that share most words with the document's top terms."""
    prose = _prose_lines(text)
    sentences = [s for s in split_sentences(prose) if 25 <= len(s) <= 400]
    if not sentences:
        snippet = re.sub(r"\s+", " ", text).strip()
        return (snippet[: max_chars - 1] + "…") if len(snippet) > max_chars else snippet
    freq = Counter(tokenize(text, keep_numbers=False))
    top = {word for word, _ in freq.most_common(15)}

    def score(sentence: str) -> float:
        words = tokenize(sentence, keep_numbers=False)
        if not words:
            return 0.0
        return sum(1 for w in words if w in top) / (len(words) ** 0.5)

    ranked = sorted(range(len(sentences)), key=lambda i: (score(sentences[i]), -i), reverse=True)
    chosen = sorted(ranked[:max_sentences])
    summary = " ".join(sentences[i] for i in chosen)
    if len(summary) > max_chars:
        summary = summary[: max_chars - 1].rsplit(" ", 1)[0] + "…"
    return summary


def safe_filename_part(text: str, max_len: int = 40) -> str:
    """'Database Systems' -> 'Database_Systems'."""
    words = re.findall(r"[A-Za-z0-9]+", text)
    part = "_".join(w if not w.islower() else w.capitalize() for w in words)
    return part[:max_len].strip("_")
