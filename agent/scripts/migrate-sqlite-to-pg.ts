/**
 * One-off: copy local SQLite data → Railway Postgres.
 *
 * Preserves row ids (so trade_id / open_trade_id / close_trade_id FKs stay valid)
 * and resets the id sequences afterward. Wipes the target tables first.
 *
 * Usage (use the PUBLIC Railway DB URL — internal won't resolve locally):
 *   MIGRATE_PG_URL='postgresql://…proxy.rlwy.net:PORT/railway' \
 *     SQLITE_PATH=data/agent.db \
 *     npx tsx scripts/migrate-sqlite-to-pg.ts
 *
 * Add CONFIRM=yes to actually run (otherwise it's a dry run that only counts rows).
 */
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';

const SQLITE_PATH = process.env.SQLITE_PATH ?? 'data/agent.db';
const PG_URL = process.env.MIGRATE_PG_URL || process.env.DATABASE_URL;
const CONFIRM = process.env.CONFIRM === 'yes';

// FK order: trades first (referenced by agent_runs + positions).
const TABLES = ['trades', 'pnl_snapshots', 'signal_log', 'agent_runs', 'positions'] as const;

async function main() {
  if (!PG_URL) throw new Error('Set MIGRATE_PG_URL to the public Railway Postgres URL.');

  const sqlite = new DatabaseSync(SQLITE_PATH);
  const pg = new Pool({
    connectionString: PG_URL,
    ssl: /railway\.internal/.test(PG_URL) ? false : { rejectUnauthorized: false },
  });

  // Snapshot source counts
  const rowsByTable: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) {
    rowsByTable[t] = sqlite.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[];
    console.log(`  ${t}: ${rowsByTable[t].length} rows in SQLite`);
  }

  if (!CONFIRM) {
    console.log('\nDry run (no writes). Re-run with CONFIRM=yes to migrate.');
    await pg.end();
    return;
  }

  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    // Wipe target (CASCADE clears FK-dependent rows too) and reset identities.
    await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);

    for (const t of TABLES) {
      const rows = rowsByTable[t];
      for (const row of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`,
          cols.map(c => row[c]),
        );
      }
      // Realign the id sequence to MAX(id) so future inserts don't collide.
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${t}', 'id'),
                       GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${t}), 1))`,
      );
      console.log(`  ✓ ${t}: migrated ${rows.length} rows`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✖ Rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pg.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
