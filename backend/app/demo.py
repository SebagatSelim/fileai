"""Demo account + realistic sample documents (all fictional), run through the real pipeline.

Used by `flask seed-demo` for presentations, and by the tests as a small AI evaluation set.
"""
import io
import uuid

from .extensions import db
from .models import File, User
from .services import audit
from .services.index import bump
from .services.pipeline import process_document, refresh_embedding
from .services.storage import get_storage
from .services.validation import validate_upload

SAMPLES = [
    {
        "filename": "Database_Assignment.pdf",
        "expect": {"category": "University", "folder_contains": "Semester 1"},
        "text": """NIT2102 Database Systems
Assignment 1: Relational Design and SQL
Year 2, Semester 1 - Victoria University
Student: Alex Chen    Due date: 28 March 2026

1. Introduction
This assignment applies entity relationship modelling and normalisation to design a relational database
for a small library. The library stores members, books, loans and fines.

2. ER Model
The ER model contains the entities Member, Book, Loan and Fine. Each loan links one member to one book.
Cardinality and participation constraints are shown for every relationship in the ER diagram.

3. Normalisation
The loan table was normalised to third normal form (3NF) by removing transitive dependencies.
Functional dependencies were identified for each table before normalisation.

4. SQL Queries
SQL queries were written to list overdue loans, calculate fines and find the most borrowed books.
Indexes on member_id and book_id improve query performance.""",
    },
    {
        "filename": "scan001.pdf",
        "expect": {"category": "University"},
        "text": """Network Technologies Assignment Report
Unit: NIT2201 Network Technologies
Semester 2, Year 2

This report describes the implementation of IPv6 addressing and routing protocols in a small campus
network. The IPv6 address plan uses a /48 prefix divided into /64 subnets for each building.
OSPF routing was configured between three routers, and OSPF areas were used to reduce routing traffic.
Routing tables were verified after each change. Network configuration files for each router are
included in the appendix, along with test results for connectivity between all IPv6 subnets.
The report concludes that OSPF with IPv6 provides fast convergence for the campus network.""",
    },
    {
        "filename": "Invoice_2026.pdf",
        "expect": {"category": "Finance", "document_type": "Invoice"},
        "text": """BrightNet Internet Pty Ltd
TAX INVOICE
Invoice number: INV-20417        Invoice date: 3 February 2026
ABN: 12 345 678 901
Bill to: Alex Chen, 12 Example Street, Footscray VIC 3011

Description                      Qty     Amount
NBN 100 home internet plan        1      $85.00
Modem rental                      1      $10.00
Subtotal                                 $95.00
GST                                      $9.50
Total amount due                         $104.50

Payment due by 17 February 2026. Pay by direct debit or BPAY. Thank you for your payment.""",
    },
    {
        "filename": "Resume.docx",
        "expect": {"category": "Career", "document_type": "Resume"},
        "text": """Alex Chen
alex.chen@example.com | Melbourne, VIC

Career Objective
Final-year IT student seeking a graduate software developer position.

Skills
Python, Flask, React, SQL, MySQL, Git, AWS, REST APIs, agile teamwork.

Work Experience
IT Support Intern - Western Health Services (2025)
Resolved help-desk tickets, imaged laptops and documented support procedures.

Education
Bachelor of Information Technology - Victoria University (2023 - 2026)

Achievements
Dean's List 2025. Volunteer tutor for first-year programming students.

Referees available on request.""",
    },
    {
        "filename": "Team_Meeting.docx",
        "expect": {"category": "Work", "document_type": "Meeting Minutes"},
        "text": """Capstone Project Team Meeting Minutes
Date: 14 October 2026
Attendees: Al, Hassan, Sebagat, Royal

Agenda
1. Sprint 2 progress review
2. AI pipeline integration
3. Next meeting

Discussion
The team reviewed the sprint board. Upload and text extraction are complete. The AI classification
deliverable is behind schedule because of OCR testing. The project deadline for Milestone 3 is unchanged.

Action items
Hassan to finish the OCR pre-processing. Royal to write integration tests for the upload API.
Next meeting: 21 October 2026.""",
    },
    {
        "filename": "week3_notes.txt",
        "expect": {"category": "University"},
        "text": """Lecture 3 - Introduction to Machine Learning
Unit: NIT3202 Artificial Intelligence, Semester 2

Lecture notes for week 3. Machine learning lets computers learn patterns from data instead of following
hand-written rules. Supervised learning uses labelled examples, for example classifying emails as spam.
Unsupervised learning finds groups in unlabelled data, such as clustering customers.
Key terms: training set, test set, overfitting, accuracy, decision tree, neural network.
Tutorial exercise: train a decision tree classifier and report its accuracy on the test set.""",
    },
    {
        "filename": "flight_booking.txt",
        "expect": {"category": "Travel"},
        "text": """Booking confirmation - SkyRoute Airlines
Passenger: Alex Chen
Flight itinerary
Departure: Melbourne (MEL) 22 December 2026 09:15
Arrival: Kuala Lumpur (KUL) 22 December 2026 15:05
Return flight: 6 January 2027
Baggage allowance: 30 kg checked baggage. Online check-in opens 24 hours before departure.
Please bring your passport to the airport. Boarding closes 20 minutes before departure.""",
    },
    {
        "filename": "Lease_Agreement.docx",
        "expect": {"category": "Legal"},
        "text": """Residential Tenancy Agreement
This lease agreement is made between the landlord, Example Property Group, and the tenant, Alex Chen.
The parties agree that the tenant will rent the premises at 12 Example Street for a term of 12 months.
Rent is payable fortnightly in advance. The tenant must keep the premises clean and report damage.
Either party may terminate this agreement by giving notice as required by law.
This agreement is governed by the law of Victoria. Signed by both parties in the presence of a witness.""",
    },
    {
        "filename": "Database_Assignment_v2.txt",
        "expect": {"category": "University", "similar_to": "Database_Assignment.pdf"},
        "approve": False,  # left in the review queue to demonstrate the duplicate warning
        "text": """NIT2102 Database Systems
Assignment 1: Relational Design and SQL
Year 2, Semester 1 - Victoria University
Student: Alex Chen    Due date: 28 March 2026

1. Introduction
This assignment applies entity relationship modelling and normalisation to design a relational database
for a small library. The library stores members, books, loans and fines.

2. ER Model
The ER model contains the entities Member, Book, Loan and Fine. Each loan links one member to one book.
Cardinality and participation constraints are shown for every relationship in the ER diagram.

3. Normalisation
The loan table was normalised to third normal form (3NF) by removing transitive dependencies.
Functional dependencies were identified for each table before normalisation.

4. SQL Queries
SQL queries were written to list overdue loans, calculate fines and find the most borrowed books.
Indexes on member_id and book_id improve query performance. (Final version with corrected queries.)""",
    },
]


