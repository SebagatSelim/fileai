# 8. Algorithms and Pseudocode

Source: Project Proposal, Section 7. The three procedures are reproduced (with line breaks restored) and two supporting procedures are added for duplicate detection and search ranking.

## 8.1 Procedure 1 — User authentication (FR-01, UC-02)

Validates a registered user and sends them to the dashboard.

```text
PROCEDURE UserAuthentication
    INPUT Email
    INPUT Password

    IF Email is EMPTY OR Password is EMPTY THEN
        DISPLAY "Please enter all required fields."
        EXIT PROCEDURE
    ENDIF

    Search User Database using Email
    IF User NOT FOUND THEN
        DISPLAY "Invalid Email or Password."        // same message as wrong password
        EXIT PROCEDURE
    ENDIF

    Verify Password using BCrypt
    IF Password is VALID THEN
        Generate JWT Authentication Token
        Create User Session
        DISPLAY Dashboard
    ELSE
        DISPLAY "Invalid Email or Password."
    ENDIF
END PROCEDURE
```

> Change from the proposal: the proposal shows "User account does not exist." when the email is unknown. Using the same message for both cases stops attackers from discovering which emails are registered (OWASP).

## 8.2 Procedure 2 — Intelligent document processing (FR-02, FR-07 – FR-10, UC-03 – UC-08)

Validates an upload, extracts text, generates AI metadata, checks for duplicates and stores the document.

```text
PROCEDURE DocumentProcessing
    INPUT UploadedFile

    IF UploadedFile is EMPTY THEN
        DISPLAY "No File Selected."
        EXIT PROCEDURE
    ENDIF

    Check File Format
    IF File Format is NOT Supported THEN
        DISPLAY "Unsupported File Format."
        EXIT PROCEDURE
    ENDIF

    Check File Size
    IF File Size exceeds Maximum Limit THEN
        DISPLAY "File Size Exceeded."
        EXIT PROCEDURE
    ENDIF

    Generate SHA-256 Hash
    Search Existing Document Hashes for this User
    IF Duplicate File Found THEN
        DISPLAY "Duplicate File Detected."
        ASK User to Continue or Cancel
        IF User selects Cancel THEN
            EXIT PROCEDURE
        ENDIF
    ENDIF

    Upload File to Cloud Storage
    Determine File Type
    IF File Type = PDF THEN
        CALL PyMuPDF
        IF Page has no text layer THEN
            CALL Tesseract OCR on Page Image
        ENDIF
    ELSE IF File Type = DOCX THEN
        CALL python-docx
    ELSE IF File Type = PNG OR JPG THEN
        CALL Tesseract OCR
    ELSE IF File Type = TXT THEN
        Read Text Directly
    ENDIF

    Analyse Extracted Text using AI
        Generate Document Category
        Generate Document Title
        Generate Keywords
        Generate Summary
        Generate Suggested Filename
        Generate Folder Recommendation
    Generate Embedding
    CALL FindSimilarDocuments          // Procedure 4

    Store Metadata in MySQL Database
    DISPLAY AI Recommendations
    WAIT for User to Approve or Edit
    Save Approved Filename and Folder
END PROCEDURE
```

> Change from the proposal: the SHA-256 check now happens **before** upload and AI analysis, and the user is asked whether to continue (UC-07). Scanned PDFs fall back to OCR.

## 8.3 Procedure 3 — Natural language search (FR-06, UC-09, UC-10)

Finds documents by meaning instead of exact filename.

```text
PROCEDURE NaturalLanguageSearch
    INPUT SearchQuery

    IF SearchQuery is EMPTY THEN
        DISPLAY "Please Enter Search Query."
        EXIT PROCEDURE
    ENDIF

    Convert SearchQuery into Semantic Representation
    Search Metadata Database (current user only)
    Compare Query with
        Document Title
        Keywords
        Summary
        Category
    Rank Matching Documents             // Procedure 5

    IF Matching Documents FOUND THEN
        DISPLAY Search Results
        INPUT SelectedDocument
        Verify User Permission
        IF Permission GRANTED THEN
            Display Document Preview
            Ask User to Download
            IF User selects Download THEN
                Download Document
                Record Download in Audit Log
            ENDIF
        ELSE
            DISPLAY "Access Denied."
        ENDIF
    ELSE
        DISPLAY "No Matching Documents Found."
    ENDIF
END PROCEDURE
```

## 8.4 Procedure 4 — Find similar documents (FR-07) *(added)*

```text
PROCEDURE FindSimilarDocuments
    INPUT NewEmbedding, UserID
    CONSTANT Threshold = 0.90            // SIMILARITY_THRESHOLD in .env

    SimilarList = EMPTY
    FOR EACH StoredEmbedding of UserID's documents
        Score = CosineSimilarity(NewEmbedding, StoredEmbedding)
        IF Score >= Threshold THEN
            ADD (DocumentID, Score) to SimilarList
        ENDIF
    ENDFOR

    SORT SimilarList by Score descending
    RETURN SimilarList
END PROCEDURE
```

`CosineSimilarity(a, b) = (a · b) / (|a| × |b|)` — 1.0 means identical meaning, 0 means unrelated.

## 8.5 Procedure 5 — Rank search results (FR-06) *(added)*

```text
PROCEDURE RankSearchResults
    INPUT QueryText, UserID
    CONSTANT SemanticWeight = 0.7, KeywordWeight = 0.3, MaxResults = 20

    QueryEmbedding = Embed(QueryText)
    FOR EACH Document of UserID with status STORED
        SemanticScore = CosineSimilarity(QueryEmbedding, Document.Embedding)
        KeywordScore  = Normalised MySQL FULLTEXT score for QueryText
                        (title, summary, extracted text, keywords)
        Document.Relevance = SemanticWeight × SemanticScore + KeywordWeight × KeywordScore
    ENDFOR

    REMOVE Documents with Relevance below minimum
    SORT by Relevance descending
    RETURN first MaxResults Documents
END PROCEDURE
```

The weights are starting values; tune them with the search test set (see [Testing Strategy](11-testing-strategy.md)).
