"""Tier-1 demo service — reads a static DATABASE_URL (the problem Wath solves)."""

import os

from fastapi import FastAPI

app = FastAPI(title="orders-api-demo")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    dsn = os.environ.get("DATABASE_URL", "")
    # Intentionally tier-1: static credential in env (VDS-001 violation until onboarded)
    has_static = "://" in dsn and "@" in dsn
    return {"uses_static_dsn": has_static, "dsn_host": dsn.split("@")[-1] if has_static else None}
