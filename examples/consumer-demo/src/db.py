"""Database access — tier-1 static credential via DATABASE_URL."""

import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

DEFAULT_DSN = "postgres://orders:orders@localhost:5432/orders"


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DSN)


@contextmanager
def connect():
    conn = psycopg2.connect(get_database_url())
    try:
        yield conn
    finally:
        conn.close()


def fetch_orders(limit: int = 10) -> list[dict]:
    with connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, customer, amount::float AS amount, created_at
                FROM orders.orders
                ORDER BY id
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]


def count_orders() -> int:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM orders.orders")
            row = cur.fetchone()
            return int(row[0]) if row else 0
