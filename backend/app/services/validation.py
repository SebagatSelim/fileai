"""Upload validation (FR-08): extension, real content type, size and integrity."""
import hashlib
import io
import zipfile
from dataclasses import dataclass

from ..errors import APIError, validation_error

EXTENSION_TYPES = {"pdf": "PDF", "docx": "DOCX", "txt": "TXT", "png": "PNG", "jpg": "JPG", "jpeg": "JPG"}
MIME_TYPES = {
    "PDF": "application/pdf",
    "DOCX": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "TXT": "text/plain",
    "PNG": "image/png",
    "JPG": "image/jpeg",
}
CANONICAL_EXTENSION = {"PDF": ".pdf", "DOCX": ".docx", "TXT": ".txt", "PNG": ".png", "JPG": ".jpg"}


@dataclass
class ValidatedFile:
    original_name: str
    file_type: str
    mime_type: str
    size: int
    sha256: str
    extension: str


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def detect_type(data: bytes) -> str | None:
    """Identify the file from its first bytes instead of trusting the extension."""
    head = data[:2048]
    if b"%PDF-" in head[:1024]:
        return "PDF"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    if head.startswith(b"\xff\xd8\xff"):
        return "JPG"
    if head.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                if "word/document.xml" in zf.namelist():
                    return "DOCX"
        except zipfile.BadZipFile:
            return None
        return None
    if _looks_like_text(data):
        return "TXT"
    return None


def _looks_like_text(data: bytes) -> bool:
    sample = data[:8192]
    if b"\x00" in sample:
        return False
    try:
        sample.decode("utf-8")
        return True
    except UnicodeDecodeError:
        # Could be cut mid-character, or a Windows-1252 file; accept if mostly printable.
        printable = sum(32 <= b < 127 or b in (9, 10, 13) or b >= 160 for b in sample)
        return printable / max(len(sample), 1) > 0.95


def _check_integrity(data: bytes, file_type: str) -> None:
    try:
        if file_type == "PDF":
            import pymupdf as fitz

            with fitz.open(stream=data, filetype="pdf") as pdf:
                if pdf.needs_pass:
                    raise validation_error("Password-protected PDFs are not supported.")
                if pdf.page_count == 0:
                    raise validation_error("The PDF has no pages.")
        elif file_type == "DOCX":
            import docx

            docx.Document(io.BytesIO(data))
        elif file_type in ("PNG", "JPG"):
            from PIL import Image

            with Image.open(io.BytesIO(data)) as img:
                img.verify()
    except APIError:
        raise
    except Exception as exc:  # corrupted or truncated file
        raise validation_error("The file appears to be corrupted and could not be opened.") from exc


def validate_upload(filename: str, data: bytes, allowed_extensions: list[str], max_mb: int) -> ValidatedFile:
    name = (filename or "").strip().replace("\\", "/").split("/")[-1]
    if not name:
        raise validation_error("No file selected.")
    if len(name) > 255:
        name = name[-255:]
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in allowed_extensions or extension not in EXTENSION_TYPES:
        allowed = ", ".join(e.upper() for e in allowed_extensions)
        raise validation_error(f"Unsupported file format. Allowed formats: {allowed}.")
    if not data:
        raise validation_error("The file is empty.")
    if len(data) > max_mb * 1024 * 1024:
        raise APIError(413, "FILE_TOO_LARGE", f"File is larger than the {max_mb} MB limit.")

    expected = EXTENSION_TYPES[extension]
    detected = detect_type(data)
    if detected != expected:
        raise validation_error("The file content does not match its extension.")
    _check_integrity(data, expected)

    return ValidatedFile(
        original_name=name,
        file_type=expected,
        mime_type=MIME_TYPES[expected],
        size=len(data),
        sha256=sha256_hex(data),
        extension=CANONICAL_EXTENSION[expected],
    )
