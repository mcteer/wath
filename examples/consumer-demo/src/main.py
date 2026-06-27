"""Tier-1 orders-api demo — static DATABASE_URL (the problem Wath solves)."""

import os

from fastapi import FastAPI, HTTPException

from src import db

app = FastAPI(title="orders-api", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "orders-api"}


@app.get("/orders")
def list_orders(limit: int = 10):
    try:
        orders = db.fetch_orders(limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database unavailable: {exc}") from exc
    return {"orders": orders, "count": len(orders)}


@app.get("/db-check")
def db_check():
    """Prove the app uses a live static credential against Postgres."""
    dsn = db.get_database_url()
    has_static = "://" in dsn and "@" in dsn
    try:
        total = db.count_orders()
        connected = True
    except Exception as exc:
        total = 0
        connected = False
        error = str(exc)
    else:
        error = None

    return {
        "uses_static_dsn": has_static,
        "connected": connected,
        "order_count": total,
        "dsn_host": dsn.split("@")[-1] if has_static else None,
        "error": error,
    }


def main():
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()
