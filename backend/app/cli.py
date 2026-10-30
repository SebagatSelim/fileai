"""Command-line tools: `flask --app run.py <command>`."""
import click
import sqlalchemy as sa
from flask import Flask

from .extensions import db


def register_cli(app: Flask) -> None:
    @app.cli.command("init-db")
    @click.option("--drop", is_flag=True, help="Drop all tables first (deletes all data!).")
    def init_db(drop: bool):
        """Create the database (MySQL) and all tables."""
        _create_mysql_database_if_missing(app)
        if drop:
            click.confirm("This deletes ALL data. Continue?", abort=True)
            db.drop_all()
        db.create_all()
        click.echo("Database tables are ready.")

    @app.cli.command("seed-demo")
    @click.option("--email", default="demo@fileai.test", show_default=True)
    @click.option("--password", default="Demo@12345", show_default=True)
    def seed_demo(email: str, password: str):
        """Create a demo account with sample documents processed by the AI pipeline."""
        from .demo import seed

        user, count = seed(email, password)
        click.echo(f"Demo account ready: {user.email} / {password}  ({count} documents added)")

    @app.cli.command("reindex")
    def reindex():
        """Recompute every embedding (run after changing EMBEDDING_PROVIDER)."""
        from .models import File
        from .services.index import clear_cache
        from .services.pipeline import refresh_embedding

        files = File.query.filter(File.status.in_(("AWAITING_REVIEW", "STORED"))).all()
        with click.progressbar(files, label="Re-indexing") as bar:
            for file in bar:
                if file.meta is not None:
                    refresh_embedding(file)
        db.session.commit()
        clear_cache()
        click.echo(f"Re-indexed {len(files)} documents.")


def _create_mysql_database_if_missing(app: Flask) -> None:
    url = sa.engine.make_url(app.config["SQLALCHEMY_DATABASE_URI"])
    if not url.drivername.startswith("mysql") or not url.database:
        return
    server = sa.create_engine(url.set(database=None))
    with server.connect() as conn:
        conn.execute(sa.text(
            f"CREATE DATABASE IF NOT EXISTS `{url.database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
    server.dispose()
