"""Database models. These mirror database/schema.sql (see docs/05-database-design.md)."""
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from .extensions import db

# Portable column types: precise MySQL types, still runnable on SQLite for tests.
BigIntPK = sa.BigInteger().with_variant(sa.Integer(), "sqlite")
LongText = sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql")

FILE_TYPES = ("PDF", "DOCX", "TXT", "PNG", "JPG")
FILE_STATUSES = ("UPLOADED", "PROCESSING", "AWAITING_REVIEW", "STORED", "FAILED")
EXTRACTION_METHODS = ("PYMUPDF", "PYTHON_DOCX", "TESSERACT_OCR", "PLAIN_TEXT")
DUPLICATE_TYPES = ("EXACT", "SIMILAR")
AUDIT_ACTIONS = (
    "REGISTER", "LOGIN", "LOGIN_FAILED", "UPLOAD", "APPROVE", "VIEW", "DOWNLOAD",
    "UPDATE", "MOVE", "DELETE", "SEARCH",
)


def utcnow() -> datetime:
    """Naive UTC timestamp (MySQL DATETIME has no time zone)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)
    last_login_at = db.Column(db.DateTime)


class Folder(db.Model):
    __tablename__ = "folders"
    __table_args__ = (db.UniqueConstraint("user_id", "parent_folder_id", "name", name="uq_folders_sibling_name"),)

    folder_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    parent_folder_id = db.Column(db.Integer, db.ForeignKey("folders.folder_id", ondelete="CASCADE"))
    name = db.Column(db.String(150), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)


class File(db.Model):
    __tablename__ = "files"
    __table_args__ = (
        db.Index("idx_files_user_hash", "user_id", "hash_value"),
        db.Index("idx_files_user_folder", "user_id", "folder_id"),
        db.Index("idx_files_user_status", "user_id", "status"),
    )

    file_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    folder_id = db.Column(db.Integer, db.ForeignKey("folders.folder_id", ondelete="SET NULL"))
    original_name = db.Column(db.String(255), nullable=False)
    generated_name = db.Column(db.String(255))
    file_type = db.Column(db.Enum(*FILE_TYPES, name="file_type"), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_size_bytes = db.Column(db.BigInteger, nullable=False)
    hash_value = db.Column(db.String(64), nullable=False)
    storage_key = db.Column(db.String(512), nullable=False)
    status = db.Column(db.Enum(*FILE_STATUSES, name="file_status"), nullable=False, default="UPLOADED")
    error_message = db.Column(db.String(500))
    uploaded_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    folder = db.relationship("Folder", lazy="joined")
    meta = db.relationship(
        "DocumentMetadata", uselist=False, cascade="all, delete-orphan",
        foreign_keys="DocumentMetadata.file_id", back_populates="file", lazy="joined",
    )
    keywords = db.relationship(
        "DocumentKeyword", cascade="all, delete-orphan", lazy="selectin", order_by="DocumentKeyword.position",
    )
    embedding = db.relationship("DocumentEmbedding", uselist=False, cascade="all, delete-orphan", lazy="select")

    @property
    def display_name(self) -> str:
        return self.generated_name or self.original_name


class DocumentMetadata(db.Model):
    __tablename__ = "document_metadata"

    file_id = db.Column(db.Integer, db.ForeignKey("files.file_id", ondelete="CASCADE"), primary_key=True)
    title = db.Column(db.String(255))
    summary = db.Column(db.Text)
    category = db.Column(db.String(100), index=True)
    subject = db.Column(db.String(150))
    document_type = db.Column(db.String(100))
    suggested_filename = db.Column(db.String(255))
    suggested_folder_path = db.Column(db.String(500))
    classification_confidence = db.Column(db.Numeric(5, 4))
    extracted_text = db.Column(LongText)
    extraction_method = db.Column(db.Enum(*EXTRACTION_METHODS, name="extraction_method"))
    ai_model = db.Column(db.String(100))
    duplicate_of_file_id = db.Column(db.Integer, db.ForeignKey("files.file_id", ondelete="SET NULL"))
    duplicate_type = db.Column(db.Enum(*DUPLICATE_TYPES, name="duplicate_type"))
    duplicate_score = db.Column(db.Numeric(5, 4))
    is_user_approved = db.Column(db.Boolean, nullable=False, default=False)
    approved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    file = db.relationship("File", foreign_keys=[file_id], back_populates="meta")
    duplicate_of = db.relationship("File", foreign_keys=[duplicate_of_file_id], lazy="joined")


class DocumentKeyword(db.Model):
    __tablename__ = "document_keywords"

    file_id = db.Column(db.Integer, db.ForeignKey("files.file_id", ondelete="CASCADE"), primary_key=True)
    keyword = db.Column(db.String(100), primary_key=True)
    position = db.Column(db.SmallInteger, nullable=False, default=0)


class DocumentEmbedding(db.Model):
    __tablename__ = "document_embeddings"

    file_id = db.Column(db.Integer, db.ForeignKey("files.file_id", ondelete="CASCADE"), primary_key=True)
    model_name = db.Column(db.String(150), nullable=False)
    dimensions = db.Column(db.SmallInteger, nullable=False)
    embedding = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    __table_args__ = (db.Index("idx_audit_user_time", "user_id", "created_at"),)

    log_id = db.Column(BigIntPK, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey("files.file_id", ondelete="SET NULL"))
    action = db.Column(db.Enum(*AUDIT_ACTIONS, name="audit_action"), nullable=False)
    details = db.Column(db.String(500))
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    file = db.relationship("File", lazy="joined")
