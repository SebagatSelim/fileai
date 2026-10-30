"""Application settings, read from environment variables (see .env.example)."""
import os
from datetime import timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


class Config:
    # ---------- Flask ----------
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    JSON_SORT_KEYS = False

    # ---------- Auth ----------
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me-to-a-long-random-value")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=_int("JWT_ACCESS_TOKEN_EXPIRES_MIN", 30))
    BCRYPT_ROUNDS = _int("BCRYPT_ROUNDS", 12)
    LOGIN_MAX_ATTEMPTS = _int("LOGIN_MAX_ATTEMPTS", 5)
    LOGIN_LOCKOUT_SECONDS = _int("LOGIN_LOCKOUT_SECONDS", 300)

    # ---------- Database ----------
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:@127.0.0.1:3306/file_organizer?charset=utf8mb4",
    )
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ---------- Storage ----------
    STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")  # local | s3
    LOCAL_STORAGE_DIR = os.getenv("LOCAL_STORAGE_DIR", str(BACKEND_DIR / "uploads"))
    AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
    S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "")
    DOWNLOAD_URL_EXPIRES_SEC = _int("S3_PRESIGNED_URL_EXPIRES_SEC", 300)

    # ---------- Uploads ----------
    MAX_UPLOAD_MB = _int("MAX_UPLOAD_MB", 20)
    ALLOWED_EXTENSIONS = _list("ALLOWED_EXTENSIONS", "pdf,docx,txt,png,jpg,jpeg")
    STORAGE_QUOTA_MB = _int("STORAGE_QUOTA_MB", 1024)

    # ---------- OCR ----------
    TESSERACT_CMD = os.getenv("TESSERACT_CMD", "")
    MAX_PDF_PAGES = _int("MAX_PDF_PAGES", 50)

    # ---------- AI ----------
    AI_PROVIDER = os.getenv("AI_PROVIDER", "local")  # local | openai
    EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "local")  # local | openai | sentence-transformers
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL") or "text-embedding-3-small"
    SENTENCE_TRANSFORMER_MODEL = os.getenv("EMBEDDING_MODEL") or "sentence-transformers/all-MiniLM-L6-v2"
    AI_MAX_INPUT_CHARS = _int("AI_MAX_INPUT_CHARS", 12000)
    SIMILARITY_THRESHOLD = _float("SIMILARITY_THRESHOLD", 0.90)
    CLASSIFICATION_CONFIDENCE_THRESHOLD = _float("CLASSIFICATION_CONFIDENCE_THRESHOLD", 0.60)

    # ---------- Processing ----------
    PROCESSING_MODE = os.getenv("PROCESSING_MODE", "thread")  # thread | sync
    PROCESSING_WORKERS = _int("PROCESSING_WORKERS", 2)
    STUCK_JOB_SECONDS = _int("STUCK_JOB_SECONDS", 60)

    # ---------- CORS ----------
    CORS_ORIGINS = _list("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    BCRYPT_ROUNDS = 4
    PROCESSING_MODE = "sync"
    AI_PROVIDER = "local"
    EMBEDDING_PROVIDER = "local"
    STORAGE_BACKEND = "local"
    TESSERACT_CMD = ""
