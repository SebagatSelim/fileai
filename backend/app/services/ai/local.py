"""Offline document analyser: rule-based classification + statistical keywords and summaries.

Works with no API key, so the app runs (and can be demonstrated) anywhere. When an OpenAI key is
configured, openai_provider.py is used instead and this module becomes the fallback.
"""
import math
import re
from collections import Counter
from pathlib import Path

from ..text import extract_keywords, safe_filename_part, stem, summarise, tokenize
from .base import UNCATEGORISED, AnalysisResult

MODEL_NAME = "local-rules-v1"

_RAW_RULES = {
    "University": {
        "assignment": 3, "semester": 3, "lecture": 2.5, "university": 3, "student": 2, "course": 2,
        "exam": 2.5, "tutorial": 2, "lab": 1.5, "thesis": 3, "assessment": 2, "capstone": 3,
        "coursework": 3, "quiz": 2, "lecturer": 2.5, "professor": 2, "campus": 2, "enrolment": 2,
        "transcript": 2, "grade": 1.5, "submission": 1.5, "research": 1, "essay": 2.5, "rubric": 3,
        "referencing": 2, "trimester": 3, "homework": 3, "syllabus": 3, "school": 1.5, "college": 2,
        "unit": 1.5, "learning": 1, "outcomes": 1, "marks": 1,
    },
    "Finance": {
        "invoice": 4, "receipt": 3.5, "payment": 2.5, "tax": 3, "bank": 3, "statement": 1.5, "amount": 2,
        "total": 1.5, "gst": 3, "abn": 3, "balance": 2, "billing": 3, "salary": 2.5, "payslip": 4,
        "expense": 2.5, "budget": 2.5, "transaction": 2.5, "refund": 2.5, "purchase": 2, "subtotal": 3,
        "price": 1.5, "paid": 2, "account": 1, "superannuation": 3, "loan": 2.5, "insurance": 2,
        "bill": 2.5, "qty": 3, "aud": 2.5, "usd": 2.5, "deposit": 2, "withdrawal": 2.5,
    },
    "Career": {
        "resume": 4.5, "cv": 3, "curriculum": 2, "vitae": 3, "experience": 2, "skills": 2, "employment": 2.5,
        "job": 2, "position": 1.5, "interview": 2.5, "career": 3, "internship": 3, "linkedin": 3,
        "qualifications": 2, "employer": 2, "hiring": 2.5, "recruitment": 3, "responsibilities": 1.5,
        "achievements": 1.5, "volunteer": 1.5, "hobbies": 2, "referees": 3,
    },
    "Health": {
        "patient": 3, "doctor": 3, "medical": 3, "prescription": 4, "hospital": 3, "clinic": 3,
        "diagnosis": 3.5, "health": 2, "medicare": 3.5, "appointment": 1.5, "blood": 2.5, "symptoms": 3,
        "pharmacy": 3, "medication": 3, "dosage": 3.5, "vaccination": 3, "pathology": 3.5, "gp": 2.5,
        "treatment": 2,
    },
    "Legal": {
        "agreement": 3, "contract": 3.5, "clause": 3.5, "party": 2, "parties": 2, "lease": 3.5, "tenancy": 3.5,
        "tenant": 3, "landlord": 3, "hereby": 3.5, "liability": 3, "law": 2, "court": 3, "legal": 3,
        "witness": 2, "indemnity": 3.5, "jurisdiction": 3.5, "terminate": 2, "obligations": 2,
    },
    "Travel": {
        "flight": 3.5, "booking": 2.5, "itinerary": 4, "passport": 3, "visa": 3, "hotel": 3, "boarding": 3.5,
        "reservation": 3, "departure": 3, "arrival": 3, "ticket": 2, "airline": 3.5, "airport": 3,
        "baggage": 3, "travel": 3, "trip": 2.5,
    },
    "Work": {
        "meeting": 3, "minutes": 2.5, "agenda": 3.5, "project": 1.5, "client": 2, "stakeholder": 3,
        "quarterly": 2.5, "deadline": 1.5, "team": 1, "deliverable": 2.5, "sprint": 2.5, "roadmap": 2.5,
        "kpi": 3, "manager": 1.5, "department": 1.5, "memo": 3, "attendees": 3.5, "policy": 1.5,
    },
    "Personal": {
        "recipe": 4, "diary": 4, "journal": 3, "family": 2.5, "birthday": 3, "wedding": 3, "holiday": 2,
        "dear": 1.5, "ingredients": 4, "workout": 3, "shopping": 3,
    },
}
CATEGORY_RULES = {cat: {stem(word): weight for word, weight in words.items()} for cat, words in _RAW_RULES.items()}

