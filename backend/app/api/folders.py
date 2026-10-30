"""Folder tree and categories (FR-05)."""
import sqlalchemy as sa
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..errors import APIError, not_found, validation_error
from ..extensions import db
from ..models import DocumentMetadata, File, Folder
from ..services.folders import clean_segments, folder_paths, user_folders
from .helpers import current_user_id, json_body

bp = Blueprint("folders", __name__)


@bp.get("/folders")
@jwt_required()
def folder_tree():
    user_id = current_user_id()
    folders = user_folders(user_id)
    paths = folder_paths(user_id)
    counts = dict(db.session.execute(
        sa.select(File.folder_id, sa.func.count(File.file_id))
        .where(File.user_id == user_id, File.status == "STORED", File.folder_id.is_not(None))
        .group_by(File.folder_id)
    ).all())
    nodes = {
        f.folder_id: {"folder_id": f.folder_id, "name": f.name, "parent_folder_id": f.parent_folder_id,
                      "path": "/".join(paths[f.folder_id]), "document_count": counts.get(f.folder_id, 0), "children": []}
        for f in folders
    }
    roots = []
    for node in nodes.values():
        parent = nodes.get(node["parent_folder_id"])
        (parent["children"] if parent else roots).append(node)
    for node in nodes.values():
        node["children"].sort(key=lambda n: n["name"].lower())
    roots.sort(key=lambda n: n["name"].lower())
    return jsonify(roots)


@bp.post("/folders")
@jwt_required()
def create_folder():
    user_id = current_user_id()
    data = json_body()
    names = clean_segments([data.get("name") or ""])
    if not names:
        raise validation_error("Folder name is required.", {"name": "Required"})
    parent_id = data.get("parent_folder_id")
    if parent_id is not None:
        parent = db.session.get(Folder, int(parent_id))
        if parent is None or parent.user_id != user_id:
            raise not_found("Parent folder not found.")
    siblings = Folder.query.filter_by(user_id=user_id, parent_folder_id=parent_id).all()
    if any(f.name.lower() == names[0].lower() for f in siblings):
        raise APIError(409, "FOLDER_EXISTS", "A folder with this name already exists here.", {"name": "Already exists"})
    folder = Folder(user_id=user_id, parent_folder_id=parent_id, name=names[0])
    db.session.add(folder)
    db.session.commit()
    path = "/".join(folder_paths(user_id)[folder.folder_id])
    return jsonify({"folder_id": folder.folder_id, "name": folder.name, "parent_folder_id": parent_id,
                    "path": path, "document_count": 0, "children": []}), 201


@bp.get("/categories")
@jwt_required()
def categories():
    user_id = current_user_id()
    rows = db.session.execute(
        sa.select(DocumentMetadata.category, sa.func.count(File.file_id))
        .join(File, File.file_id == DocumentMetadata.file_id)
        .where(File.user_id == user_id, File.status == "STORED", DocumentMetadata.category.is_not(None))
        .group_by(DocumentMetadata.category)
        .order_by(sa.func.count(File.file_id).desc())
    ).all()
    return jsonify([{"category": category, "count": count} for category, count in rows])
