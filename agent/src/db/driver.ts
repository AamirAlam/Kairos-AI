/**
 * Dual database driver — one async interface over two backends:
 *   • DATABASE_URL set  → PostgreSQL (Railway, prod)
 *   • otherwise         → node:sqlite (zero-config local dev)
 *
 * Write SQL with `?` placeholders; the Postgres path rewrites them to $1, $2…
 * Inserts use dbInsert() which returns the new row id on both backends.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { Pool, types } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
export const isPg = !!DATABASE_URL;

// ── Postgres ─────────────────────────────────────────────────────────────────
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    // BIGINT (int8, oid 20) → Number. Our values (epoch-ms, ids) are < 2^53.
    types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 4,
      // Railway internal network needs no TLS; public/other hosts do.
      ssl: DATABASE_URL && /railway\.internal/.test(DATABASE_URL)
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ── SQLite ───────────────────────────────────────────────────────────────────
let sqlite: DatabaseSync | null = null;

function getSqlite(): DatabaseSync {
  if (!sqlite) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'agent.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    sqlite = new DatabaseSync(dbPath);
  }
  return sqlite;
}

// ── Unified async API ─────────────────────────────────────────────────────────
export async function dbAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (isPg) {
    const res = await getPool().query(toPg(sql), params);
    return res.rows as T[];
  }
  return getSqlite().prepare(sql).all(...(params as never[])) as T[];
}

export async function dbGet<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await dbAll<T>(sql, params))[0] ?? null;
}

export async function dbRun(sql: string, params: unknown[] = []): Promise<void> {
  if (isPg) {
    await getPool().query(toPg(sql), params);
    return;
  }
  getSqlite().prepare(sql).run(...(params as never[]));
}

/** Insert a row and return its id (appends RETURNING id on Postgres). */
export async function dbInsert(sql: string, params: unknown[] = []): Promise<number> {
  if (isPg) {
    const res = await getPool().query(`${toPg(sql)} RETURNING id`, params);
    return Number(res.rows[0].id);
  }
  return Number(getSqlite().prepare(sql).run(...(params as never[])).lastInsertRowid);
}

export async function dbExec(sql: string): Promise<void> {
  if (isPg) {
    await getPool().query(sql);
    return;
  }
  getSqlite().exec(sql);
}