# (document type, regex, category it implies)
DOC_TYPES = [
    ("Cover Letter", r"\bcover letter\b|\bdear (hiring|recruitment)", "Career"),
    ("Resume", r"\bresume\b|\bcurriculum vitae\b|\bcv\b|\bwork experience\b", "Career"),
    ("Payslip", r"\bpay ?slip\b|\bpay advice\b|\bnet pay\b", "Finance"),
    ("Tax Return", r"\btax return\b|\bnotice of assessment\b", "Finance"),
    ("Bank Statement", r"\bbank statement\b|\bopening balance\b|\bclosing balance\b", "Finance"),
    ("Invoice", r"\binvoice\b|\bamount due\b", "Finance"),
    ("Receipt", r"\breceipt\b|\bthank you for your purchase\b", "Finance"),
    ("Assignment", r"\bassignment\b|\bassessment task\b|\bhomework\b", "University"),
    ("Lecture Notes", r"\blecture notes\b|\blecture \d+\b|\bweek \d+ (notes|lecture)\b", "University"),
    ("Thesis", r"\bthesis\b|\bdissertation\b", "University"),
    ("Exam Paper", r"\bexamination\b|\bexam paper\b|\bfinal exam\b", "University"),
    ("Transcript", r"\bacademic transcript\b", "University"),
    ("Essay", r"\bessay\b", "University"),
    ("Meeting Minutes", r"\bmeeting minutes\b|\bminutes of (the )?meeting\b|\battendees\b", "Work"),
    ("Agenda", r"\bagenda\b", "Work"),
    ("Contract", r"\bagreement\b|\bcontract\b|\blease\b", "Legal"),
    ("Prescription", r"\bprescription\b|\bdosage\b", "Health"),
    ("Medical Report", r"\bpathology\b|\bdiagnosis\b|\bmedical report\b|\btest results\b", "Health"),
    ("Itinerary", r"\bitinerary\b|\bboarding pass\b|\bbooking confirmation\b|\bflight\b", "Travel"),
    ("Recipe", r"\bingredients\b|\brecipe\b", "Personal"),
    ("Proposal", r"\bproposal\b", None),
    ("Certificate", r"\bcertificate\b|\bcertify that\b", None),
    ("Report", r"\breport\b", None),
    ("Letter", r"^\s*dear\b", None),
    ("Notes", r"\bnotes\b", None),
]
DEFAULT_TYPE = {
    "University": "Course Material", "Finance": "Financial Document", "Career": "Career Document",
    "Health": "Medical Document", "Legal": "Legal Document", "Travel": "Travel Document",
    "Work": "Work Document", "Personal": "Personal Document", "Other": "Document",
}
TOP_FOLDER = {"Health": "Health", "Other": "Other"}

GENERIC = {stem(w) for w in (
    "assignment semester year week university student report document due date name id unit course total "
    "invoice amount number task submission notes lecture page title subject introduction conclusion "
    "summary table figure section part question answer resume experience skills meeting minutes "
    "agenda contract agreement receipt statement payment".split()
)}

_NUM = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6"}
_PERSON_NAME = re.compile(r"[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}")


def _number(token: str) -> str:
    return _NUM.get(token.lower(), token)


