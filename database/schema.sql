-- =====================================================================
-- AI-Powered Personal Digital File Organizer
-- MySQL 8.x schema  (see docs/05-database-design.md for the reasoning)
--
-- Tables from the proposal (Section 2.3): users, files, document_metadata
-- Tables added to support FR-05, FR-06, FR-07 and UC-10:
--   folders, document_keywords, document_embeddings, audit_logs
-- =====================================================================

CREATE DATABASE IF NOT EXISTS file_organizer
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE file_organizer;

-- ---------------------------------------------------------------------
-- users  (FR-01, NFR-02)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  user_id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name            VARCHAR(150)  NOT NULL,
  email           VARCHAR(255)  NOT NULL,
  password_hash   VARCHAR(255)  NOT NULL,              -- BCrypt hash, never the plain password
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at   DATETIME      NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- folders  (FR-05)  — each user's own folder tree, e.g.
-- University > Year 2 > Semester 1 > Database Systems
-- ---------------------------------------------------------------------
CREATE TABLE folders (
  folder_id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED  NOT NULL,
  parent_folder_id  INT UNSIGNED  NULL,                -- NULL = top-level folder
  name              VARCHAR(150)  NOT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (folder_id),
  UNIQUE KEY uq_folders_sibling_name (user_id, parent_folder_id, name),
  CONSTRAINT fk_folders_user   FOREIGN KEY (user_id)          REFERENCES users (user_id)     ON DELETE CASCADE,
  CONSTRAINT fk_folders_parent FOREIGN KEY (parent_folder_id) REFERENCES folders (folder_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- files  (FR-02, FR-07, FR-08)
-- The file itself lives in AWS S3; this row points to it.
-- ---------------------------------------------------------------------
CREATE TABLE files (
  file_id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED    NOT NULL,
  folder_id        INT UNSIGNED    NULL,               -- set once the user approves a folder
  original_name    VARCHAR(255)    NOT NULL,
  generated_name   VARCHAR(255)    NULL,               -- final (approved) filename
  file_type        ENUM('PDF','DOCX','TXT','PNG','JPG') NOT NULL,
  mime_type        VARCHAR(100)    NOT NULL,
  file_size_bytes  BIGINT UNSIGNED NOT NULL,
  hash_value       CHAR(64)        NOT NULL,           -- SHA-256 hex digest
  storage_key      VARCHAR(512)    NOT NULL,           -- S3 object key
  status           ENUM('UPLOADED','PROCESSING','AWAITING_REVIEW','STORED','FAILED')
                                   NOT NULL DEFAULT 'UPLOADED',
  error_message    VARCHAR(500)    NULL,               -- filled when status = FAILED
  uploaded_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id),
  KEY idx_files_user_hash   (user_id, hash_value),     -- exact-duplicate lookup is per user
  KEY idx_files_user_folder (user_id, folder_id),
  KEY idx_files_user_status (user_id, status),
  CONSTRAINT fk_files_user   FOREIGN KEY (user_id)   REFERENCES users (user_id)     ON DELETE CASCADE,
  CONSTRAINT fk_files_folder FOREIGN KEY (folder_id) REFERENCES folders (folder_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- document_metadata  (FR-03, FR-04, FR-05, FR-10)
-- One row per file. Holds what the AI suggested and whether the user approved it.
-- ---------------------------------------------------------------------
CREATE TABLE document_metadata (
  file_id                 INT UNSIGNED   NOT NULL,
  title                   VARCHAR(255)   NULL,
  summary                 TEXT           NULL,
  category                VARCHAR(100)   NULL,         -- e.g. University, Finance, Career
  subject                 VARCHAR(150)   NULL,         -- e.g. Database Systems
  document_type           VARCHAR(100)   NULL,         -- e.g. Assignment, Invoice, Resume
  suggested_filename      VARCHAR(255)   NULL,
  suggested_folder_path   VARCHAR(500)   NULL,         -- e.g. University/Year 2/Semester 1/Database Systems
  classification_confidence DECIMAL(5,4) NULL,         -- 0.0000 – 1.0000
  extracted_text          MEDIUMTEXT     NULL,         -- output of PyMuPDF / python-docx / Tesseract
  extraction_method       ENUM('PYMUPDF','PYTHON_DOCX','TESSERACT_OCR','PLAIN_TEXT') NULL,
  ai_model                VARCHAR(100)   NULL,         -- which model produced the suggestions
  is_user_approved        BOOLEAN        NOT NULL DEFAULT FALSE,
  approved_at             DATETIME       NULL,
  created_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id),
  KEY idx_metadata_category (category),
  FULLTEXT KEY ftx_metadata_text (title, summary, extracted_text),   -- keyword fallback for search
  CONSTRAINT fk_metadata_file FOREIGN KEY (file_id) REFERENCES files (file_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- document_keywords  (FR-04) — one row per keyword, so search can filter on them
-- ---------------------------------------------------------------------
CREATE TABLE document_keywords (
  file_id   INT UNSIGNED NOT NULL,
  keyword   VARCHAR(100) NOT NULL,
  PRIMARY KEY (file_id, keyword),
  KEY idx_keywords_keyword (keyword),
  CONSTRAINT fk_keywords_file FOREIGN KEY (file_id) REFERENCES files (file_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- document_embeddings  (FR-06, FR-07)
-- Vector used for semantic search and "similar document" detection.
-- Stored as JSON; similarity is computed in Python (numpy).
-- ---------------------------------------------------------------------
CREATE TABLE document_embeddings (
  file_id      INT UNSIGNED      NOT NULL,
  model_name   VARCHAR(150)      NOT NULL,
  dimensions   SMALLINT UNSIGNED NOT NULL,
  embedding    JSON              NOT NULL,
  created_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id),
  CONSTRAINT fk_embeddings_file FOREIGN KEY (file_id) REFERENCES files (file_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- audit_logs  (UC-10: "download activity is recorded for auditing")
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  log_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED    NOT NULL,
  file_id     INT UNSIGNED    NULL,
  action      ENUM('REGISTER','LOGIN','LOGIN_FAILED','UPLOAD','APPROVE','VIEW','DOWNLOAD',
                   'UPDATE','MOVE','DELETE','SEARCH') NOT NULL,
  details     VARCHAR(500)    NULL,
  ip_address  VARCHAR(45)     NULL,                    -- fits IPv6
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_audit_user_time (user_id, created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_file FOREIGN KEY (file_id) REFERENCES files (file_id) ON DELETE SET NULL
) ENGINE=InnoDB;