def make_pdf(text: str) -> bytes:
    import pymupdf as fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(fitz.Rect(50, 50, 545, 800), text, fontsize=10, fontname="helv")
    data = doc.tobytes()
    doc.close()
    return data


def make_docx(text: str) -> bytes:
    import docx

    document = docx.Document()
    for line in text.split("\n"):
        document.add_paragraph(line)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def sample_bytes(sample: dict) -> bytes:
    name = sample["filename"].lower()
    if name.endswith(".pdf"):
        return make_pdf(sample["text"])
    if name.endswith(".docx"):
        return make_docx(sample["text"])
    return sample["text"].encode("utf-8")


def add_document(user: User, filename: str, data: bytes, approve: bool = True) -> File:
    """Upload + process + (optionally) approve the AI suggestions, exactly as a user would."""
    from flask import current_app

    cfg = current_app.config
    checked = validate_upload(filename, data, cfg["ALLOWED_EXTENSIONS"], cfg["MAX_UPLOAD_MB"])
    key = f"users/{user.user_id}/{uuid.uuid4().hex}{checked.extension}"
    get_storage().save(key, data, checked.mime_type)
    file = File(user_id=user.user_id, original_name=checked.original_name, file_type=checked.file_type,
                mime_type=checked.mime_type, file_size_bytes=checked.size, hash_value=checked.sha256,
                storage_key=key, status="PROCESSING")
    db.session.add(file)
    db.session.flush()
    audit.record(user.user_id, "UPLOAD", file.file_id, checked.original_name)
    db.session.commit()
    process_document(file.file_id)
    file = db.session.get(File, file.file_id)
    if approve and file.status == "AWAITING_REVIEW":
        from .services.folders import ensure_folder_path
        from .models import utcnow

        meta = file.meta
        file.generated_name = meta.suggested_filename
        file.folder = ensure_folder_path(user.user_id, [p for p in meta.suggested_folder_path.split("/") if p])
        meta.is_user_approved, meta.approved_at = True, utcnow()
        file.status, file.updated_at = "STORED", utcnow()
        refresh_embedding(file)
        audit.record(user.user_id, "APPROVE", file.file_id, file.display_name)
        db.session.commit()
        bump(user.user_id)
    return file


def seed(email: str, password: str) -> tuple[User, int]:
    from .api.auth import hash_password

    db.create_all()
    user = User.query.filter_by(email=email.lower()).first()
    if user is None:
        user = User(name="Alex Chen", email=email.lower(), password_hash=hash_password(password))
        db.session.add(user)
        db.session.commit()
    existing = {f.original_name for f in File.query.filter_by(user_id=user.user_id)}
    added = 0
    for sample in SAMPLES:
        if sample["filename"] in existing:
            continue
        add_document(user, sample["filename"], sample_bytes(sample), approve=sample.get("approve", True))
        added += 1
    return user, added
