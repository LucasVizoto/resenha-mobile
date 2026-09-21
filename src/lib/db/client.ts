import * as SQLite from 'expo-sqlite';
import { CONTACTS_CACHE_EXTRA_COLUMNS, SCHEMA_SQL } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('DB não inicializado — chame initDb() no boot');
  }
  return db;
}

async function ensureColumns(
  database: SQLite.SQLiteDatabase,
  table: string,
  columns: [string, string][],
) {
  const existing = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const names = new Set(existing.map((c) => c.name));
  for (const [name, type] of columns) {
    if (!names.has(name)) {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
}

export async function initDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('soft_messenger.db');
  await db.execAsync(SCHEMA_SQL);
  await ensureColumns(db, 'contacts_cache', CONTACTS_CACHE_EXTRA_COLUMNS);
  return db;
}