def _plural(word: str) -> str:
    if word.endswith("s"):
        return word
    if word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
        return word[:-1] + "ies"
    return word + "s"


def _clean_line(line: str) -> str:
    line = re.sub(r"\s+", " ", line).strip(" \t-–—:|•*#")
    if line.isupper() and len(line) > 3:
        line = line.title()
    return line


_UNIT_CODE = r"[A-Z]{3,4}\s?\d{3,4}"
_AIRLINE = re.compile(r"\b([A-Z][A-Za-z]+ (?:Airlines|Airways|Air))\b")
_AMOUNT = re.compile(r"(?i)\b(?:total(?: amount)?(?: due)?|amount due|balance due)\b[^\d$\n]*\$?\s?([\d,]+\.\d{2})")
_DATE = r"\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}"


def _clean_unit_name(name: str) -> str:
    """'NIT3202 Artificial Intelligence, Semester 2' -> 'Artificial Intelligence'."""
    name = re.sub(rf"\(?\b{_UNIT_CODE}\b\)?", " ", name)
    name = re.split(r"[,;|(]| [-–] |\b(?:semester|trimester|year|assignment|lecture|week)\b", name, flags=re.I)[0]
    return _clean_line(name)[:80]


def _strip_doc_type(title: str, doc_type: str) -> str:
    type_words = {stem(t.lower()) for t in doc_type.split()}
    words = [w for w in title.split() if stem(w.lower()) not in type_words]
    return " ".join(words).strip(" -–:")


