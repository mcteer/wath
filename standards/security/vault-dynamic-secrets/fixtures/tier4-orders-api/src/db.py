import os


def get_database_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL must be supplied by VSO at runtime")
    return url
