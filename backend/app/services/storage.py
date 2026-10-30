"""File storage: AWS S3 in production, a local folder for development and tests."""
from pathlib import Path

from flask import current_app, url_for
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

_TOKEN_SALT = "file-download"


class LocalStorage:
    name = "local"

    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValueError("Invalid storage key")
        return path

    def save(self, key: str, data: bytes, mime_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def path_for(self, key: str) -> Path:
        return self._path(key)

    def download_url(self, key: str, filename: str, mime_type: str, inline: bool, expires: int) -> str:
        """Signed, short-lived link served by /api/files/<token> (no auth header needed)."""
        token = _serializer().dumps({"k": key, "f": filename, "m": mime_type, "i": inline})
        return url_for("files.serve_file", token=token)


class S3Storage:
    name = "s3"

    def __init__(self, bucket: str, region: str):
        import boto3

        if not bucket:
            raise RuntimeError("S3_BUCKET_NAME must be set when STORAGE_BACKEND=s3")
        self.bucket = bucket
        self.client = boto3.client("s3", region_name=region)

    def save(self, key: str, data: bytes, mime_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType=mime_type, ServerSideEncryption="AES256"
        )

    def read(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def download_url(self, key: str, filename: str, mime_type: str, inline: bool, expires: int) -> str:
        disposition = "inline" if inline else "attachment"
        return self.client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ResponseContentDisposition": f'{disposition}; filename="{filename}"',
                "ResponseContentType": mime_type,
            },
            ExpiresIn=expires,
        )


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=_TOKEN_SALT)


def read_download_token(token: str, max_age: int) -> dict | None:
    try:
        return _serializer().loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None


def init_storage(app):
    if app.config["STORAGE_BACKEND"] == "s3":
        app.extensions["storage"] = S3Storage(app.config["S3_BUCKET_NAME"], app.config["AWS_REGION"])
    else:
        app.extensions["storage"] = LocalStorage(app.config["LOCAL_STORAGE_DIR"])


def get_storage():
    return current_app.extensions["storage"]