class LocalAnalyzer:
    name = MODEL_NAME

    def analyze(self, text: str, original_name: str, existing_folders: list[list[str]] | None = None,
                extension: str = "") -> AnalysisResult:
        stem_name = Path(original_name).stem
        letters = sum(ch.isalpha() for ch in text)
        if letters < 40:
            return self._uncategorised(stem_name, extension, text)

        tokens = tokenize(text)
        name_tokens = tokenize(re.sub(r"[_\-.]+", " ", stem_name))
        category, confidence = self._classify(tokens, name_tokens)
        doc_type = self._document_type(text, stem_name, category)
        keywords = extract_keywords(text, limit=6)
        details = self._details(text, category)
        title = self._title(text, category, doc_type, details, stem_name)
        if doc_type in ("Resume", "Cover Letter") and _PERSON_NAME.fullmatch(title):
            details["person"] = title  # a CV usually starts with the person's name
            title = f"{doc_type} – {title}"
        subject = self._subject(category, doc_type, keywords, details, title)

        return AnalysisResult(
            title=title[:255],
            summary=self._summary(text, category, doc_type, details),
            category=category,
            subject=subject[:150],
            document_type=doc_type,
            keywords=keywords,
            suggested_filename=self._filename(category, doc_type, subject, details, title, extension),
            suggested_folder_path=self._folder(category, doc_type, subject, details),
            confidence=round(confidence, 4),
            model=MODEL_NAME,
        )

    # ---------- classification ----------
    def _classify(self, tokens: list[str], name_tokens: list[str]) -> tuple[str, float]:
        counts = Counter(tokens)
        name_counts = Counter(name_tokens)
        scores = {}
        for category, rules in CATEGORY_RULES.items():
            score = 0.0
            for word, weight in rules.items():
                if counts[word]:
                    score += weight * (1 + math.log(counts[word]))
                if name_counts[word]:
                    score += weight * 2  # the filename is a strong hint ("Invoice_2026.pdf")
            scores[category] = score
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        (best, top), (_, second) = ranked[0], ranked[1]
        if top < 3:
            return "Other", 0.3
        confidence = top / (top + second + 3)
        return best, max(0.05, min(confidence, 0.97))

    def _document_type(self, text: str, stem_name: str, category: str) -> str:
        lowered = text.lower()
        name = re.sub(r"[_\-.]+", " ", stem_name.lower())
        best, best_score = None, 0.0
        for doc_type, pattern, hint in DOC_TYPES:
            if hint not in (None, category):
                continue
            hits = len(re.findall(pattern, lowered, flags=re.MULTILINE)) + 3 * len(re.findall(pattern, name))
            if hits == 0:
                continue
            score = hits + (2 if hint == category else 0)
            if score > best_score:
                best, best_score = doc_type, score
        return best or DEFAULT_TYPE.get(category, "Document")

    # ---------- details used for subject / folders / filenames ----------
    def _details(self, text: str, category: str) -> dict:
        details: dict[str, str] = {}
        if m := re.search(r"\b(?:semester|sem)\.?\s*([1-4]|one|two|three|four)\b", text, re.I):
            details["semester"] = f"Semester {_number(m.group(1))}"
        elif m := re.search(r"\btrimester\s*([1-3]|one|two|three)\b", text, re.I):
            details["semester"] = f"Trimester {_number(m.group(1))}"
        if m := re.search(r"\byear\s*([1-6]|one|two|three|four|five|six)\b(?!\d)", text, re.I):
            details["year_level"] = f"Year {_number(m.group(1))}"
        years = re.findall(r"\b(20[0-4]\d)\b", text)
        if years:
            details["calendar_year"] = Counter(years).most_common(1)[0][0]

        # Unit name: "Unit: NIT2201 Network Technologies", or a line that starts with a unit code.
        unit_line = re.search(r"(?im)^\s*(?:unit|subject|course|module)(?:\s+(?:name|title))?\s*[:\-–]\s*(.{3,100})$", text)
        code_line = re.search(rf"(?m)^\s*({_UNIT_CODE})\s*[-–:]?\s*([A-Za-z][^\n]{{2,80}})$", text)
        unit_name = _clean_unit_name(unit_line.group(1)) if unit_line else ""
        if not unit_name and code_line:
            unit_name = _clean_unit_name(code_line.group(2))
        if unit_name:
            details["unit_name"] = unit_name
        if m := re.search(rf"\b({_UNIT_CODE})\b", text):
            details["unit_code"] = m.group(1).replace(" ", "")

        if category == "Finance":
            if m := re.search(r"(?im)^\s*(?:from|vendor|supplier|billed by|issued by|company|merchant)\s*[:\-]\s*(.{2,60})$", text):
                details["vendor"] = _clean_line(m.group(1))
            else:
                first = next((_clean_line(line) for line in text.splitlines() if len(_clean_line(line)) > 2), "")
                if first and len(first.split()) <= 6 and not re.search(r"invoice|receipt|statement|\d", first, re.I):
                    details["vendor"] = first
            if m := _AMOUNT.search(text):
                details["amount"] = "$" + m.group(1)
            if m := re.search(rf"(?i)\bdate\s*[:\-]?\s*({_DATE})", text):
                details["date"] = m.group(1)
            if m := re.search(rf"(?i)\bdue(?: date| by)?\s*[:\-]?\s*({_DATE})", text):
                details["due"] = m.group(1)
        if category == "Travel" and (m := _AIRLINE.search(text)):
            details["airline"] = m.group(1)
        return details

    def _title(self, text: str, category: str, doc_type: str, details: dict, stem_name: str) -> str:
        if m := re.search(r"(?im)^\s*title\s*[:\-]\s*(.{3,150})$", text):
            return _clean_line(m.group(1))
        if category == "Finance" and details.get("vendor") and doc_type != "Financial Document":
            return f"{doc_type} – {details['vendor']}"
        skip = re.compile(r"\b(student|name|id|date|due|email|phone|page|abn|invoice no|tel)\b|www\.|http|@", re.I)
        candidates = []
        for line in [line for line in text.splitlines() if line.strip()][:15]:
            line = _clean_line(line)
            words = line.split()
            alpha = sum(ch.isalpha() for ch in line) / max(len(line), 1)
            if 2 <= len(words) <= 14 and alpha > 0.6 and len(line) <= 120 and not skip.search(line):
                candidates.append(line)
        # Prefer an early line that names the document type, e.g. "Assignment 1: Relational Design and SQL".
        type_words = {stem(w.lower()) for w in doc_type.split()}
        for line in candidates[:5]:
            line_words = {stem(w.lower().strip(":,.")) for w in line.split()}
            if len(line.split()) >= 3 and type_words & line_words:
                return line
        if candidates:
            return candidates[0]
        return re.sub(r"[_\-]+", " ", stem_name).strip().title() or doc_type

    def _subject(self, category: str, doc_type: str, keywords: list[str], details: dict, title: str) -> str:
        if category == "University" and details.get("unit_name"):
            return details["unit_name"]
        if category == "Finance" and details.get("vendor"):
            return details["vendor"]
        if category == "Travel" and details.get("airline"):
            return details["airline"]
        if details.get("person"):
            return details["person"]
        core = _strip_doc_type(re.sub(rf"\b{_UNIT_CODE}\b", "", title), doc_type)
        core_words = core.split()
        if category != "University" and 1 <= len(core_words) <= 4 \
                and not all(stem(w.lower()) in GENERIC for w in core_words):
            return core
        for phrase in keywords:
            parts = [stem(p.lower()) for p in phrase.split()]
            if len(parts) > 1 and not any(p in GENERIC for p in parts):
                return phrase
        for phrase in keywords:
            if stem(phrase.lower()) not in GENERIC:
                return phrase
        return details.get("unit_code") or "General"

    def _summary(self, text: str, category: str, doc_type: str, details: dict) -> str:
        if category == "Finance" and details.get("vendor") and details.get("amount"):
            parts = [f"{doc_type} from {details['vendor']} for {details['amount']}"]
            if details.get("date"):
                parts.append(f"dated {details['date']}")
            if details.get("due"):
                parts.append(f"due {details['due']}")
            return ", ".join(parts) + "."
        return summarise(text)

    def _folder(self, category: str, doc_type: str, subject: str, details: dict) -> list[str]:
        top = TOP_FOLDER.get(category, category)
        if category == "University":
            path = [top]
            if details.get("year_level"):
                path.append(details["year_level"])
            if details.get("semester"):
                path.append(details["semester"])
            path.append(subject if subject != "General" else _plural(doc_type))
            return path
        if category == "Finance":
            path = [top, _plural(doc_type) if doc_type != "Financial Document" else "Other"]
            if details.get("calendar_year"):
                path.append(details["calendar_year"])
            return path
        if category == "Travel":
            return [top] + ([details["calendar_year"]] if details.get("calendar_year") else [])
        if category == "Other":
            return [top]
        return [top, _plural(doc_type)]

    def _filename(self, category: str, doc_type: str, subject: str, details: dict, title: str, extension: str) -> str:
        parts: list[str] = []
        if category == "University":
            if details.get("semester"):
                parts.append(details["semester"].replace(" ", ""))
            parts += [subject, doc_type]
        elif category == "Finance":
            parts += [doc_type, details.get("vendor", ""), details.get("calendar_year", "")]
        elif details.get("person"):
            parts += [doc_type, details["person"]]
        else:
            parts += [title if len(title) <= 50 else subject, details.get("calendar_year", "")]
        name = "_".join(p for p in (safe_filename_part(x) for x in parts if x) if p)
        name = re.sub(r"_+", "_", name)[:80].strip("_") or "Document"
        return name + extension

    def _uncategorised(self, stem_name: str, extension: str, text: str) -> AnalysisResult:
        title = re.sub(r"[_\-]+", " ", stem_name).strip().title() or "Untitled Document"
        return AnalysisResult(
            title=title,
            summary="Not enough readable text was found to summarise this document.",
            category=UNCATEGORISED,
            subject="",
            document_type="Document",
            keywords=extract_keywords(text, limit=3),
            suggested_filename=(safe_filename_part(title, 80) or "Document") + extension,
            suggested_folder_path=[UNCATEGORISED],
            confidence=0.1,
            model=MODEL_NAME,
        )
