"""User folder tree helpers (FR-05)."""
import re

from ..errors import validation_error
from ..extensions import db
from ..models import Folder

MAX_DEPTH = 8


def clean_segments(segments) -> list[str]:
    """Validate a folder path given as a list (or 'A/B/C' string)."""
    if segments is None:
        return []
    if isinstance(segments, str):
        segments = segments.split("/")
    if not isinstance(segments, list):
        raise validation_error("folder_path must be a list of folder names.")
    cleaned = []
    for segment in segments:
        name = re.sub(r"\s+", " ", str(segment)).strip().replace("/", "-").replace("\\", "-")
        if not name:
            continue
        if len(name) > 150:
            raise validation_error("Folder names must be 150 characters or fewer.")
        cleaned.append(name)
    if len(cleaned) > MAX_DEPTH:
        raise validation_error(f"Folders can be at most {MAX_DEPTH} levels deep.")
    return cleaned


def user_folders(user_id: int) -> list[Folder]:
    return Folder.query.filter_by(user_id=user_id).order_by(Folder.name).all()


def folder_paths(user_id: int) -> dict[int, list[str]]:
    """folder_id -> ['University', 'Year 2', ...] for every folder of the user."""
    folders = {f.folder_id: f for f in user_folders(user_id)}
    paths: dict[int, list[str]] = {}

    def build(folder_id: int, depth: int = 0) -> list[str]:
        if folder_id in paths:
            return paths[folder_id]
        folder = folders[folder_id]
        if folder.parent_folder_id and folder.parent_folder_id in folders and depth < 50:
            path = build(folder.parent_folder_id, depth + 1) + [folder.name]
        else:
            path = [folder.name]
        paths[folder_id] = path
        return path

    for fid in folders:
        build(fid)
    return paths


def path_string(folder: Folder | None) -> str | None:
    if folder is None:
        return None
    parts, current, guard = [], folder, 0
    while current is not None and guard < 50:
        parts.append(current.name)
        current = db.session.get(Folder, current.parent_folder_id) if current.parent_folder_id else None
        guard += 1
    return "/".join(reversed(parts))


def _key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def align_with_existing(segments: list[str], existing: list[list[str]]) -> list[str]:
    """Reuse the spelling of existing folders ('year 2' -> 'Year 2') so the tree stays tidy."""
    aligned: list[str] = []
    for depth, segment in enumerate(segments):
        for path in existing:
            if len(path) > depth and [_key(p) for p in path[:depth]] == [_key(p) for p in aligned] \
                    and _key(path[depth]) == _key(segment):
                segment = path[depth]
                break
        aligned.append(segment)
    return aligned


def ensure_folder_path(user_id: int, segments: list[str]) -> Folder | None:
    """Return the deepest folder of the path, creating missing folders (case-insensitive match)."""
    parent: Folder | None = None
    for name in segments:
        query = Folder.query.filter_by(user_id=user_id, parent_folder_id=parent.folder_id if parent else None)
        match = next((f for f in query.all() if _key(f.name) == _key(name)), None)
        if match is None:
            match = Folder(user_id=user_id, parent_folder_id=parent.folder_id if parent else None, name=name)
            db.session.add(match)
            db.session.flush()
        parent = match
    return parent
