"""Shared types for the AI providers."""
from dataclasses import asdict, dataclass, field

CATEGORIES = ["University", "Finance", "Career", "Health", "Legal", "Travel", "Work", "Personal", "Other"]
UNCATEGORISED = "Uncategorised"


@dataclass
class AnalysisResult:
    title: str
    summary: str
    category: str
    subject: str
    document_type: str
    keywords: list[str] = field(default_factory=list)
    suggested_filename: str = ""
    suggested_folder_path: list[str] = field(default_factory=list)
    confidence: float = 0.0
    model: str = "local"

    def to_dict(self) -> dict:
        data = asdict(self)
        data.pop("model")
        return data
