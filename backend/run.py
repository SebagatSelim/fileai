"""Development entry point.

    flask --app run.py init-db      # create tables
    flask --app run.py seed-demo    # optional demo account with sample documents
    flask --app run.py run --port 5000
"""
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

from app import create_app  # noqa: E402  (load .env before reading config)

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
