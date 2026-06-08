import sqlite3
import os
from pathlib import Path
from config.settings import DB_PATH, DATABASE_URL

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def get_connection():
    if DATABASE_URL:
        return _pg_connection()
    return _sqlite_connection()


def _sqlite_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _pg_connection():
    import psycopg2
    import psycopg2.extras
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    # psycopg2 커서를 sqlite3.Row처럼 dict로 접근 가능하게
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return _PgConnWrapper(conn)


class _PgConnWrapper:
    """psycopg2 connection을 sqlite3 connection처럼 쓸 수 있게 래핑"""
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        sql = _adapt_sql(sql)
        # INSERT에 RETURNING id 자동 추가
        if sql.strip().upper().startswith("INSERT") and "RETURNING" not in sql.upper():
            sql = sql + " RETURNING id"
        cur = self._conn.cursor()
        cur.execute(sql, params)
        return _PgCursorWrapper(cur)

    def executemany(self, sql, params_list):
        sql = _adapt_sql(sql)
        cur = self._conn.cursor()
        cur.executemany(sql, params_list)
        return _PgCursorWrapper(cur)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def cursor(self):
        cur = self._conn.cursor()
        return _PgCursorWrapper(cur)


class _PgCursorWrapper:
    def __init__(self, cur):
        self._cur = cur

    @property
    def rowcount(self):
        return self._cur.rowcount

    @property
    def lastrowid(self):
        return self._cur.fetchone()['id'] if self._cur.rowcount else None

    def fetchone(self):
        row = self._cur.fetchone()
        if row is None:
            return None
        return _RowWrapper(row)

    def fetchall(self):
        return [_RowWrapper(r) for r in self._cur.fetchall()]

    def execute(self, sql, params=()):
        sql = _adapt_sql(sql)
        self._cur.execute(sql, params)
        return self

    def executemany(self, sql, params_list):
        sql = _adapt_sql(sql)
        self._cur.executemany(sql, params_list)
        return self


class _RowWrapper:
    """RealDictRow를 sqlite3.Row처럼 []로 접근 가능하게"""
    def __init__(self, row):
        self._row = dict(row)

    def __getitem__(self, key):
        return self._row[key]

    def get(self, key, default=None):
        return self._row.get(key, default)

    def keys(self):
        return self._row.keys()

    def __iter__(self):
        return iter(self._row)


def _adapt_sql(sql: str) -> str:
    """SQLite SQL을 PostgreSQL 호환으로 변환"""
    import re
    # ? → %s
    sql = sql.replace("?", "%s")
    # AUTOINCREMENT → (없음, PostgreSQL은 SERIAL)
    sql = sql.replace("AUTOINCREMENT", "")
    # INTEGER PRIMARY KEY → SERIAL PRIMARY KEY
    sql = re.sub(r'INTEGER\s+PRIMARY\s+KEY', 'SERIAL PRIMARY KEY', sql, flags=re.IGNORECASE)
    # DATETIME DEFAULT CURRENT_TIMESTAMP → TIMESTAMPTZ DEFAULT NOW()
    sql = re.sub(r'DATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP', 'TIMESTAMPTZ DEFAULT NOW()', sql, flags=re.IGNORECASE)
    # TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    sql = re.sub(r'TIMESTAMP\s+DEFAULT\s+CURRENT_TIMESTAMP', 'TIMESTAMPTZ DEFAULT NOW()', sql, flags=re.IGNORECASE)
    # CURRENT_TIMESTAMP 단독
    sql = sql.replace("CURRENT_TIMESTAMP", "NOW()")
    # printf('%06d', expr) → lpad((expr)::text, 6, '0')  (PostgreSQL)
    sql = re.sub(
        r"printf\s*\(\s*'%06d'\s*,\s*([^)]+)\)",
        lambda m: f"lpad(({m.group(1)})::text, 6, '0')",
        sql,
        flags=re.IGNORECASE,
    )
    # 나머지 printf → format (fallback)
    sql = re.sub(r'printf\(', 'format(', sql, flags=re.IGNORECASE)
    # PRAGMA → 무시 (빈 SELECT로 대체)
    if re.match(r'\s*PRAGMA', sql, re.IGNORECASE):
        sql = "SELECT 1"
    # WITH RECURSIVE: PostgreSQL은 기본 지원
    # INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
    sql = re.sub(r'INSERT\s+OR\s+IGNORE', 'INSERT', sql, flags=re.IGNORECASE)
    sql = sql.rstrip(';')
    return sql


def initialize_db():
    conn = get_connection()
    if DATABASE_URL:
        _initialize_pg(conn)
    else:
        _initialize_sqlite(conn)
    conn.close()


def _initialize_sqlite(conn):
    for migration_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
        with open(migration_file, "r", encoding="utf-8") as f:
            sql = f.read()
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            if not stmt or stmt.startswith("--"):
                continue
            try:
                conn.execute(stmt)
            except Exception:
                pass
    conn.commit()


def _initialize_pg(conn):
    """PostgreSQL용 테이블 초기화 - 별도 pg 마이그레이션 사용"""
    pg_migration = Path(__file__).parent / "pg_schema.sql"
    if not pg_migration.exists():
        return
    with open(pg_migration, "r", encoding="utf-8") as f:
        sql = f.read()
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        if not stmt or stmt.startswith("--"):
            continue
        try:
            conn.execute(stmt)
            conn.commit()
        except Exception as e:
            print(f"PG init warning: {e}")
            conn._conn.rollback()
