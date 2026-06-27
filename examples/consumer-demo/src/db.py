import os

import psycopg2
import psycopg2.extras

DEFAULT_DSN = "postgres://orders:orders@localhost:5432/orders"


def get_database_url():
    return os.environ.get("DATABASE_URL", DEFAULT_DSN)


def fetch_orders(limit=10):
    conn = psycopg2.connect(get_database_url())
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
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
    finally:
        conn.close()


def count_orders():
    conn = psycopg2.connect(get_database_url())
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM orders.orders")
        row = cur.fetchone()
        return int(row[0]) if row else 0
    finally:
        conn.close()
