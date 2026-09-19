from sqlalchemy import text
from database import engine


def ensure_enriched_columns():
    """Ajoute les colonnes patrimoniales si absentes (Postgres)."""
    statements = [
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS code VARCHAR(50)",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS history JSON",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS anecdotes JSON",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS region VARCHAR(100)",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS city_name VARCHAR(100)",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS voice_id VARCHAR(100)",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
