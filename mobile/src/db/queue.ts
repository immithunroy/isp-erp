import * as SQLite from "expo-sqlite";

const DB_NAME = "isp_erp_mobile.db";

let db: SQLite.WebSQLDatabase | null = null;

export function getDb(): SQLite.WebSQLDatabase {
  if (!db) {
    db = SQLite.openDatabase(DB_NAME);
    db.transaction((tx) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          idempotency_key TEXT NOT NULL UNIQUE,
          entity_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retries INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );`
      );
      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);`
      );
    });
  }
  return db;
}

export interface QueueRow {
  id: number;
  idempotency_key: string;
  entity_type: string;
  payload: string;
  status: string;
  retries: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function enqueue(
  idempotencyKey: string,
  entityType: string,
  payload: Record<string, unknown>
): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.transaction((tx) => {
    tx.executeSql(
      `INSERT OR IGNORE INTO queue (idempotency_key, entity_type, payload, status, retries, error, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?);`,
      [idempotencyKey, entityType, JSON.stringify(payload), now, now]
    );
  });
}

export function getPending(limit = 50): QueueRow[] {
  const database = getDb();
  return new Promise((resolve) => {
    database.transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM queue WHERE status = 'pending' OR (status = 'failed' AND retries < 3) ORDER BY created_at ASC LIMIT ?;`,
        [limit],
        (_, { rows }) => {
          const items: QueueRow[] = [];
          for (let i = 0; i < rows.length; i++) {
            items.push(rows.item(i) as QueueRow);
          }
          resolve(items);
        }
      );
    });
  }) as unknown as QueueRow[];
}

export function markSynced(id: number, _recordId: number | null): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.transaction((tx) => {
    tx.executeSql(
      `UPDATE queue SET status = 'synced', updated_at = ? WHERE id = ?;`,
      [now, id]
    );
  });
}

export function markFailed(id: number, error: string): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.transaction((tx) => {
    tx.executeSql(
      `UPDATE queue SET status = 'failed', error = ?, retries = retries + 1, updated_at = ? WHERE id = ?;`,
      [error, now, id]
    );
  });
}

export function getQueueCounts(): { pending: number; synced: number; failed: number } {
  const database = getDb();
  return new Promise((resolve) => {
    database.transaction((tx) => {
      tx.executeSql(
        `SELECT status, COUNT(*) as count FROM queue GROUP BY status;`,
        [],
        (_, { rows }) => {
          const counts = { pending: 0, synced: 0, failed: 0 };
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i) as { status: string; count: number };
            if (row.status === "pending") counts.pending = row.count;
            else if (row.status === "synced") counts.synced = row.count;
            else if (row.status === "failed") counts.failed = row.count;
          }
          resolve(counts);
        }
      );
    });
  }) as unknown as { pending: number; synced: number; failed: number };
}