"""Natural-language search endpoint (FR-06, UC-09)."""
import time

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..errors import validation_error
from ..extensions import db
from ..models import File
from ..serializers import document_json
from ..services import audit
from ..services.folders import folder_paths
from ..services.search import search
from .helpers import current_user_id, json_body

bp = Blueprint("search", __name__)


@bp.post("/search")
@jwt_required()
def run_search():
    started = time.perf_counter()
    user_id = current_user_id()
    data = json_body()
    query = str(data.get("query") or "").strip()
    if not query:
        raise validation_error("Please enter a search query.", {"query": "Required"})
    if len(query) > 500:
        raise validation_error("Search query must be 500 characters or fewer.", {"query": "Too long"})
    try:
        limit = min(max(int(data.get("limit", 10)), 1), 50)
    except (TypeError, ValueError):
        limit = 10

    matches = search(user_id, query, limit)
    files = {f.file_id: f for f in File.query.filter(File.file_id.in_([m[0] for m in matches]))} if matches else {}
    paths = folder_paths(user_id)
    results = []
    for file_id, relevance in matches:
        if file_id in files:
            item = document_json(files[file_id], paths)
            item["relevance"] = relevance
            results.append(item)

    audit.record(user_id, "SEARCH", None, query)
    db.session.commit()
    return jsonify({"query": query, "results": results, "took_ms": int((time.perf_counter() - started) * 1000)})
